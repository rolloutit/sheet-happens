import { DAILY_SOFT_WARNING_MINUTES } from "@/src/lib/time-entry-limits";
import { prisma } from "@/src/server/db/client";

import { loadLockedMonthStarts } from "./assignments";
import {
  addDays,
  formatDateOnly,
  getMonthEnd,
  getMonthStartsInRange,
  normalizeDateOnly,
} from "./dates";

/**
 * The arithmetic behind `time_summary` (§9 item 5 of `docs/mcp-server.md`): one member's own time
 * over one window, reduced to figures.
 *
 * It exists so that nothing downstream has to add minutes up. A model handed a list of entries and
 * asked "how did last week go?" will get the sum wrong occasionally and confidently, and no reader
 * of the answer could tell which half was arithmetic and which was narration. Everything numeric
 * here — the totals, each project's share, the per-day rollup, the comparison against the previous
 * window — comes out of a database aggregate, so the caller's only job is to say what it means.
 *
 * Member-scoped, deliberately and with no escape hatch: every query below filters by the
 * `memberId` it was handed, and there is no "all members" mode. Admin-wide reporting has its own
 * path with its own authorization (`buildReportTimeEntryWhere`); an aggregate that could be widened
 * by a parameter would be the shortest route to an agent reading somebody else's hours.
 */

export type MemberTimeSummaryProject = {
  projectId: string;
  name: string;
  minutes: number;
  entryCount: number;
  /** Fraction of `totals.trackedMinutes`, 0..1, rounded to 3 decimals. 0 when the total is 0. */
  share: number;
};

export type MemberTimeSummaryDay = {
  date: string;
  minutes: number;
  entryCount: number;
  /**
   * Past the 8-hour soft line, which the server otherwise never enforces — it only ever refuses at
   * the 24-hour hard cap (`DAILY_HARD_LIMIT_MINUTES`, see `createTimeEntry`). The soft limit is a
   * client-side notion, drawn as a colour in the grid, and it is surfaced here on purpose: an agent
   * has no pixels to notice, so the one nudge a member would have seen on the page travels as a
   * flag. It stays a flag and never an error — nine hours on a Tuesday is a fact about the week.
   */
  overSoftLimit: boolean;
};

export type MemberTimeSummary = {
  period: { start: string; end: string; locked: boolean };
  totals: {
    trackedMinutes: number;
    declaredMinutes: number;
    totalMinutes: number;
    entryCount: number;
    daysWithEntries: number;
    averageMinutesPerActiveDay: number;
  };
  byProject: MemberTimeSummaryProject[];
  byDay: MemberTimeSummaryDay[];
  previous: { start: string; end: string; totalMinutes: number; deltaMinutes: number } | null;
};

/**
 * The slice of the client this module touches, declared structurally rather than as `typeof prisma`
 * so a test can hand in four stubs instead of mocking the singleton — the same trade
 * `listAuditLogsForAdmin` makes, including the `unknown` argument types that keep Prisma's
 * overloads out of the declaration and push the row shape to a cast at each call site.
 */
export type TimeSummaryClient = {
  timeEntry: {
    groupBy(args: unknown): Promise<unknown[]>;
    aggregate(args: unknown): Promise<unknown>;
  };
  monthlyHourDeclaration: {
    aggregate(args: unknown): Promise<unknown>;
  };
  project: {
    findMany(args: unknown): Promise<unknown[]>;
  };
  periodLock: {
    findMany(args: unknown): Promise<Array<{ periodStart: Date }>>;
  };
};

type SummarizeMemberTimeDeps = {
  db?: TimeSummaryClient;
};

type TrackedProjectGroup = {
  projectId: string;
  _sum: { durationMinutes: number | null };
  _count: { _all: number };
};

type TrackedDayGroup = {
  localDate: Date;
  _sum: { durationMinutes: number | null };
  _count: { _all: number };
};

type MinutesAggregate = {
  _sum: { minutes: number | null };
};

type DurationAggregate = {
  _sum: { durationMinutes: number | null };
};

type ProjectNameRecord = {
  id: string;
  name: string;
};

export async function summarizeMemberTime(
  input: {
    memberId: string;
    from: Date;
    to: Date;
    compareWithPrevious?: boolean;
  },
  deps: SummarizeMemberTimeDeps = {},
): Promise<MemberTimeSummary> {
  const db = deps.db ?? (prisma as unknown as TimeSummaryClient);
  const from = normalizeDateOnly(input.from);
  const to = normalizeDateOnly(input.to);
  const monthStarts = getMonthStartsInRange(from, to);
  /* Declared hours count only for the months lying **entirely** inside the window; a partially
     covered month contributes nothing at all. A declaration is a single whole-month figure with no
     per-day detail behind it — that is what declared mode *is* — so there is no honest way to
     attribute part of it to part of a month. Splitting it by day count would invent a distribution
     the member never claimed, and the figure would then depend on where a query window happened to
     fall. Reporting zero and letting the caller widen the range is the truthful answer. */
  const declaredMonthStarts = monthStarts.filter(
    (monthStart) => monthStart >= from && getMonthEnd(monthStart) <= to,
  );
  const previousWindow = (input.compareWithPrevious ?? true) ? getPreviousWindow(from, to) : null;

  const [projectGroups, dayGroups, declaredAggregate, lockedMonthStarts, previousAggregate] =
    await Promise.all([
      db.timeEntry.groupBy({
        by: ["projectId"],
        where: buildTrackedWhere({ memberId: input.memberId, from, to }),
        _sum: {
          durationMinutes: true,
        },
        _count: {
          _all: true,
        },
      }) as Promise<TrackedProjectGroup[]>,
      db.timeEntry.groupBy({
        by: ["localDate"],
        where: buildTrackedWhere({ memberId: input.memberId, from, to }),
        _sum: {
          durationMinutes: true,
        },
        _count: {
          _all: true,
        },
      }) as Promise<TrackedDayGroup[]>,
      declaredMonthStarts.length
        ? (db.monthlyHourDeclaration.aggregate({
            where: {
              memberId: input.memberId,
              periodStart: {
                in: declaredMonthStarts,
              },
            },
            _sum: {
              minutes: true,
            },
          }) as Promise<MinutesAggregate>)
        : null,
      loadLockedMonthStarts({ memberId: input.memberId, monthStarts, db }),
      previousWindow
        ? (db.timeEntry.aggregate({
            where: buildTrackedWhere({
              memberId: input.memberId,
              from: previousWindow.from,
              to: previousWindow.to,
            }),
            _sum: {
              durationMinutes: true,
            },
          }) as Promise<DurationAggregate>)
        : null,
    ]);

  const names = await loadProjectNames(
    db,
    projectGroups.map((group) => group.projectId),
  );

  /* The two groupings partition exactly the same rows, so `trackedMinutes` and `entryCount` could
     be summed from either. Taking them from the project grouping keeps the derivation identical to
     `buildMonthOverview`'s, which is what makes a month summary and `/time`'s month view agree. */
  const trackedMinutes = projectGroups.reduce(
    (total, group) => total + (group._sum.durationMinutes ?? 0),
    0,
  );
  const entryCount = projectGroups.reduce((total, group) => total + group._count._all, 0);
  const declaredMinutes = declaredAggregate?._sum.minutes ?? 0;

  const byProject = projectGroups
    .map((group) => {
      const minutes = group._sum.durationMinutes ?? 0;

      return {
        projectId: group.projectId,
        /* A project row that has vanished — hard-deleted, or simply not readable any more — falls
           back to its id rather than dropping out, because a missing row would leave `byProject`
           not summing to `trackedMinutes` and the narration would then be quietly short of hours.
           Nothing filters `deletedAt` in the lookup either: a soft-deleted project's name is still
           the right label for time already logged against it. */
        name: names.get(group.projectId) ?? group.projectId,
        minutes,
        entryCount: group._count._all,
        share: trackedMinutes > 0 ? Math.round((minutes / trackedMinutes) * 1000) / 1000 : 0,
      };
    })
    /* Biggest first, then by name — the tie-break is the point. Two projects on the same total
       would otherwise swap places between two reads of the same window, and an agent narrating
       "your largest project was X" from a list that reorders itself is worse than one that is
       merely arbitrary. */
    .sort((left, right) => right.minutes - left.minutes || left.name.localeCompare(right.name));

  const byDay = dayGroups
    .map((group) => {
      const minutes = group._sum.durationMinutes ?? 0;

      return {
        date: formatDateOnly(group.localDate),
        minutes,
        entryCount: group._count._all,
        overSoftLimit: minutes > DAILY_SOFT_WARNING_MINUTES,
      };
    })
    .sort((left, right) => left.date.localeCompare(right.date));

  /* Never folded into `trackedMinutes`: the two are different kinds of claim, one logged here and
     one attested for another company's system, and `buildMonthOverview` draws the same line for the
     same reason. `totalMinutes` is what the member is responsible for across both. */
  const totalMinutes = trackedMinutes + declaredMinutes;
  /* `every`, not `some`. "Locked" is a claim that nothing in the window can still change, and a
     range spanning a closed August and an open September plainly can — reporting it as locked would
     talk an agent out of a correction it could in fact still make. */
  const locked =
    monthStarts.length > 0 &&
    monthStarts.every((monthStart) => lockedMonthStarts.has(formatDateOnly(monthStart)));

  return {
    period: {
      start: formatDateOnly(from),
      end: formatDateOnly(to),
      locked,
    },
    totals: {
      trackedMinutes,
      declaredMinutes,
      totalMinutes,
      entryCount,
      /* Only days that hold something, so the average is over days actually worked rather than over
         the calendar — and never NaN or Infinity on a window with nothing in it. */
      daysWithEntries: byDay.length,
      averageMinutesPerActiveDay: byDay.length ? Math.round(trackedMinutes / byDay.length) : 0,
    },
    byProject,
    byDay,
    previous: previousWindow
      ? {
          start: formatDateOnly(previousWindow.from),
          end: formatDateOnly(previousWindow.to),
          totalMinutes: previousAggregate?._sum.durationMinutes ?? 0,
          deltaMinutes: totalMinutes - (previousAggregate?._sum.durationMinutes ?? 0),
        }
      : null,
  };
}

/**
 * The `where` all three tracked reads share.
 *
 * `DECLARED` is excluded at the query rather than on the way out, which is the same rule the week
 * grid and the month overview follow and for the same reason: a declared month is one 52-hour entry
 * sitting on the 1st, and every aggregate here — the totals, each project's share, the per-day
 * rollup, the soft-limit flag, the previous window — would absorb it. Filtering on the way out only
 * works while somebody remembers to repeat it in the next aggregate added; filtering in the `where`
 * means one cannot see a declared row at all. Declared hours are reported separately below.
 */
function buildTrackedWhere(input: { memberId: string; from: Date; to: Date }) {
  return {
    memberId: input.memberId,
    deletedAt: null,
    source: {
      not: "DECLARED",
    },
    localDate: {
      gte: input.from,
      lte: input.to,
    },
  };
}

/**
 * The window of the same length in days ending the day before `from`.
 *
 * Same length rather than the same calendar unit, because the current window need not be one
 * either — `time_summary` answers arbitrary ranges as well as days, weeks and months. One
 * consequence is worth naming: a month-long window's predecessor is not the previous calendar month
 * (30 days before 1 September is 2 August, not 1 August), which is also why its figure counts
 * tracked minutes only. A declaration is a whole-month figure, and a window that cannot land on
 * month boundaries can never qualify for one under the rule in {@link summarizeMemberTime}. So
 * `deltaMinutes` reads as a coarse trend, not as a figure to close a month against.
 *
 * The length is clamped to a day so an inverted range from a caller cannot put the "previous"
 * window after the current one.
 */
function getPreviousWindow(from: Date, to: Date) {
  const lengthDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
  const previousTo = addDays(from, -1);

  return {
    from: addDays(previousTo, -(lengthDays - 1)),
    to: previousTo,
  };
}

/** One read for every name `byProject` needs, rather than one read per project. */
async function loadProjectNames(db: TimeSummaryClient, projectIds: readonly string[]) {
  if (projectIds.length === 0) {
    return new Map<string, string>();
  }

  const projects = (await db.project.findMany({
    where: {
      id: {
        in: [...projectIds],
      },
    },
    select: {
      id: true,
      name: true,
    },
  })) as ProjectNameRecord[];

  return new Map(projects.map((project) => [project.id, project.name]));
}
