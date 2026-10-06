import { isProjectColorToken, projectColorValues } from "@/src/lib/project-colors";
import { prisma } from "@/src/server/db/client";

import { formatDateOnly, getMonthEnd, getMonthStart } from "./dates";
import { resolveTrackingMode, type TrackingMode, type TrackingModeMember } from "./tracking-mode";

/**
 * L4 of the `/time` resolution axis: one month, per-project totals, and nothing finer.
 *
 * **No per-entry month data**, which is the constraint that makes the level cheap enough to ship
 * alongside the week on every `/time` load (§11 of `docs/time-view-zoom-axis.md`). The tracked band
 * is a `groupBy` of sums; the declared band is the month's declaration rows. Three indexed queries
 * per month, and because the payload arrives with the page, a level change stays a pure layout
 * animation with no spinner and no round-trip.
 *
 * The I/O is a thin shell over {@link buildMonthOverview}, which is where every rule lives — which
 * band a project belongs to, which zero-hour projects still earn a row, and what the month total
 * counts. That split mirrors `tracking-mode.ts`: a pure function over already-fetched rows, plus a
 * wrapper that fetches them.
 */

export type MonthOverviewProject = {
  projectId: string;
  assignmentId: string;
  name: string;
  color: string;
  /** Minutes logged against this project inside the month. */
  minutes: number;
};

/** The proof PDF standing in for the per-day detail a declared project does not have. */
export type MonthOverviewDeclarationProof = {
  declarationId: string;
  documentId: string;
  filename: string;
  contentType: string;
  byteSize: number;
  uploadedAt: string;
};

/**
 * A declared project's month: the figure, the member's own account of it, and the proof.
 *
 * `minutes` is `null` before anything has been declared, because the row **is** the form — a
 * declared assignment that is live in the month earns one whether or not a figure exists yet, and
 * `0` would be a claim ("I worked no hours") where `null` is the truth ("nothing declared yet").
 */
export type MonthOverviewDeclaration = {
  projectId: string;
  assignmentId: string;
  name: string;
  color: string;
  minutes: number | null;
  note: string;
  proof: MonthOverviewDeclarationProof | null;
};

/**
 * One day's tracked total, for the heat navigator (§4.4 of `docs/time-view-redesign.md`). Only
 * days with something logged appear; the client lays the month out and fills the gaps.
 */
export type MonthOverviewDayTotal = {
  isoDate: string;
  minutes: number;
  entryCount: number;
};

export type MemberMonthOverview = {
  /** The first of the month, `YYYY-MM-DD`. The month is named on the client, in the user's locale. */
  monthStart: string;
  monthEnd: string;
  /**
   * Tracked minutes per day, for the days that have any. The one aggregate the redesign added to
   * the month payload: a `groupBy` over the same rows as {@link trackedMinutes}, so a day's cell and
   * the month total can never disagree about what was logged.
   */
  days: MonthOverviewDayTotal[];
  /** Hours tracked in Sheet Happens. Summed from the database, not from {@link tracked}. */
  trackedMinutes: number;
  /** Hours declared for another company's system. */
  declaredMinutes: number;
  /** Everything the member is responsible for this month — both kinds, which is §8's month total. */
  totalMinutes: number;
  tracked: MonthOverviewProject[];
  declared: MonthOverviewDeclaration[];
};

/**
 * One of the member's assignments, as the month level reads it.
 *
 * Dates are `YYYY-MM-DD` strings rather than `Date`s so every overlap test in the pure core is a
 * string comparison — which for a zero-padded ISO date is the same ordering as the calendar, with
 * no timezone left to get wrong.
 */
export type MonthOverviewAssignment = {
  assignmentId: string;
  projectId: string;
  name: string;
  color: string;
  /** `null` inherits {@link member}'s default — see `resolveTrackingMode`. */
  trackingMode: TrackingMode | null;
  /** The member default this assignment inherits, carried per row so no second query is needed. */
  member: TrackingModeMember;
  active: boolean;
  validFrom: string;
  validTo: string | null;
  projectStartsOn: string | null;
  projectEndsOn: string | null;
  /** Deleted or no longer `ACTIVE`: nothing new can be logged against it, but its history stands. */
  projectRetired: boolean;
};

/** A declaration as the database holds it: a figure exists, so `minutes` is never `null` here. */
export type MonthOverviewDeclarationRow = {
  projectId: string;
  assignmentId: string;
  name: string;
  color: string;
  minutes: number;
  note: string;
  proof: MonthOverviewDeclarationProof | null;
};

export type BuildMonthOverviewInput = {
  monthStart: string;
  monthEnd: string;
  assignments: readonly MonthOverviewAssignment[];
  /** Tracked minutes per project id, already summed. Declared entries are excluded upstream. */
  trackedMinutesByProjectId: ReadonlyMap<string, number>;
  /** Tracked minutes per day, already summed over the same rows. */
  dayTotals?: readonly MonthOverviewDayTotal[];
  declarations: readonly MonthOverviewDeclarationRow[];
};

/**
 * The month, assembled from rows the caller has already fetched.
 *
 * Two rules are worth stating out loud, because both are about a figure someone closes a month
 * against:
 *
 * - **A project earns a tracked row when it has hours in the month, or when it is still live for
 *   at least one day of it.** Hours always show, so nothing can go missing from a month close. A
 *   zero-hour row only appears for a project that could still be logged against, which is what
 *   makes "I forgot Atlas this month" visible instead of silent — and what keeps a long-finished
 *   assignment from cluttering every month after it ended.
 * - **`trackedMinutes` is summed from the query, not from the rows it produced.** If an assignment
 *   window is narrowed after the fact and its entries fall outside it, the total still tells the
 *   truth about the database rather than about what happened to be renderable.
 *
 * A project with two assignment periods inside one month collapses to one row — the sums are
 * per project, so two rows would double-read. The later-starting period wins, which is the same
 * assignment a write to that project on that day would resolve to.
 *
 * The declared band follows the same two rules, for the same reasons, with one addition: a live
 * declared assignment earns a row **before** anything is declared against it, because that row is
 * the form the figure gets entered into. A declaration whose assignment no longer overlaps the
 * month still shows — its hours are in the timesheet either way, and a month total that quietly
 * disagreed with the one a timesheet was submitted from would be the worst failure this level has.
 */
export function buildMonthOverview(input: BuildMonthOverviewInput): MemberMonthOverview {
  const latestByProject = new Map<string, MonthOverviewAssignment>();

  for (const assignment of input.assignments) {
    const held = latestByProject.get(assignment.projectId);

    if (!held || held.validFrom <= assignment.validFrom) {
      latestByProject.set(assignment.projectId, assignment);
    }
  }

  const tracked: MonthOverviewProject[] = [];

  for (const assignment of latestByProject.values()) {
    if (resolveTrackingMode(assignment.member, assignment).mode !== "TRACKED") continue;

    const minutes = input.trackedMinutesByProjectId.get(assignment.projectId) ?? 0;

    if (!minutes && !isLiveInMonth(assignment, input.monthStart, input.monthEnd)) continue;

    tracked.push({
      projectId: assignment.projectId,
      assignmentId: assignment.assignmentId,
      name: assignment.name,
      color: assignment.color,
      minutes,
    });
  }

  const declaredByProject = new Map<string, MonthOverviewDeclaration>(
    input.declarations.map((declaration) => [declaration.projectId, declaration]),
  );

  for (const assignment of latestByProject.values()) {
    if (resolveTrackingMode(assignment.member, assignment).mode !== "DECLARED") continue;
    if (declaredByProject.has(assignment.projectId)) continue;
    if (!isLiveInMonth(assignment, input.monthStart, input.monthEnd)) continue;

    declaredByProject.set(assignment.projectId, {
      projectId: assignment.projectId,
      assignmentId: assignment.assignmentId,
      name: assignment.name,
      color: assignment.color,
      minutes: null,
      note: "",
      proof: null,
    });
  }

  const declared = [...declaredByProject.values()].sort(byName);
  const trackedMinutes = [...input.trackedMinutesByProjectId.values()].reduce(sum, 0);
  const declaredMinutes = declared.reduce((total, row) => total + (row.minutes ?? 0), 0);

  return {
    monthStart: input.monthStart,
    monthEnd: input.monthEnd,
    days: [...(input.dayTotals ?? [])].sort((a, b) => a.isoDate.localeCompare(b.isoDate)),
    trackedMinutes,
    declaredMinutes,
    totalMinutes: trackedMinutes + declaredMinutes,
    tracked: tracked.sort(byName),
    declared,
  };
}

/**
 * The month's rows for one member.
 *
 * Takes a single month start rather than the visible week, because the name says so and because
 * one month is the unit every rule above is written in. The `/time` page maps
 * `getMonthStartsInRange(weekStart, weekEnd)` over it, the same helper `getMemberWeeklyTimeGrid`
 * already uses to find the months a week touches, so a week spanning two months loads two.
 *
 * Deliberately does not validate the member: it is called beside `getMemberWeeklyTimeGrid`, which
 * owns that check for the whole page. An unknown member yields an empty month rather than a throw.
 */
export async function getMemberMonthOverview(input: {
  memberId: string;
  monthStart: Date;
}): Promise<MemberMonthOverview> {
  const monthStart = getMonthStart(input.monthStart);
  const monthEnd = getMonthEnd(monthStart);

  const [assignments, trackedSums, daySums, declarations] = await Promise.all([
    /* No `active: true` and no project-status filter, unlike the week's assignment query. An
       assignment deactivated or a project archived after the fact leaves its entries behind, and
       those hours are still part of the month; whether it is *live* is decided in the pure core,
       which is also what keeps the zero-hour rule out of a `where` clause. */
    prisma.projectAssignment.findMany({
      where: {
        memberId: input.memberId,
        validFrom: {
          lte: monthEnd,
        },
        OR: [{ validTo: null }, { validTo: { gte: monthStart } }],
      },
      orderBy: [{ project: { name: "asc" } }, { validFrom: "asc" }],
      select: {
        id: true,
        active: true,
        validFrom: true,
        validTo: true,
        trackingMode: true,
        member: {
          select: {
            defaultTrackingMode: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            colorToken: true,
            startsOn: true,
            endsOn: true,
            status: true,
            deletedAt: true,
          },
        },
      },
    }),
    prisma.timeEntry.groupBy({
      by: ["projectId"],
      where: {
        memberId: input.memberId,
        deletedAt: null,
        // A declaration materializes a `TimeEntry` of its own, which the declared band already
        // reports. Counting it here as well is how a hybrid month double-counts.
        source: {
          not: "DECLARED",
        },
        localDate: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      _sum: {
        durationMinutes: true,
      },
    }),
    /* The same rows again, grouped by day rather than by project: the heat navigator's cells. One
       extra indexed aggregate per month, and the only new query the redesign needed. */
    prisma.timeEntry.groupBy({
      by: ["localDate"],
      where: {
        memberId: input.memberId,
        deletedAt: null,
        source: {
          not: "DECLARED",
        },
        localDate: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      _sum: {
        durationMinutes: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.monthlyHourDeclaration.findMany({
      where: {
        memberId: input.memberId,
        periodStart: monthStart,
      },
      select: {
        id: true,
        projectId: true,
        projectAssignmentId: true,
        minutes: true,
        note: true,
        project: {
          select: {
            name: true,
            colorToken: true,
          },
        },
        /* A join rather than a fourth query. `deletedAt` and `status` come along so a replaced or
           removed document reads as a missing proof instead of as a link to nothing — a to-one
           relation cannot be filtered in the query, so that test lives in the mapper. */
        proofDocument: {
          select: {
            id: true,
            originalFilename: true,
            contentType: true,
            byteSize: true,
            createdAt: true,
            deletedAt: true,
            status: true,
          },
        },
      },
    }),
  ]);

  return buildMonthOverview({
    monthStart: formatDateOnly(monthStart),
    monthEnd: formatDateOnly(monthEnd),
    assignments: assignments.map((assignment) => ({
      assignmentId: assignment.id,
      projectId: assignment.project.id,
      name: assignment.project.name,
      color: resolveProjectColor(assignment.project.colorToken),
      trackingMode: assignment.trackingMode,
      member: assignment.member,
      active: assignment.active,
      validFrom: formatDateOnly(assignment.validFrom),
      validTo: assignment.validTo ? formatDateOnly(assignment.validTo) : null,
      projectStartsOn: assignment.project.startsOn
        ? formatDateOnly(assignment.project.startsOn)
        : null,
      projectEndsOn: assignment.project.endsOn ? formatDateOnly(assignment.project.endsOn) : null,
      projectRetired:
        Boolean(assignment.project.deletedAt) || assignment.project.status !== "ACTIVE",
    })),
    trackedMinutesByProjectId: new Map(
      trackedSums.map((row) => [row.projectId, row._sum.durationMinutes ?? 0]),
    ),
    dayTotals: daySums.map((row) => ({
      isoDate: formatDateOnly(row.localDate),
      minutes: row._sum.durationMinutes ?? 0,
      entryCount: row._count._all,
    })),
    declarations: declarations.map((declaration) => ({
      projectId: declaration.projectId,
      assignmentId: declaration.projectAssignmentId,
      name: declaration.project.name,
      color: resolveProjectColor(declaration.project.colorToken),
      minutes: declaration.minutes,
      note: declaration.note,
      proof: isLiveProof(declaration.proofDocument)
        ? {
            declarationId: declaration.id,
            documentId: declaration.proofDocument.id,
            filename: declaration.proofDocument.originalFilename,
            contentType: declaration.proofDocument.contentType,
            byteSize: Number(declaration.proofDocument.byteSize),
            uploadedAt: declaration.proofDocument.createdAt.toISOString(),
          }
        : null,
    })),
  });
}

/** A proof only counts while its document is still the live one — see the query's comment. */
function isLiveProof<T extends { deletedAt: Date | null; status: string }>(
  document: T | null,
): document is T {
  return Boolean(document && !document.deletedAt && document.status === "AVAILABLE");
}

/** Whether a day of the month exists that this assignment would accept an entry on. */
function isLiveInMonth(
  assignment: MonthOverviewAssignment,
  monthStart: string,
  monthEnd: string,
): boolean {
  if (!assignment.active || assignment.projectRetired) return false;
  if (assignment.validFrom > monthEnd) return false;
  if (assignment.validTo && assignment.validTo < monthStart) return false;
  if (assignment.projectStartsOn && assignment.projectStartsOn > monthEnd) return false;
  if (assignment.projectEndsOn && assignment.projectEndsOn < monthStart) return false;

  return true;
}

function resolveProjectColor(colorToken: string) {
  return projectColorValues[isProjectColorToken(colorToken) ? colorToken : "teal"];
}

function byName(left: { name: string }, right: { name: string }) {
  return left.name.localeCompare(right.name);
}

function sum(total: number, minutes: number) {
  return total + minutes;
}
