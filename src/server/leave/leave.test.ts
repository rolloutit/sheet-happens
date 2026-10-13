import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(async () => []),
  $transaction: vi.fn(),
  member: { findFirst: vi.fn() },
  timeEntry: { findFirst: vi.fn() },
  runningTimer: { findUnique: vi.fn() },
  auditLog: { create: vi.fn() },
  document: { create: vi.fn(), update: vi.fn() },
  leave: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  publicHolidayYear: { findMany: vi.fn(async () => [{ year: 2026 }]) },
  publicHoliday: {
    // Honours the range like the real query, so a lookup that misses the 23rd sees no holiday.
    findMany: vi.fn(async ({ where }: { where?: { date: { gte: Date; lte: Date } } }) =>
      [
        {
          date: new Date("2026-10-23T00:00:00.000Z"),
          localName: "Nemzeti ünnep",
          name: "National day",
        },
      ].filter(({ date }) => !where || (date >= where.date.gte && date <= where.date.lte)),
    ),
  },
}));

vi.mock("@/src/server/db/client", () => ({ prisma: db }));

const {
  buildLeaveAttachmentKey,
  createLeave,
  createLeaveForAdmin,
  getLeaveEarliestStartDate,
  listLeaveCalendar,
  deleteLeaveForAdmin,
  normalizeAdminLeaveFilters,
  updateLeaveForAdmin,
  uploadLeaveAttachment,
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

  it("counts a leave running past the grid against the holidays of its whole range", async () => {
    db.leave.findMany.mockResolvedValue([
      record({
        startDate: new Date("2026-09-30T00:00:00.000Z"),
        endDate: new Date("2026-10-27T00:00:00.000Z"),
      }),
    ]);

    const result = await listLeaveCalendar({
      month: "2026-09",
      viewer: { memberId: "member-own", isAdmin: false },
    });

    // September's grid ends on 4 October, before the holiday on the 23rd.
    expect(result.gridEnd).toBe("2026-10-04");
    expect(result.holidays).toEqual([]);
    expect(result.items[0]?.workdays).toBe(19);
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

describe("createLeaveForAdmin", () => {
  const now = new Date("2026-10-01T08:00:00.000Z");
  const storage = {
    putObject: vi.fn(async ({ key }: { key: string }) => ({ bucket: "leave", key })),
    deleteObject: vi.fn(async () => undefined),
  };
  const input = {
    memberId: "member-own",
    actorMemberId: "member-admin",
    type: "VACATION" as const,
    startDate: "2026-09-14",
    endDate: "2026-09-15",
    dayPart: "FULL" as const,
    note: null,
  };

  beforeEach(() => {
    db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));
    db.member.findFirst.mockResolvedValue({ id: "member-own", timezone: "Europe/Budapest" });
    db.leave.findMany.mockResolvedValue([]);
    db.leave.create.mockReset();
    db.leave.create.mockResolvedValue({ id: "leave-new" });
    db.document.create.mockReset();
    db.document.create.mockResolvedValue({ id: "document-new" });
    db.auditLog.create.mockReset();
    db.timeEntry.findFirst.mockReset();
    db.timeEntry.findFirst.mockResolvedValue(null);
    db.runningTimer.findUnique.mockResolvedValue(null);
  });

  it("records a leave before the employee's current month, which the employee cannot", async () => {
    await expect(createLeave(input, { now })).rejects.toMatchObject({
      code: "BEFORE_CURRENT_MONTH",
    });

    await expect(createLeaveForAdmin(input, { now })).resolves.toEqual({
      leaveId: "leave-new",
      workdays: 2,
    });
  });

  it("records the admin as the author and the employee as the owner", async () => {
    await createLeaveForAdmin(input, { now });

    expect(db.leave.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          memberId: "member-own",
          createdByMemberId: "member-admin",
        }),
      }),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorMemberId: "member-admin",
        action: "leave.created",
        after: expect.objectContaining({ memberId: "member-own", startDate: "2026-09-14" }),
      }),
    });
  });

  it("keeps a sick note with the employee and names the admin as its uploader", async () => {
    await createLeaveForAdmin(
      {
        ...input,
        type: "SICK",
        file: {
          bytes: Buffer.from("%PDF-1.7\nexample"),
          originalFilename: "igazolas.pdf",
          contentType: "application/pdf",
          byteSize: 16,
        },
      },
      { now, storage: storage as never },
    );

    expect(db.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerMemberId: "member-own",
        uploadedByMemberId: "member-admin",
      }),
      select: { id: true },
    });
  });

  it("refuses anyone who is not an active employee", async () => {
    db.member.findFirst.mockResolvedValue(null);

    await expect(createLeaveForAdmin(input, { now })).rejects.toMatchObject({
      code: "EMPLOYEE_REQUIRED",
    });
    expect(db.leave.create).not.toHaveBeenCalled();
  });

  it("still refuses an overlap and days with logged time", async () => {
    db.leave.findMany.mockResolvedValue([
      {
        startDate: new Date("2026-09-15T00:00:00.000Z"),
        endDate: new Date("2026-09-15T00:00:00.000Z"),
        dayPart: "FULL",
      },
    ]);
    await expect(createLeaveForAdmin(input, { now })).rejects.toMatchObject({ code: "OVERLAP" });

    db.leave.findMany.mockResolvedValue([]);
    db.timeEntry.findFirst.mockResolvedValue({ id: "entry-1" });
    await expect(createLeaveForAdmin(input, { now })).rejects.toMatchObject({
      code: "TIME_ENTRIES_ON_DAYS",
    });
    expect(db.leave.create).not.toHaveBeenCalled();
  });
});

describe("a sick note racing an admin edit", () => {
  const storage = {
    putObject: vi.fn(async ({ key }: { key: string }) => ({ bucket: "leave", key })),
    deleteObject: vi.fn(async () => undefined),
  };
  const file = {
    bytes: Buffer.from("%PDF-1.7\nexample"),
    originalFilename: "igazolas.pdf",
    contentType: "application/pdf",
    byteSize: 16,
  };

  beforeEach(() => {
    db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));
    db.leave.findFirst.mockReset();
    db.leave.findMany.mockResolvedValue([]);
    db.leave.findUniqueOrThrow.mockResolvedValue({ attachmentDocument: null });
    db.document.create.mockResolvedValue({ id: "document-new" });
    db.timeEntry.findFirst.mockResolvedValue(null);
    db.runningTimer.findUnique.mockResolvedValue(null);
    storage.deleteObject.mockClear();
  });

  it("refuses the note when the leave became a vacation during the upload", async () => {
    db.leave.findFirst
      .mockResolvedValueOnce({ id: "leave-1", memberId: "member-own", type: "SICK" })
      .mockResolvedValueOnce({ id: "leave-1" });
    db.leave.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      uploadLeaveAttachment(
        { leaveId: "leave-1", viewer: { memberId: "member-own", isAdmin: false }, file },
        { storage: storage as never },
      ),
    ).rejects.toMatchObject({ code: "ATTACHMENT_SICK_ONLY" });
    expect(db.leave.updateMany).toHaveBeenCalledWith({
      where: { id: "leave-1", deletedAt: null, type: "SICK" },
      data: { attachmentDocumentId: "document-new" },
    });
    // The uploaded object is cleaned up rather than left behind as orphaned health data.
    expect(storage.deleteObject).toHaveBeenCalledOnce();
  });

  it("refuses the note when the leave was deleted during the upload", async () => {
    db.leave.findFirst
      .mockResolvedValueOnce({ id: "leave-1", memberId: "member-own", type: "SICK" })
      .mockResolvedValueOnce(null);
    db.leave.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      uploadLeaveAttachment(
        { leaveId: "leave-1", viewer: { memberId: "member-own", isAdmin: false }, file },
        { storage: storage as never },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses a change to vacation when a note arrived after the check", async () => {
    db.leave.findFirst
      .mockResolvedValueOnce({
        id: "leave-1",
        memberId: "member-own",
        type: "SICK",
        startDate: new Date("2026-10-12T00:00:00.000Z"),
        endDate: new Date("2026-10-12T00:00:00.000Z"),
        dayPart: "FULL",
        note: null,
        attachmentDocumentId: null,
      })
      .mockResolvedValueOnce({ id: "leave-1" });
    db.leave.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      updateLeaveForAdmin({
        leaveId: "leave-1",
        actorMemberId: "admin",
        type: "VACATION",
        startDate: "2026-10-12",
        endDate: "2026-10-12",
        dayPart: "FULL",
        note: null,
      }),
    ).rejects.toMatchObject({ code: "SICK_NOTE_ATTACHED" });
    expect(db.leave.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "leave-1", deletedAt: null, attachmentDocumentId: null },
      }),
    );
  });
});

describe("deleteLeaveForAdmin", () => {
  const storage = { deleteObject: vi.fn(async () => undefined) };

  beforeEach(() => {
    db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));
    db.leave.findFirst.mockReset();
    db.leave.findFirst.mockResolvedValue({
      id: "leave-1",
      memberId: "member-own",
      type: "SICK",
      startDate: new Date("2026-10-12T00:00:00.000Z"),
      endDate: new Date("2026-10-12T00:00:00.000Z"),
      dayPart: "FULL",
      note: null,
    });
    db.document.update.mockClear();
    storage.deleteObject.mockClear();
  });

  it("takes the sick note down with the leave", async () => {
    db.leave.update.mockResolvedValue({
      attachmentDocument: { id: "document-1", storageBucket: "leave", storageKey: "sick-notes/a" },
    });

    await deleteLeaveForAdmin(
      { leaveId: "leave-1", actorMemberId: "admin" },
      { storage: storage as never },
    );

    expect(db.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "document-1" },
        data: expect.objectContaining({ status: "DELETED", deletedByMemberId: "admin" }),
      }),
    );
    expect(storage.deleteObject).toHaveBeenCalledWith({ bucket: "leave", key: "sick-notes/a" });
  });

  it("touches no document when the leave had no note", async () => {
    db.leave.update.mockResolvedValue({ attachmentDocument: null });

    await deleteLeaveForAdmin(
      { leaveId: "leave-1", actorMemberId: "admin" },
      { storage: storage as never },
    );

    expect(db.document.update).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
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
