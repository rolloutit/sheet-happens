import { describe, expect, it, vi } from "vitest";

import { projectColorValues } from "@/src/lib/project-colors";

import type { AssignedProjectRecord } from "./assignments";
import { getMemberTrackingContext } from "./context";
import { TimeTrackingError } from "./time-entries";

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

const memberRow = {
  id: "member-1",
  displayName: "Réka Kovács",
  timezone: "Europe/Budapest",
  locale: "hu",
  durationDisplayFormat: "DECIMAL_HOURS" as const,
  currentProfile: "CONTRACTOR" as const,
  defaultTrackingMode: "TRACKED" as const,
  deletedAt: null as Date | null,
};

function assignment(
  projectId: string,
  overrides: Partial<AssignedProjectRecord> = {},
): AssignedProjectRecord {
  return {
    id: `assignment-${projectId}`,
    validFrom: dateOnly("2026-01-01"),
    validTo: null,
    trackingMode: null,
    ...overrides,
    project: {
      id: projectId,
      name: projectId,
      colorToken: "cyan",
      startsOn: null,
      endsOn: null,
      isInternal: false,
      ...overrides.project,
    },
  };
}

function createContextDb(
  overrides: {
    member?: typeof memberRow | null;
    assignments?: AssignedProjectRecord[];
    locks?: Array<{ periodStart: Date }>;
    timer?: {
      id: string;
      projectId: string;
      projectAssignmentId: string;
      description: string;
      startedAt: Date;
      projectAssignment: { project: { name: string; colorToken: string } };
    } | null;
  } = {},
) {
  return {
    member: {
      findUnique: vi.fn(async () =>
        overrides.member === undefined ? memberRow : overrides.member,
      ),
    },
    /* The two reads whose `where` clause is asserted below are typed through `vi.fn` so that
       `mock.calls` carries their arguments: the window this module picks is the part that can be
       wrong while the rows coming back still look perfectly right. */
    projectAssignment: {
      findMany: vi.fn<(args: unknown) => Promise<AssignedProjectRecord[]>>(
        async () => overrides.assignments ?? [],
      ),
    },
    periodLock: {
      findMany: vi.fn<(args: unknown) => Promise<Array<{ periodStart: Date }>>>(
        async () => overrides.locks ?? [],
      ),
    },
    runningTimer: {
      findUnique: vi.fn(async () => overrides.timer ?? null),
    },
  };
}

describe("getMemberTrackingContext", () => {
  it("returns who the agent is acting for, the windows it may write in, and the live timer", async () => {
    const db = createContextDb({
      assignments: [assignment("project-nimbus")],
      timer: {
        id: "timer-1",
        projectId: "project-nimbus",
        projectAssignmentId: "assignment-project-nimbus",
        description: "Rate table migration",
        startedAt: new Date("2026-09-07T07:15:00.000Z"),
        projectAssignment: { project: { name: "Nimbus", colorToken: "amber" } },
      },
    });

    const context = await getMemberTrackingContext(
      { memberId: "member-1", now: new Date("2026-09-07T09:00:00.000Z") },
      { db: db as never },
    );

    expect(context.member).toEqual({
      id: "member-1",
      displayName: "Réka Kovács",
      timezone: "Europe/Budapest",
      locale: "hu",
      durationDisplayFormat: "DECIMAL_HOURS",
      // `currentProfile` on the row, `profile` on the wire: the agent is told what the member is
      // now, not handed a column name it would have to interpret.
      profile: "CONTRACTOR",
      defaultTrackingMode: "TRACKED",
    });
    expect(context.today).toBe("2026-09-07");
    expect(context.week).toEqual({ start: "2026-09-07", end: "2026-09-13" });
    expect(context.month).toEqual({ start: "2026-09-01", end: "2026-09-30" });
    expect(context.lockedMonths).toEqual([]);
    expect(context.projects).toEqual([
      expect.objectContaining({
        assignmentId: "assignment-project-nimbus",
        projectId: "project-nimbus",
        name: "project-nimbus",
        color: projectColorValues.cyan,
        validFrom: "2026-01-01",
        validTo: null,
        trackingMode: "TRACKED",
        canLogTime: true,
      }),
    ]);
    expect(context.runningTimer).toEqual({
      id: "timer-1",
      projectId: "project-nimbus",
      projectAssignmentId: "assignment-project-nimbus",
      projectName: "Nimbus",
      projectColor: projectColorValues.amber,
      description: "Rate table migration",
      startedAt: "2026-09-07T07:15:00.000Z",
    });
  });

  it("loads assignments for the whole current month, not just the visible week", async () => {
    const db = createContextDb();

    await getMemberTrackingContext(
      { memberId: "member-1", now: new Date("2026-09-07T09:00:00.000Z") },
      { db: db as never },
    );

    const where = db.projectAssignment.findMany.mock.calls[0]?.[0] as {
      where: { validFrom: { lte: Date }; OR: Array<{ validTo?: { gte?: Date } | null }> };
    };

    // "Log yesterday" on a Monday reaches into last week; it almost never reaches out of the
    // month, which is also the period a timesheet is submitted for.
    expect(where.where.validFrom.lte).toEqual(dateOnly("2026-09-30"));
    expect(where.where.OR).toContainEqual({ validTo: { gte: dateOnly("2026-09-01") } });
  });

  it("refuses a deleted member with the same code as the week grid", async () => {
    const db = createContextDb({ member: { ...memberRow, deletedAt: new Date() } });

    const error = await getMemberTrackingContext(
      { memberId: "member-1" },
      { db: db as never },
    ).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(TimeTrackingError);
    expect(error).toMatchObject({ message: "Member not found.", code: "MEMBER_NOT_FOUND" });
    expect(db.projectAssignment.findMany).not.toHaveBeenCalled();
  });

  it("refuses an unknown member the same way, without saying which it was", async () => {
    const db = createContextDb({ member: null });

    await expect(
      getMemberTrackingContext({ memberId: "nobody" }, { db: db as never }),
    ).rejects.toMatchObject({ code: "MEMBER_NOT_FOUND" });
  });

  it("marks a declared assignment as not loggable while a tracked one stays loggable", async () => {
    const db = createContextDb({
      assignments: [
        assignment("project-atlas", { trackingMode: "TRACKED" }),
        assignment("project-orion", { trackingMode: "DECLARED" }),
      ],
    });

    const context = await getMemberTrackingContext(
      { memberId: "member-1", now: new Date("2026-09-07T09:00:00.000Z") },
      { db: db as never },
    );

    expect(
      context.projects.map((project) => [
        project.projectId,
        project.trackingMode,
        project.canLogTime,
      ]),
    ).toEqual([
      ["project-atlas", "TRACKED", true],
      // Declared hours are written on the month level, so a per-day tool must not offer this one.
      ["project-orion", "DECLARED", false],
    ]);
  });

  it("reports locked months as YYYY-MM, newest first, from a bounded lookback window", async () => {
    const db = createContextDb({
      locks: [
        { periodStart: dateOnly("2026-06-01") },
        { periodStart: dateOnly("2026-08-01") },
        { periodStart: dateOnly("2026-07-01") },
      ],
    });

    const context = await getMemberTrackingContext(
      { memberId: "member-1", now: new Date("2026-09-07T09:00:00.000Z") },
      { db: db as never },
    );

    expect(context.lockedMonths).toEqual(["2026-08", "2026-07", "2026-06"]);

    const candidates = (
      db.periodLock.findMany.mock.calls[0]?.[0] as {
        where: { periodStart: { in: Date[] }; unlockedAt: null };
      }
    ).where;

    // Twelve months back through the current month, and only rows still locked — an unlocked lock
    // is history, not a restriction.
    expect(candidates.unlockedAt).toBeNull();
    expect(candidates.periodStart.in).toHaveLength(13);
    expect(candidates.periodStart.in[0]).toEqual(dateOnly("2025-09-01"));
    expect(candidates.periodStart.in.at(-1)).toEqual(dateOnly("2026-09-01"));
  });

  it("dates today in the member's timezone even when that is a different day, month and week than UTC", async () => {
    const db = createContextDb({
      member: { ...memberRow, timezone: "Pacific/Kiritimati" },
    });

    // UTC is still 2026-08-31; UTC+14 has already turned over into September. Getting this wrong
    // is the bug that files an agent's entry on the wrong day — and here, in the wrong month.
    const context = await getMemberTrackingContext(
      { memberId: "member-1", now: new Date("2026-08-31T13:00:00.000Z") },
      { db: db as never },
    );

    expect(context.today).toBe("2026-09-01");
    expect(context.month).toEqual({ start: "2026-09-01", end: "2026-09-30" });
    // A Tuesday, so the week it belongs to still starts in August.
    expect(context.week).toEqual({ start: "2026-08-31", end: "2026-09-06" });
  });

  it("dates today behind UTC for a timezone that has not reached the new day yet", async () => {
    const db = createContextDb({
      member: { ...memberRow, timezone: "Pacific/Niue" },
    });

    const context = await getMemberTrackingContext(
      { memberId: "member-1", now: new Date("2026-09-01T05:00:00.000Z") },
      { db: db as never },
    );

    expect(context.today).toBe("2026-08-31");
    expect(context.month).toEqual({ start: "2026-08-01", end: "2026-08-31" });
    expect(context.week).toEqual({ start: "2026-08-31", end: "2026-09-06" });
  });
});
