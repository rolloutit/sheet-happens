import { isProjectColorToken, projectColorValues } from "@/src/lib/project-colors";
import { prisma } from "@/src/server/db/client";

import {
  loadAssignedProjects,
  loadLockedMonthStarts,
  type AssignedProjectRecord,
} from "./assignments";
import {
  formatDateOnly,
  getMonday,
  getMonthEnd,
  getMonthStart,
  getMonthStartsInRange,
  getTodayIsoInTimezone,
  getWeekEnd,
  parseDateOnly,
} from "./dates";
import {
  TimeTrackingError,
  type RunningTimerView,
  type TimeGridAssignedProject,
} from "./time-entries";
import type { TrackingMode } from "./tracking-mode";

/**
 * What an agent calls first: who it is acting for, and what it may write.
 *
 * Every answer here has to be the same answer `/time` would give, because the two are read by the
 * same person minutes apart — an agent that offers a project the grid withholds, or refuses a day
 * the grid accepts, reads as the app contradicting itself. That is why the projects and the locks
 * come from the shared loaders in `assignments.ts` rather than from a second predicate written
 * here: this file decides the *window*, never the rule applied inside it.
 *
 * Nothing in this module aggregates hours. It is the cheap orientation call — one member row and
 * three indexed reads — so an agent can be told to make it before every session without cost.
 */

/**
 * How far back the lock answer reaches, in months.
 *
 * Bounded rather than "every lock this member ever had" because the list is advice about what an
 * agent may write *now*, and nothing older than the open timesheet history can be written to
 * anyway. An unbounded read would grow forever, and it would bury the two or three months that
 * matter under years of frozen ones — while an unlocked month is history, not a lock, and never
 * appears at all. A refusal remains authoritative regardless: the write paths re-check the lock
 * for the exact date, so a month outside this window is refused by `assertDateOpen`, not silently
 * accepted.
 */
const LOCKED_MONTH_LOOKBACK_MONTHS = 12;

export type MemberTrackingContextProject = TimeGridAssignedProject & {
  /** False for a DECLARED assignment: those months are written on the month level, not per day. */
  canLogTime: boolean;
};

export type MemberTrackingContext = {
  member: {
    id: string;
    displayName: string;
    timezone: string;
    locale: string;
    durationDisplayFormat: "DECIMAL_HOURS" | "HOURS_MINUTES";
    profile: "EMPLOYEE" | "CONTRACTOR";
    defaultTrackingMode: TrackingMode;
  };
  /** `YYYY-MM-DD` in the member's timezone, which is the only "today" a write may be dated by. */
  today: string;
  week: { start: string; end: string };
  month: { start: string; end: string };
  projects: MemberTrackingContextProject[];
  /** Active period locks as "YYYY-MM", newest first. */
  lockedMonths: string[];
  runningTimer: RunningTimerView | null;
};

type TrackingContextMemberRecord = {
  id: string;
  displayName: string;
  timezone: string;
  locale: string;
  durationDisplayFormat: "DECIMAL_HOURS" | "HOURS_MINUTES";
  currentProfile: "EMPLOYEE" | "CONTRACTOR";
  defaultTrackingMode: TrackingMode;
  deletedAt: Date | null;
};

type TrackingContextTimerRecord = {
  id: string;
  projectId: string;
  projectAssignmentId: string;
  description: string;
  startedAt: Date;
  projectAssignment: {
    project: {
      name: string;
      colorToken: string;
    };
  };
};

/**
 * Only the four reads this function makes, so a test can hand over a plain object instead of
 * mocking the client module — and so the assignment and lock loaders can be handed the same one.
 */
export type TrackingContextClient = {
  member: {
    findUnique: (args: unknown) => Promise<TrackingContextMemberRecord | null>;
  };
  projectAssignment: {
    findMany: (args: unknown) => Promise<AssignedProjectRecord[]>;
  };
  periodLock: {
    findMany: (args: unknown) => Promise<Array<{ periodStart: Date }>>;
  };
  runningTimer: {
    findUnique: (args: unknown) => Promise<TrackingContextTimerRecord | null>;
  };
};

/**
 * The same fields and the same mapping as `getRunningTimerForMember` in `time-entries.ts`, restated
 * rather than called.
 *
 * That function closes over the `prisma` singleton and takes no `deps`, so reusing it would pin
 * this whole call to a live database — and an orientation call an agent makes constantly is
 * exactly the one that has to be testable without one. Widening its signature would change the
 * grid's and the app shell's read path, which this file has no business doing. The select and the
 * `teal` fallback are deliberately identical so the two cannot disagree in the meantime; if that
 * function ever grows a `deps` parameter, delete both of these and delegate to it.
 */
const runningTimerSelect = {
  id: true,
  projectId: true,
  projectAssignmentId: true,
  description: true,
  startedAt: true,
  projectAssignment: {
    select: {
      project: {
        select: {
          name: true,
          colorToken: true,
        },
      },
    },
  },
} as const;

export async function getMemberTrackingContext(
  input: { memberId: string; now?: Date },
  deps: { db?: TrackingContextClient } = {},
): Promise<MemberTrackingContext> {
  const db = deps.db ?? (prisma as unknown as TrackingContextClient);

  const member = await db.member.findUnique({
    where: {
      id: input.memberId,
    },
    select: {
      id: true,
      displayName: true,
      timezone: true,
      locale: true,
      durationDisplayFormat: true,
      currentProfile: true,
      defaultTrackingMode: true,
      deletedAt: true,
    },
  });

  // The same refusal as `getMemberWeeklyTimeGrid`, message and code both: a soft-deleted member is
  // indistinguishable from an unknown one to a caller, and saying which would leak that the id
  // exists.
  if (!member || member.deletedAt) {
    throw new TimeTrackingError("Member not found.", "MEMBER_NOT_FOUND");
  }

  /* Everything below is derived from the member's *local* date, never from the server's. A member
     in Auckland asking an agent to log "today" at 09:00 local is two calendar days from a member
     in Honolulu doing the same, and a UTC "today" would put one of them on the wrong day. */
  const today = getTodayIsoInTimezone(member.timezone, input.now);
  const todayDate = parseDateOnly(today);
  const weekStart = getMonday(todayDate);
  const weekEnd = getWeekEnd(weekStart);
  const monthStart = getMonthStart(todayDate);
  const monthEnd = getMonthEnd(todayDate);
  const lockWindowStart = new Date(
    Date.UTC(
      monthStart.getUTCFullYear(),
      monthStart.getUTCMonth() - LOCKED_MONTH_LOOKBACK_MONTHS,
      1,
    ),
  );

  const [projects, lockedMonthStarts, runningTimer] = await Promise.all([
    /* The current month, not the visible week. An agent is routinely asked to log "yesterday",
       which on a Monday falls in the previous week but practically never outside the month — and
       the month is the app's timesheet period, so it is the window every lock, total and
       submission is already expressed in. A week-shaped list would make an agent refuse a Sunday
       the member was entitled to write. */
    loadAssignedProjects({
      memberId: member.id,
      member,
      from: monthStart,
      to: monthEnd,
      db,
    }),
    loadLockedMonthStarts({
      memberId: member.id,
      monthStarts: getMonthStartsInRange(lockWindowStart, monthEnd),
      db,
    }),
    db.runningTimer.findUnique({
      where: {
        memberId: member.id,
      },
      select: runningTimerSelect,
    }),
  ]);

  return {
    member: {
      id: member.id,
      displayName: member.displayName,
      timezone: member.timezone,
      locale: member.locale,
      durationDisplayFormat: member.durationDisplayFormat,
      profile: member.currentProfile,
      defaultTrackingMode: member.defaultTrackingMode,
    },
    today,
    week: {
      start: formatDateOnly(weekStart),
      end: formatDateOnly(weekEnd),
    },
    month: {
      start: formatDateOnly(monthStart),
      end: formatDateOnly(monthEnd),
    },
    projects: projects.map((project) => ({
      ...project,
      // The mode is already resolved through `resolveTrackingMode` by the shared loader, so this
      // is a rename for the agent's benefit and not a second precedence decision.
      canLogTime: project.trackingMode === "TRACKED",
    })),
    lockedMonths: [...lockedMonthStarts]
      .map((monthStartIso) => monthStartIso.slice(0, 7))
      .sort((left, right) => right.localeCompare(left)),
    runningTimer: runningTimer ? mapRunningTimer(runningTimer) : null,
  };
}

function mapRunningTimer(timer: TrackingContextTimerRecord): RunningTimerView {
  const colorToken = isProjectColorToken(timer.projectAssignment.project.colorToken)
    ? timer.projectAssignment.project.colorToken
    : "teal";

  return {
    id: timer.id,
    projectId: timer.projectId,
    projectAssignmentId: timer.projectAssignmentId,
    projectName: timer.projectAssignment.project.name,
    projectColor: projectColorValues[colorToken],
    description: timer.description,
    startedAt: timer.startedAt.toISOString(),
  };
}
