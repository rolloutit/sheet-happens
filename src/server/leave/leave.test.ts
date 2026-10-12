import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(async () => []),
  $transaction: vi.fn(),
  member: { findFirst: vi.fn() },
  timeEntry: { findFirst: vi.fn() },
  runningTimer: { findUnique: vi.fn() },
  auditLog: { create: vi.fn() },
  leave: { findMany: vi.fn(), create: vi.fn() },
  publicHolidayYear: { findMany: vi.fn(async () => [{ year: 2026 }]) },
  publicHoliday: {
    findMany: vi.fn(async () => [
      {
        date: new Date("2026-10-23T00:00:00.000Z"),
        localName: "Nemzeti ünnep",
        name: "National day",
      },
    ]),
  },
}));

vi.mock("@/src/server/db/client", () => ({ prisma: db }));

const {
  buildLeaveAttachmentKey,
  createLeave,
  getLeaveEarliestStartDate,
  listLeaveCalendar,
  normalizeAdminLeaveFilters,
} = await import("./leave");

function record(overrides: Record<string, unknown>) {
  return {
    id: "leave-1",
    memberId: "member-own",
    type: "SICK",
    dayPart: "FULL",
    startDate: new Date("2026-10-21T00:00:00.000Z"),
    endDate: new Date("2026-10-27T00:00:00.000Z"),
    note: "Influenza",
    member: { displayName: "Kovács Dóra", email: "dora@example.com" },
    attachmentDocument: { originalFilename: "igazolas.pdf", deletedAt: null },
    ...overrides,
  };
}

beforeEach(() => {
  db.leave.findMany.mockResolvedValue([
    record({}),
    record({
      id: "leave-2",
      memberId: "member-other",
      member: { displayName: "Nagy Bence", email: "b@example.com" },
    }),
  ]);
});

describe("listLeaveCalendar", () => {
  it("shows colleagues only that someone is away, never why", async () => {
    const result = await listLeaveCalendar({
      month: "2026-10",
      viewer: { memberId: "member-own", isAdmin: false },
    });
    const [own, other] = result.items;

    expect(own).toMatchObject({
      kind: "sick",
      isOwn: true,
      note: "Influenza",
      attachment: { filename: "igazolas.pdf" },
    });
    expect(other).toMatchObject({ kind: "absent", isOwn: false, note: null, attachment: null });
  });

  it("shows an admin every detail", async () => {
    const result = await listLeaveCalendar({
      month: "2026-10",
      viewer: { memberId: "admin", isAdmin: true },
    });

    expect(result.items.map((item) => item.kind)).toEqual(["sick", "sick"]);
    expect(result.items[1]?.note).toBe("Influenza");
  });

  it("covers the whole calendar grid and skips holidays in the workday count", async () => {
    const result = await listLeaveCalendar({
      month: "2026-10",
      viewer: { memberId: "member-own", isAdmin: false },
    });

    expect(result.gridStart).toBe("2026-09-28");
    expect(result.gridEnd).toBe("2026-11-01");
    // 21, 22, 26, 27 October; the 23rd is a holiday and the 24th-25th a weekend.
    expect(result.items[0]?.workdays).toBe(4);
    expect(result.ownSummary).toEqual({ vacation: 0, sick: 4 });
  });

  it("counts only the part of a leave inside the month in the summary", async () => {
    db.leave.findMany.mockResolvedValue([
      record({
        type: "VACATION",
        startDate: new Date("2026-09-28T00:00:00.000Z"),
        endDate: new Date("2026-10-02T00:00:00.000Z"),
      }),
    ]);

    const result = await listLeaveCalendar({
      month: "2026-10",
      viewer: { memberId: "member-own", isAdmin: false },
    });

    expect(result.items[0]?.workdays).toBe(5);
    expect(result.ownSummary).toEqual({ vacation: 2, sick: 0 });
  });
});

describe("createLeave over logged time", () => {
  const now = new Date("2026-10-01T08:00:00.000Z");
  const input = {
    memberId: "member-own",
    type: "VACATION" as const,
    startDate: "2026-10-12",
    endDate: "2026-10-14",
    dayPart: "FULL" as const,
    note: null,
  };

  beforeEach(() => {
    db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));
    db.member.findFirst.mockResolvedValue({ id: "member-own", timezone: "Europe/Budapest" });
    db.leave.findMany.mockResolvedValue([]);
    db.leave.create.mockResolvedValue({ id: "leave-new" });
    db.timeEntry.findFirst.mockReset();
    db.timeEntry.findFirst.mockResolvedValue(null);
    db.runningTimer.findUnique.mockResolvedValue(null);
  });

  it("refuses a full-day leave over days that already have time", async () => {
    db.timeEntry.findFirst.mockResolvedValue({ id: "entry-1" });

    await expect(createLeave(input, { now })).rejects.toMatchObject({
      code: "TIME_ENTRIES_ON_DAYS",
    });
    expect(db.timeEntry.findFirst).toHaveBeenCalledWith({
      where: {
        memberId: "member-own",
        deletedAt: null,
        source: { not: "DECLARED" },
        localDate: {
          gte: new Date("2026-10-12T00:00:00.000Z"),
          lte: new Date("2026-10-14T00:00:00.000Z"),
        },
      },
      select: { id: true },
    });
    expect(db.leave.create).not.toHaveBeenCalled();
  });

  it("refuses a full-day leave over the day a running timer started", async () => {
    db.runningTimer.findUnique.mockResolvedValue({
      // 00:30 on 13 October in Budapest, still the 12th in UTC.
      startedAt: new Date("2026-10-12T22:30:00.000Z"),
      timezone: "Europe/Budapest",
    });

    await expect(
      createLeave({ ...input, startDate: "2026-10-13", endDate: "2026-10-13" }, { now }),
    ).rejects.toMatchObject({ code: "TIME_ENTRIES_ON_DAYS" });
    expect(db.leave.create).not.toHaveBeenCalled();
  });

  it("records a half day even when the day has time", async () => {
    db.timeEntry.findFirst.mockResolvedValue({ id: "entry-1" });

    await expect(
      createLeave({ ...input, endDate: "2026-10-12", dayPart: "MORNING" }, { now }),
    ).resolves.toMatchObject({ leaveId: "leave-new" });
    expect(db.timeEntry.findFirst).not.toHaveBeenCalled();
  });
});

describe("leave helpers", () => {
  it("starts the allowed range on the 1st of the employee's current month", () => {
    // 23:30 UTC on 31 October is already 1 November in Budapest.
    expect(getLeaveEarliestStartDate("Europe/Budapest", new Date("2026-10-31T23:30:00.000Z"))).toBe(
      "2026-11-01",
    );
  });

  it("keeps the attachment key opaque and filename-safe", () => {
    expect(
      buildLeaveAttachmentKey({
        memberId: "m-1",
        leaveId: "l-1",
        originalFilename: "orvosi papír (1).jpg",
      }),
    ).toMatch(/^sick-notes\/m-1\/l-1\/.+-orvosi-pap-r--1-.jpg$/);
  });

  it("normalizes admin filters and drops anything unrecognised", () => {
    expect(
      normalizeAdminLeaveFilters({
        month: "2026-13",
        member: ["8f14e45f-ceea-467a-9575-12d4e1d0a1b2", "not-an-id"],
        type: ["sick", "holiday"],
        hr: "pending",
        page: "0",
      }),
    ).toEqual({
      month: null,
      memberIds: ["8f14e45f-ceea-467a-9575-12d4e1d0a1b2"],
      types: ["SICK"],
      hr: "pending",
      page: 1,
    });
  });
});
