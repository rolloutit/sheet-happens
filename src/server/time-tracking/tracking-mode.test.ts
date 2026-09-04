import { describe, expect, it, vi } from "vitest";

import {
  assertTrackingModeSwitchAllowed,
  collectTrackingModeConflicts,
  findInheritingAssignmentIds,
  findTrackingModeConflicts,
  resolveTrackingMode,
  TrackingModeSwitchError,
  type TrackingModeMonthData,
} from "./tracking-mode";

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function month(overrides: Partial<TrackingModeMonthData> = {}): TrackingModeMonthData {
  return {
    projectId: overrides.projectId ?? "project-nimbus",
    projectName: overrides.projectName ?? "Nimbus",
    periodStart: overrides.periodStart ?? "2026-09-01",
    trackedEntryCount: overrides.trackedEntryCount ?? 0,
    declarationCount: overrides.declarationCount ?? 0,
  };
}

type GuardClientOverrides = {
  entries?: Array<{ projectId: string; localDate: Date; project: { name: string } }>;
  declarations?: Array<{ projectId: string; periodStart: Date; project: { name: string } }>;
  locks?: Array<{ periodStart: Date }>;
  inheritingAssignments?: Array<{ id: string }>;
};

function createGuardClient(overrides: GuardClientOverrides = {}) {
  return {
    projectAssignment: {
      findMany: vi.fn().mockResolvedValue(overrides.inheritingAssignments ?? []),
    },
    timeEntry: {
      findMany: vi.fn().mockResolvedValue(overrides.entries ?? []),
    },
    monthlyHourDeclaration: {
      findMany: vi.fn().mockResolvedValue(overrides.declarations ?? []),
    },
    periodLock: {
      findMany: vi.fn().mockResolvedValue(overrides.locks ?? []),
    },
  };
}

describe("resolveTrackingMode", () => {
  it("prefers the assignment override over the member default", () => {
    expect(
      resolveTrackingMode({ defaultTrackingMode: "TRACKED" }, { trackingMode: "DECLARED" }),
    ).toEqual({
      mode: "DECLARED",
      source: "ASSIGNMENT_OVERRIDE",
    });
  });

  it("inherits the member default when the assignment has no override", () => {
    expect(
      resolveTrackingMode({ defaultTrackingMode: "DECLARED" }, { trackingMode: null }),
    ).toEqual({
      mode: "DECLARED",
      source: "MEMBER_DEFAULT",
    });
  });

  it("lets an override pull a declared member back to tracked, which is the hybrid case", () => {
    expect(
      resolveTrackingMode({ defaultTrackingMode: "DECLARED" }, { trackingMode: "TRACKED" }),
    ).toEqual({
      mode: "TRACKED",
      source: "ASSIGNMENT_OVERRIDE",
    });
  });

  it("falls back to the member default with no assignment at all", () => {
    expect(resolveTrackingMode({ defaultTrackingMode: "TRACKED" }, null)).toEqual({
      mode: "TRACKED",
      source: "MEMBER_DEFAULT",
    });
  });
});

describe("collectTrackingModeConflicts", () => {
  it("refuses a switch to declared while an open month holds tracked entries", () => {
    expect(
      collectTrackingModeConflicts({
        targetMode: "DECLARED",
        months: [month({ trackedEntryCount: 12 })],
        lockedPeriodStarts: [],
      }),
    ).toEqual([
      {
        kind: "TRACKED_ENTRIES",
        projectId: "project-nimbus",
        projectName: "Nimbus",
        periodStart: "2026-09-01",
        count: 12,
      },
    ]);
  });

  it("refuses a switch to tracked while an open month holds a declaration", () => {
    expect(
      collectTrackingModeConflicts({
        targetMode: "TRACKED",
        months: [month({ declarationCount: 1 })],
        lockedPeriodStarts: [],
      }),
    ).toEqual([
      {
        kind: "DECLARATION",
        projectId: "project-nimbus",
        projectName: "Nimbus",
        periodStart: "2026-09-01",
        count: 1,
      },
    ]);
  });

  it("ignores a locked month, because frozen data cannot double-count", () => {
    expect(
      collectTrackingModeConflicts({
        targetMode: "DECLARED",
        months: [month({ periodStart: "2026-08-01", trackedEntryCount: 30 })],
        lockedPeriodStarts: ["2026-08-01"],
      }),
    ).toEqual([]);
  });

  /**
   * An employee has no `PeriodLock` at all, so every month holding data is open. Scoping the
   * refusal to the current calendar month would let July entries survive a switch and then be
   * declared again on top of themselves.
   */
  it("refuses every unlocked month, not just the current one", () => {
    const conflicts = collectTrackingModeConflicts({
      targetMode: "DECLARED",
      months: [
        month({ periodStart: "2026-07-01", trackedEntryCount: 5 }),
        month({ periodStart: "2026-09-01", trackedEntryCount: 2 }),
      ],
      lockedPeriodStarts: [],
    });

    expect(conflicts.map((conflict) => conflict.periodStart)).toEqual(["2026-09-01", "2026-07-01"]);
  });

  it("counts a hybrid member's projects separately and orders them by name within a month", () => {
    const conflicts = collectTrackingModeConflicts({
      targetMode: "DECLARED",
      months: [
        month({ projectId: "project-nimbus", projectName: "Nimbus", trackedEntryCount: 3 }),
        month({ projectId: "project-atlas", projectName: "Atlas Platform", trackedEntryCount: 7 }),
      ],
      lockedPeriodStarts: [],
    });

    expect(conflicts.map((conflict) => [conflict.projectName, conflict.count])).toEqual([
      ["Atlas Platform", 7],
      ["Nimbus", 3],
    ]);
  });

  it("passes a month whose only data is of the kind being switched into", () => {
    expect(
      collectTrackingModeConflicts({
        targetMode: "DECLARED",
        months: [month({ declarationCount: 1 })],
        lockedPeriodStarts: [],
      }),
    ).toEqual([]);
  });
});

describe("findTrackingModeConflicts", () => {
  it("groups entries into months and excludes locked ones", async () => {
    const client = createGuardClient({
      entries: [
        { projectId: "p1", localDate: dateOnly("2026-09-03"), project: { name: "Nimbus" } },
        { projectId: "p1", localDate: dateOnly("2026-09-17"), project: { name: "Nimbus" } },
        { projectId: "p1", localDate: dateOnly("2026-08-11"), project: { name: "Nimbus" } },
      ],
      locks: [{ periodStart: dateOnly("2026-08-01") }],
    });

    await expect(
      findTrackingModeConflicts(client, {
        memberId: "member-1",
        assignmentIds: ["assignment-1"],
        targetMode: "DECLARED",
      }),
    ).resolves.toEqual([
      {
        kind: "TRACKED_ENTRIES",
        projectId: "p1",
        projectName: "Nimbus",
        periodStart: "2026-09-01",
        count: 2,
      },
    ]);
    expect(client.monthlyHourDeclaration.findMany).not.toHaveBeenCalled();
  });

  it("reads declarations, not entries, when switching back to tracked", async () => {
    const client = createGuardClient({
      declarations: [
        { projectId: "p1", periodStart: dateOnly("2026-09-01"), project: { name: "Nimbus" } },
      ],
    });

    await expect(
      findTrackingModeConflicts(client, {
        memberId: "member-1",
        assignmentIds: ["assignment-1"],
        targetMode: "TRACKED",
      }),
    ).resolves.toHaveLength(1);
    expect(client.timeEntry.findMany).not.toHaveBeenCalled();
  });

  it("excludes soft-deleted and already-declared entries at the query", async () => {
    const client = createGuardClient();

    await findTrackingModeConflicts(client, {
      memberId: "member-1",
      assignmentIds: ["assignment-1", "assignment-1"],
      targetMode: "DECLARED",
    });

    expect(client.timeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectAssignmentId: { in: ["assignment-1"] },
          deletedAt: null,
          source: { not: "DECLARED" },
        },
      }),
    );
  });

  it("asks the database nothing when no assignment is affected", async () => {
    const client = createGuardClient();

    await expect(
      findTrackingModeConflicts(client, {
        memberId: "member-1",
        assignmentIds: [],
        targetMode: "DECLARED",
      }),
    ).resolves.toEqual([]);
    expect(client.timeEntry.findMany).not.toHaveBeenCalled();
    expect(client.periodLock.findMany).not.toHaveBeenCalled();
  });

  it("skips the lock lookup when nothing holds data", async () => {
    const client = createGuardClient();

    await findTrackingModeConflicts(client, {
      memberId: "member-1",
      assignmentIds: ["assignment-1"],
      targetMode: "DECLARED",
    });

    expect(client.periodLock.findMany).not.toHaveBeenCalled();
  });
});

describe("assertTrackingModeSwitchAllowed", () => {
  it("throws with the offending months attached", async () => {
    const client = createGuardClient({
      entries: [
        { projectId: "p1", localDate: dateOnly("2026-09-03"), project: { name: "Nimbus" } },
      ],
    });

    const error = await assertTrackingModeSwitchAllowed(client, {
      memberId: "member-1",
      assignmentIds: ["assignment-1"],
      targetMode: "DECLARED",
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(TrackingModeSwitchError);
    expect((error as TrackingModeSwitchError).targetMode).toBe("DECLARED");
    expect((error as TrackingModeSwitchError).conflicts).toHaveLength(1);
  });

  it("resolves when the month is clear", async () => {
    await expect(
      assertTrackingModeSwitchAllowed(createGuardClient(), {
        memberId: "member-1",
        assignmentIds: ["assignment-1"],
        targetMode: "DECLARED",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("findInheritingAssignmentIds", () => {
  it("returns only the assignments that follow the member default", async () => {
    const client = createGuardClient({
      inheritingAssignments: [{ id: "assignment-1" }, { id: "assignment-2" }],
    });

    await expect(findInheritingAssignmentIds(client, "member-1")).resolves.toEqual([
      "assignment-1",
      "assignment-2",
    ]);
    expect(client.projectAssignment.findMany).toHaveBeenCalledWith({
      where: {
        memberId: "member-1",
        trackingMode: null,
      },
      select: {
        id: true,
      },
    });
  });
});
