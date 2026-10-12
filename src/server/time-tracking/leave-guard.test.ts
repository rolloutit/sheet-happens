import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(async () => []),
  leave: { findMany: vi.fn() },
  periodLock: { findFirst: vi.fn(async () => null) },
  member: { findUnique: vi.fn(async () => ({ timezone: "Europe/Budapest" })) },
  timeEntry: { findUnique: vi.fn(), create: vi.fn() },
  runningTimer: { findUnique: vi.fn() },
}));

vi.mock("@/src/server/db/client", () => ({
  prisma: { ...tx, $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) },
}));

const { findFullDayLeaveDates } = await import("./leave-guard");
const { createTimeEntry, startRunningTimer, stopRunningTimer, updateTimeEntry } =
  await import("./time-entries");

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Wednesday 7 to Friday 9 October 2026, a full-day vacation. */
const leave = { startDate: dateOnly("2026-10-07"), endDate: dateOnly("2026-10-09") };

beforeEach(() => {
  vi.clearAllMocks();
  tx.leave.findMany.mockResolvedValue([leave]);
});

describe("findFullDayLeaveDates", () => {
  it("asks only for live full-day leave overlapping the range", async () => {
    await findFullDayLeaveDates(tx as never, "member-1", "2026-10-05", "2026-10-11");

    expect(tx.leave.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          memberId: "member-1",
          deletedAt: null,
          dayPart: "FULL",
          startDate: { lte: dateOnly("2026-10-11") },
          endDate: { gte: dateOnly("2026-10-05") },
        },
      }),
    );
  });

  it("returns the covered dates clipped to the range", async () => {
    const dates = await findFullDayLeaveDates(tx as never, "member-1", "2026-10-08", "2026-10-11");

    expect([...dates]).toEqual(["2026-10-08", "2026-10-09"]);
  });
});

describe("time tracking on a leave day", () => {
  it("refuses a new entry", async () => {
    await expect(
      createTimeEntry({
        memberId: "member-1",
        actorMemberId: "member-1",
        projectId: "project-1",
        localDate: dateOnly("2026-10-08"),
        durationMinutes: 60,
        description: "Work",
      }),
    ).rejects.toMatchObject({ code: "DAY_ON_LEAVE" });

    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.timeEntry.create).not.toHaveBeenCalled();
  });

  it("refuses moving an entry onto the leave", async () => {
    tx.timeEntry.findUnique.mockResolvedValue({
      id: "entry-1",
      memberId: "member-1",
      projectId: "project-1",
      projectAssignmentId: "assignment-1",
      localDate: dateOnly("2026-10-06"),
      durationMinutes: 60,
      description: "Work",
      timezone: "Europe/Budapest",
      startedAt: null,
      endedAt: null,
      source: "GRID",
      lockedByTimesheetRevisionId: null,
      deletedAt: null,
    });

    await expect(
      updateTimeEntry({
        memberId: "member-1",
        actorMemberId: "member-1",
        timeEntryId: "entry-1",
        localDate: dateOnly("2026-10-07"),
      }),
    ).rejects.toMatchObject({ code: "DAY_ON_LEAVE" });
  });

  it("refuses starting a timer", async () => {
    await expect(
      startRunningTimer({
        memberId: "member-1",
        actorMemberId: "member-1",
        projectId: "project-1",
        description: "Work",
        now: new Date("2026-10-08T08:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "DAY_ON_LEAVE" });
  });

  it("refuses saving a timer that started on the leave", async () => {
    tx.runningTimer.findUnique.mockResolvedValue({
      id: "timer-1",
      memberId: "member-1",
      projectId: "project-1",
      projectAssignmentId: "assignment-1",
      description: "",
      startedAt: new Date("2026-10-08T08:00:00.000Z"),
      timezone: "Europe/Budapest",
    });

    await expect(
      stopRunningTimer({
        memberId: "member-1",
        actorMemberId: "member-1",
        now: new Date("2026-10-08T09:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "DAY_ON_LEAVE" });
  });
});
