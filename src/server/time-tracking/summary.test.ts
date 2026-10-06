import { describe, expect, it, vi } from "vitest";

import { summarizeMemberTime } from "./summary";

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function projectGroup(projectId: string, minutes: number | null, entryCount: number) {
  return {
    projectId,
    _sum: { durationMinutes: minutes },
    _count: { _all: entryCount },
  };
}

function dayGroup(date: string, minutes: number | null, entryCount: number) {
  return {
    localDate: dateOnly(date),
    _sum: { durationMinutes: minutes },
    _count: { _all: entryCount },
  };
}

type TrackedWhere = {
  memberId: string;
  deletedAt: null;
  source: { not: string };
  localDate: { gte: Date; lte: Date };
};

type SummaryDbOverrides = {
  projectGroups?: ReturnType<typeof projectGroup>[];
  dayGroups?: ReturnType<typeof dayGroup>[];
  projects?: Array<{ id: string; name: string }>;
  declaredMinutes?: number | null;
  previousMinutes?: number | null;
  /** Month firsts with an active lock. The stub honours the `in` list, as the real query does. */
  lockedMonths?: string[];
};

/**
 * A structural stand-in for the four models `summarizeMemberTime` reads, handed in through `deps`
 * so nothing here mocks the `prisma` singleton — the same trade `time-entries.test.ts` makes. The
 * argument types sit on the mocks rather than in a cast at each assertion, which is what lets a
 * test read back a `where` clause — where the rule about declared entries lives — without one.
 */
function createSummaryDb(overrides: SummaryDbOverrides = {}) {
  return {
    timeEntry: {
      groupBy: vi.fn<(args: { by: string[]; where: TrackedWhere }) => Promise<unknown[]>>(
        async (args) =>
          args.by[0] === "projectId"
            ? (overrides.projectGroups ?? [])
            : (overrides.dayGroups ?? []),
      ),
      aggregate: vi.fn<
        (args: { where: TrackedWhere }) => Promise<{ _sum: { durationMinutes: number | null } }>
      >(async () => ({ _sum: { durationMinutes: overrides.previousMinutes ?? null } })),
    },
    monthlyHourDeclaration: {
      aggregate: vi.fn<
        (args: { where: { periodStart: { in: Date[] } } }) => Promise<{
          _sum: { minutes: number | null };
        }>
      >(async () => ({ _sum: { minutes: overrides.declaredMinutes ?? null } })),
    },
    project: {
      findMany: vi.fn<(args: unknown) => Promise<Array<{ id: string; name: string }>>>(
        async () => overrides.projects ?? [],
      ),
    },
    periodLock: {
      findMany: vi.fn(async (args: { where: { periodStart: { in: Date[] } } }) =>
        args.where.periodStart.in
          .filter((periodStart) =>
            (overrides.lockedMonths ?? []).includes(periodStart.toISOString().slice(0, 10)),
          )
          .map((periodStart) => ({ periodStart })),
      ),
    },
  };
}

const SEPTEMBER = {
  memberId: "member-1",
  from: dateOnly("2026-09-01"),
  to: dateOnly("2026-09-30"),
};

describe("summarizeMemberTime", () => {
  it("totals the window and gives every project its share", async () => {
    const db = createSummaryDb({
      projectGroups: [
        projectGroup("project-atlas", 1200, 9),
        projectGroup("project-nimbus", 660, 5),
      ],
      dayGroups: [dayGroup("2026-09-07", 510, 4), dayGroup("2026-09-08", 1350, 10)],
      projects: [
        { id: "project-atlas", name: "Atlas Platform" },
        { id: "project-nimbus", name: "Nimbus" },
      ],
    });

    const summary = await summarizeMemberTime(SEPTEMBER, { db: db as never });

    expect(summary.period).toEqual({ start: "2026-09-01", end: "2026-09-30", locked: false });
    expect(summary.totals).toEqual({
      trackedMinutes: 1860,
      declaredMinutes: 0,
      totalMinutes: 1860,
      entryCount: 14,
      daysWithEntries: 2,
      averageMinutesPerActiveDay: 930,
    });
    expect(summary.byProject).toEqual([
      {
        projectId: "project-atlas",
        name: "Atlas Platform",
        minutes: 1200,
        entryCount: 9,
        share: 0.645,
      },
      {
        projectId: "project-nimbus",
        name: "Nimbus",
        minutes: 660,
        entryCount: 5,
        share: 0.355,
      },
    ]);
    expect(summary.byProject.reduce((total, row) => total + row.share, 0)).toBeCloseTo(1, 2);
  });

  it("orders projects by minutes, then by name so equal totals never swap places", async () => {
    const db = createSummaryDb({
      projectGroups: [
        projectGroup("project-nimbus", 480, 3),
        projectGroup("project-atlas", 480, 2),
        projectGroup("project-orion", 960, 6),
      ],
      projects: [
        { id: "project-nimbus", name: "Nimbus" },
        { id: "project-atlas", name: "Atlas Platform" },
        { id: "project-orion", name: "Orion" },
      ],
    });

    const summary = await summarizeMemberTime(SEPTEMBER, { db: db as never });

    expect(summary.byProject.map((row) => row.name)).toEqual(["Orion", "Atlas Platform", "Nimbus"]);
  });

  it("keeps a project whose row has vanished, under its id", async () => {
    const db = createSummaryDb({
      projectGroups: [projectGroup("project-gone", 120, 1)],
      projects: [],
    });

    const summary = await summarizeMemberTime(SEPTEMBER, { db: db as never });

    expect(summary.byProject).toEqual([
      { projectId: "project-gone", name: "project-gone", minutes: 120, entryCount: 1, share: 1 },
    ]);
    expect(summary.byProject.reduce((total, row) => total + row.minutes, 0)).toBe(
      summary.totals.trackedMinutes,
    );
  });

  it("reports zeros rather than NaN on a window with nothing in it", async () => {
    const db = createSummaryDb();

    const summary = await summarizeMemberTime(SEPTEMBER, { db: db as never });

    expect(summary.totals.trackedMinutes).toBe(0);
    expect(summary.totals.entryCount).toBe(0);
    expect(summary.totals.daysWithEntries).toBe(0);
    expect(summary.totals.averageMinutesPerActiveDay).toBe(0);
    expect(summary.byProject).toEqual([]);
    expect(summary.byDay).toEqual([]);
    expect(db.project.findMany).not.toHaveBeenCalled();
  });

  it("gives a zero-minute project a share of 0, not NaN", async () => {
    const db = createSummaryDb({
      projectGroups: [projectGroup("project-atlas", null, 0)],
      projects: [{ id: "project-atlas", name: "Atlas Platform" }],
    });

    const summary = await summarizeMemberTime(SEPTEMBER, { db: db as never });

    expect(summary.byProject[0]?.share).toBe(0);
    expect(Number.isNaN(summary.byProject[0]?.share)).toBe(false);
  });

  it("excludes declared entries and soft-deleted rows from every tracked read", async () => {
    const db = createSummaryDb();

    await summarizeMemberTime(SEPTEMBER, { db: db as never });

    const wheres = [
      ...db.timeEntry.groupBy.mock.calls.map((call) => call[0].where),
      ...db.timeEntry.aggregate.mock.calls.map((call) => call[0].where),
    ];

    // Both `groupBy` reads plus the previous window's aggregate.
    expect(wheres).toHaveLength(3);

    for (const where of wheres) {
      expect(where.memberId).toBe("member-1");
      expect(where.deletedAt).toBeNull();
      expect(where.source).toEqual({ not: "DECLARED" });
    }
  });

  it("counts declared hours for a month the window covers entirely", async () => {
    const db = createSummaryDb({
      projectGroups: [projectGroup("project-atlas", 600, 4)],
      projects: [{ id: "project-atlas", name: "Atlas Platform" }],
      declaredMinutes: 3120,
    });

    const summary = await summarizeMemberTime(SEPTEMBER, { db: db as never });

    expect(db.monthlyHourDeclaration.aggregate).toHaveBeenCalledTimes(1);
    expect(db.monthlyHourDeclaration.aggregate.mock.calls[0]?.[0].where.periodStart.in).toEqual([
      dateOnly("2026-09-01"),
    ]);
    expect(summary.totals.declaredMinutes).toBe(3120);
    // Declared minutes stay out of the tracked figure and out of every project share.
    expect(summary.totals.trackedMinutes).toBe(600);
    expect(summary.totals.totalMinutes).toBe(3720);
    expect(summary.byProject[0]?.share).toBe(1);
  });

  it("counts no declared hours for a month the window only partly covers", async () => {
    const db = createSummaryDb({
      projectGroups: [projectGroup("project-atlas", 600, 4)],
      projects: [{ id: "project-atlas", name: "Atlas Platform" }],
      declaredMinutes: 3120,
    });

    const summary = await summarizeMemberTime(
      { memberId: "member-1", from: dateOnly("2026-09-07"), to: dateOnly("2026-09-13") },
      { db: db as never },
    );

    expect(db.monthlyHourDeclaration.aggregate).not.toHaveBeenCalled();
    expect(summary.totals.declaredMinutes).toBe(0);
    expect(summary.totals.totalMinutes).toBe(600);
  });

  it("counts only the fully covered months of a window that straddles three", async () => {
    const db = createSummaryDb({ declaredMinutes: 4800 });

    await summarizeMemberTime(
      { memberId: "member-1", from: dateOnly("2026-07-15"), to: dateOnly("2026-09-14") },
      { db: db as never },
    );

    expect(db.monthlyHourDeclaration.aggregate.mock.calls[0]?.[0].where.periodStart.in).toEqual([
      dateOnly("2026-08-01"),
    ]);
  });

  it("flags a day past the soft limit and leaves the day on it alone", async () => {
    const db = createSummaryDb({
      dayGroups: [
        dayGroup("2026-09-07", 480, 3),
        dayGroup("2026-09-08", 481, 4),
        dayGroup("2026-09-09", 300, 2),
      ],
    });

    const summary = await summarizeMemberTime(SEPTEMBER, { db: db as never });

    expect(summary.byDay).toEqual([
      { date: "2026-09-07", minutes: 480, entryCount: 3, overSoftLimit: false },
      { date: "2026-09-08", minutes: 481, entryCount: 4, overSoftLimit: true },
      { date: "2026-09-09", minutes: 300, entryCount: 2, overSoftLimit: false },
    ]);
  });

  it("sorts the days it has and reports no others", async () => {
    const db = createSummaryDb({
      dayGroups: [dayGroup("2026-09-30", 120, 1), dayGroup("2026-09-02", 240, 2)],
    });

    const summary = await summarizeMemberTime(SEPTEMBER, { db: db as never });

    expect(summary.byDay.map((day) => day.date)).toEqual(["2026-09-02", "2026-09-30"]);
  });

  it("calls the window locked only when every month it touches is locked", async () => {
    const spanning = {
      memberId: "member-1",
      from: dateOnly("2026-08-24"),
      to: dateOnly("2026-09-06"),
    };

    const allLocked = await summarizeMemberTime(spanning, {
      db: createSummaryDb({ lockedMonths: ["2026-08-01", "2026-09-01"] }) as never,
    });
    const halfLocked = await summarizeMemberTime(spanning, {
      db: createSummaryDb({ lockedMonths: ["2026-08-01"] }) as never,
    });

    expect(allLocked.period.locked).toBe(true);
    expect(halfLocked.period.locked).toBe(false);
  });

  it("compares against the same length of days ending the day before the window", async () => {
    const db = createSummaryDb({
      projectGroups: [projectGroup("project-atlas", 1860, 14)],
      projects: [{ id: "project-atlas", name: "Atlas Platform" }],
      previousMinutes: 2100,
    });

    const summary = await summarizeMemberTime(
      { memberId: "member-1", from: dateOnly("2026-09-07"), to: dateOnly("2026-09-13") },
      { db: db as never },
    );

    expect(summary.previous).toEqual({
      start: "2026-08-31",
      end: "2026-09-06",
      totalMinutes: 2100,
      deltaMinutes: -240,
    });
    expect(db.timeEntry.aggregate.mock.calls[0]?.[0].where.localDate).toEqual({
      gte: dateOnly("2026-08-31"),
      lte: dateOnly("2026-09-06"),
    });
  });

  it("signs the delta positive when the window beats the one before it", async () => {
    const db = createSummaryDb({
      projectGroups: [projectGroup("project-atlas", 2400, 16)],
      projects: [{ id: "project-atlas", name: "Atlas Platform" }],
      previousMinutes: 1860,
    });

    const summary = await summarizeMemberTime(
      { memberId: "member-1", from: dateOnly("2026-09-07"), to: dateOnly("2026-09-13") },
      { db: db as never },
    );

    expect(summary.previous?.deltaMinutes).toBe(540);
  });

  it("treats a previous window with nothing logged as zero, not as missing", async () => {
    const db = createSummaryDb({
      projectGroups: [projectGroup("project-atlas", 600, 4)],
      projects: [{ id: "project-atlas", name: "Atlas Platform" }],
    });

    const summary = await summarizeMemberTime(SEPTEMBER, { db: db as never });

    expect(summary.previous).toEqual({
      start: "2026-08-02",
      end: "2026-08-31",
      totalMinutes: 0,
      deltaMinutes: 600,
    });
  });

  it("skips the comparison, and its query, when it is turned off", async () => {
    const db = createSummaryDb({ previousMinutes: 2100 });

    const summary = await summarizeMemberTime(
      { ...SEPTEMBER, compareWithPrevious: false },
      { db: db as never },
    );

    expect(summary.previous).toBeNull();
    expect(db.timeEntry.aggregate).not.toHaveBeenCalled();
  });
});
