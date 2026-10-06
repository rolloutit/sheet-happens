import { describe, expect, it, vi } from "vitest";

import { ReportLinePersistenceError, saveAdminReportLineEdits } from "./report-line-persistence";

const ENTRY_ID = "11111111-1111-4111-8111-111111111111";
const MEMBER_ID = "22222222-2222-4222-8222-222222222222";
const ADMIN_ID = "33333333-3333-4333-8333-333333333333";

function createEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: ENTRY_ID,
    memberId: MEMBER_ID,
    projectId: "44444444-4444-4444-8444-444444444444",
    projectAssignmentId: "55555555-5555-4555-8555-555555555555",
    localDate: new Date("2026-08-18T00:00:00.000Z"),
    durationMinutes: 120,
    description: "Original work",
    startedAt: new Date("2026-08-18T08:00:00.000Z"),
    endedAt: new Date("2026-08-18T10:00:00.000Z"),
    lockedByTimesheetRevisionId: null,
    adminModifiedAt: null,
    adminModifiedByMemberId: null,
    adminModificationReason: null,
    ...overrides,
  };
}

function createDb(entry = createEntry(), dayEntries: Array<Record<string, unknown>> = [entry]) {
  const tx = {
    timeEntry: {
      findMany: vi.fn().mockResolvedValueOnce([entry]).mockResolvedValueOnce(dayEntries),
      update: vi.fn().mockResolvedValue({ id: ENTRY_ID }),
    },
    periodLock: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
  };
  const db = {
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
  };

  return { db, tx };
}

describe("saveAdminReportLineEdits", () => {
  it("persists changed values, provenance, and an audit record", async () => {
    const now = new Date("2026-08-19T10:00:00.000Z");
    const { db, tx } = createDb();

    const result = await saveAdminReportLineEdits(
      {
        actorMemberId: ADMIN_ID,
        edits: [{ id: ENTRY_ID, description: "Corrected work", durationMinutes: 180 }],
        reason: "Customer-approved correction",
        requestMetadata: { requestId: "request-1", ipAddress: "127.0.0.1" },
      },
      { db: db as never, now: () => now },
    );

    expect(result).toEqual({ savedCount: 1, memberIds: [MEMBER_ID] });
    expect(tx.timeEntry.update).toHaveBeenCalledWith({
      where: { id: ENTRY_ID },
      data: {
        description: "Corrected work",
        durationMinutes: 180,
        startedAt: null,
        endedAt: null,
        updatedByMemberId: ADMIN_ID,
        adminModifiedAt: now,
        adminModifiedByMemberId: ADMIN_ID,
        adminModificationReason: "Customer-approved correction",
      },
      select: { id: true },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "time_entry.admin_updated",
          actorMemberId: ADMIN_ID,
          targetId: ENTRY_ID,
          before: expect.objectContaining({ durationMinutes: 120 }),
          after: expect.objectContaining({
            durationMinutes: 180,
            adminModificationReason: "Customer-approved correction",
          }),
        }),
      }),
    );
  });

  it("rejects entries locked by a submitted timesheet", async () => {
    const { db, tx } = createDb(createEntry({ lockedByTimesheetRevisionId: "revision-1" }));

    await expect(
      saveAdminReportLineEdits(
        {
          actorMemberId: ADMIN_ID,
          edits: [{ id: ENTRY_ID, description: "Correction" }],
          reason: "Correction",
        },
        { db: db as never },
      ),
    ).rejects.toMatchObject({ code: "ENTRY_LOCKED" } satisfies Partial<ReportLinePersistenceError>);
    expect(tx.timeEntry.update).not.toHaveBeenCalled();
  });

  it("rejects a batch that would make a member day exceed 24 hours", async () => {
    const entry = createEntry();
    const { db, tx } = createDb(entry, [
      entry,
      createEntry({
        id: "66666666-6666-4666-8666-666666666666",
        durationMinutes: 1_000,
      }),
    ]);

    await expect(
      saveAdminReportLineEdits(
        {
          actorMemberId: ADMIN_ID,
          edits: [{ id: ENTRY_ID, durationMinutes: 500 }],
          reason: "Correction",
        },
        { db: db as never },
      ),
    ).rejects.toMatchObject({
      code: "DAILY_LIMIT_EXCEEDED",
    } satisfies Partial<ReportLinePersistenceError>);
    expect(tx.timeEntry.update).not.toHaveBeenCalled();
  });

  /**
   * §4 item 1, in the narrow form that survives the report filter.
   *
   * The declared line itself is unreachable here — `buildReportTimeEntryWhere` keeps it out of the
   * report entirely — but a **tracked** line dated the 1st of the month is not, and the declared
   * 52 h sitting beside it on that same date would be summed into the day by this query alone. The
   * edit would then fail with `DAILY_LIMIT_EXCEEDED`, about a figure nothing on the screen shows.
   */
  it("ignores declared entries while a tracked line on the same date is edited", async () => {
    const firstOfMonth = new Date("2026-09-01T00:00:00.000Z");
    const tracked = createEntry({ localDate: firstOfMonth, durationMinutes: 120 });
    const { db, tx } = createDb(tracked, [tracked]);

    await saveAdminReportLineEdits(
      {
        actorMemberId: ADMIN_ID,
        edits: [{ id: ENTRY_ID, durationMinutes: 480 }],
        reason: "Correction",
      },
      { db: db as never },
    );

    // The day query, not the entry lookup: the second `findMany` is `assertDailyTotals`.
    const dayQuery = tx.timeEntry.findMany.mock.calls[1]?.[0] as {
      where: { source?: { not?: string } };
    };

    expect(dayQuery.where.source).toEqual({ not: "DECLARED" });
    expect(tx.timeEntry.update).toHaveBeenCalledTimes(1);
  });
});
