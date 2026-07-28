import { describe, expect, it, vi } from "vitest";

import { submitContractorTimesheet, TimesheetSubmissionError } from "./submit-timesheet";
import type { TimesheetPreviewRatePeriod } from "./monthly-preview";

type SubmitDeps = NonNullable<Parameters<typeof submitContractorTimesheet>[1]>;

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function rate(overrides: Partial<TimesheetPreviewRatePeriod> = {}): TimesheetPreviewRatePeriod {
  return {
    id: overrides.id ?? "member-rate",
    validFrom: overrides.validFrom ?? dateOnly("2026-07-01"),
    validTo: overrides.validTo ?? null,
    hourlyRate: overrides.hourlyRate ?? "100.00",
    currencyCode: overrides.currencyCode ?? "EUR",
  };
}

function entry(
  overrides: Partial<{
    id: string;
    description: string;
    durationMinutes: number;
    overrideRates: TimesheetPreviewRatePeriod[];
  }> = {},
) {
  const id = overrides.id ?? "entry-1";

  return {
    id,
    memberId: "member-1",
    projectId: id === "entry-2" ? "project-2" : "project-1",
    projectAssignmentId: id === "entry-2" ? "assignment-2" : "assignment-1",
    localDate: dateOnly("2026-07-10"),
    description: overrides.description ?? "Implementation work",
    durationMinutes: overrides.durationMinutes ?? 120,
    lockedByTimesheetRevisionId: null,
    projectAssignment: {
      overrideRates: overrides.overrideRates ?? [],
    },
  };
}

function createSubmitDb(
  overrides: {
    member?: { id: string; currentProfile: "EMPLOYEE" | "CONTRACTOR"; deletedAt: Date | null };
    activeLock?: { id: string } | null;
    existingTimesheet?: {
      id: string;
      status: "REJECTED" | "SUBMITTED" | "APPROVED";
      currentRevisionId: string | null;
      currentRevisionNumber: number;
    } | null;
    memberRates?: TimesheetPreviewRatePeriod[];
    entries?: ReturnType<typeof entry>[];
  } = {},
) {
  const tx = {
    member: {
      findUnique: vi.fn().mockResolvedValue(
        overrides.member ?? {
          id: "member-1",
          currentProfile: "CONTRACTOR",
          deletedAt: null,
        },
      ),
    },
    periodLock: {
      findFirst: vi.fn().mockResolvedValue(overrides.activeLock ?? null),
      create: vi.fn().mockResolvedValue({ id: "lock-1" }),
    },
    timesheet: {
      findUnique: vi.fn().mockResolvedValue(overrides.existingTimesheet ?? null),
      create: vi.fn().mockResolvedValue({
        id: "timesheet-1",
        status: "SUBMITTED",
        currentRevisionId: null,
        currentRevisionNumber: 0,
      }),
      update: vi.fn().mockResolvedValue({ id: "timesheet-1" }),
    },
    memberDefaultRatePeriod: {
      findMany: vi.fn().mockResolvedValue(overrides.memberRates ?? [rate()]),
    },
    timeEntry: {
      findMany: vi.fn().mockResolvedValue(overrides.entries ?? [entry()]),
      updateMany: vi.fn().mockResolvedValue({ count: overrides.entries?.length ?? 1 }),
    },
    timesheetRevision: {
      create: vi.fn().mockResolvedValue({ id: "revision-1", revisionNumber: 1 }),
      update: vi.fn().mockResolvedValue({ id: "revision-old" }),
    },
    timesheetSnapshotLine: {
      createMany: vi.fn().mockResolvedValue({ count: overrides.entries?.length ?? 1 }),
    },
    timesheetEvent: {
      create: vi.fn().mockResolvedValue({ id: "event-1" }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
  };

  return {
    tx,
    db: {
      $transaction: vi.fn((callback) => callback(tx)),
    } as SubmitDeps["db"],
  };
}

describe("timesheet submission", () => {
  it("creates a revision, snapshot, active lock, source-entry locks, event, and audit record", async () => {
    const now = new Date("2026-07-31T12:00:00.000Z");
    const { db, tx } = createSubmitDb({
      entries: [
        entry({ id: "entry-1", durationMinutes: 120 }),
        entry({
          id: "entry-2",
          durationMinutes: 60,
          overrideRates: [rate({ id: "override-rate", hourlyRate: "150.00" })],
        }),
      ],
    });

    const result = await submitContractorTimesheet(
      {
        memberId: "member-1",
        actorMemberId: "member-1",
        periodStart: dateOnly("2026-07-01"),
        requestMetadata: {
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        },
      },
      { db, now },
    );

    expect(result).toEqual({
      timesheetId: "timesheet-1",
      revisionId: "revision-1",
      revisionNumber: 1,
      entryCount: 2,
      totalMinutes: 180,
      totalAmount: "350.00",
      currencyCode: "EUR",
    });
    expect(tx.timesheet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contractorMemberId: "member-1",
          periodStart: dateOnly("2026-07-01"),
          periodEnd: dateOnly("2026-07-31"),
          currencyCode: "EUR",
          status: "SUBMITTED",
          submittedAt: now,
          createdByMemberId: "member-1",
          updatedByMemberId: "member-1",
        }),
      }),
    );
    expect(tx.timesheetRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          timesheetId: "timesheet-1",
          revisionNumber: 1,
          status: "SUBMITTED",
          createdFromRevisionId: null,
          totalMinutes: 180,
          totalAmount: "350.00",
        }),
      }),
    );
    expect(tx.timesheetSnapshotLine.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          sourceTimeEntryId: "entry-1",
          rateSource: "MEMBER_DEFAULT",
          sourceRatePeriodId: "member-rate",
          hourlyRate: "100.00",
          lineAmount: "200.00",
        }),
        expect.objectContaining({
          sourceTimeEntryId: "entry-2",
          rateSource: "PROJECT_OVERRIDE",
          sourceRatePeriodId: "override-rate",
          hourlyRate: "150.00",
          lineAmount: "150.00",
        }),
      ],
    });
    expect(tx.periodLock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          memberId: "member-1",
          periodStart: dateOnly("2026-07-01"),
          timesheetId: "timesheet-1",
          timesheetRevisionId: "revision-1",
          lockedAt: now,
        }),
      }),
    );
    expect(tx.timeEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: {
            in: ["entry-1", "entry-2"],
          },
          lockedByTimesheetRevisionId: null,
        }),
        data: {
          lockedByTimesheetRevisionId: "revision-1",
          updatedByMemberId: "member-1",
        },
      }),
    );
    expect(tx.timesheetEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          timesheetId: "timesheet-1",
          timesheetRevisionId: "revision-1",
          eventType: "SUBMITTED",
          actorMemberId: "member-1",
          metadata: expect.objectContaining({
            periodStart: "2026-07-01",
            periodEnd: "2026-07-31",
            entryCount: 2,
            totalAmount: "350.00",
          }),
        }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorMemberId: "member-1",
          action: "timesheet.submitted",
          targetType: "timesheet",
          targetId: "timesheet-1",
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        }),
      }),
    );
  });

  it("rejects employee profiles", async () => {
    const { db, tx } = createSubmitDb({
      member: {
        id: "member-1",
        currentProfile: "EMPLOYEE",
        deletedAt: null,
      },
    });

    await expect(
      submitContractorTimesheet(
        {
          memberId: "member-1",
          actorMemberId: "member-1",
          periodStart: dateOnly("2026-07-01"),
        },
        { db },
      ),
    ).rejects.toBeInstanceOf(TimesheetSubmissionError);

    expect(tx.timesheet.create).not.toHaveBeenCalled();
  });

  it("rejects entries with missing descriptions", async () => {
    const { db, tx } = createSubmitDb({
      entries: [entry({ description: " " })],
    });

    await expect(
      submitContractorTimesheet(
        {
          memberId: "member-1",
          actorMemberId: "member-1",
          periodStart: dateOnly("2026-07-01"),
        },
        { db },
      ),
    ).rejects.toThrow("Timesheet has entries with missing descriptions.");

    expect(tx.timesheet.create).not.toHaveBeenCalled();
    expect(tx.timesheetSnapshotLine.createMany).not.toHaveBeenCalled();
  });

  it("rejects mixed currencies before writing a timesheet", async () => {
    const { db, tx } = createSubmitDb({
      entries: [
        entry({ id: "entry-1" }),
        entry({
          id: "entry-2",
          overrideRates: [rate({ id: "huf-rate", hourlyRate: "18000.00", currencyCode: "HUF" })],
        }),
      ],
    });

    await expect(
      submitContractorTimesheet(
        {
          memberId: "member-1",
          actorMemberId: "member-1",
          periodStart: dateOnly("2026-07-01"),
        },
        { db },
      ),
    ).rejects.toThrow("Timesheet month contains multiple currencies.");

    expect(tx.timesheet.create).not.toHaveBeenCalled();
    expect(tx.timesheetRevision.create).not.toHaveBeenCalled();
    expect(tx.periodLock.create).not.toHaveBeenCalled();
  });
});
