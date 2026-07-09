import { describe, expect, it, vi } from "vitest";

import {
  copyPreviousDayEntries,
  deleteTimeEntryDraft,
  saveTimeEntryDraft,
  TimeTrackingError,
  type TimeEntryDraftPayload,
} from "./time-entries";

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function createTimeTrackingDb(
  overrides: {
    sourceEntries?: unknown[];
    existingTargetEntries?: unknown[];
    timezone?: string;
  } = {},
) {
  let createdCount = 0;
  const tx = {
    timeEntry: {
      findMany: vi.fn(async (args: { where: { localDate: { in?: Date[] } } }) =>
        args.where.localDate.in
          ? (overrides.existingTargetEntries ?? [])
          : (overrides.sourceEntries ?? []),
      ),
      create: vi.fn(async () => {
        createdCount += 1;
        return { id: `created-entry-${createdCount}` };
      }),
    },
    member: {
      findUnique: vi.fn().mockResolvedValue({ timezone: overrides.timezone ?? "Europe/Budapest" }),
    },
    periodLock: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    projectAssignment: {
      findFirst: vi.fn(
        async (args: { where: { projectId: string } }) =>
          ({
            id: `assignment-${args.where.projectId}`,
            projectId: args.where.projectId,
            project: {
              id: args.where.projectId,
            },
          }) as const,
      ),
    },
    inactiveProjectWeek: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
  };
  const db = {
    $transaction: vi.fn((callback) => callback(tx)),
    timeEntryDraft: {
      upsert: vi.fn().mockResolvedValue({ draftKey: "time-entry-form" }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };

  return { db, tx };
}

const draftPayload: TimeEntryDraftPayload = {
  kind: "time-entry-form",
  version: 1,
  source: "FORM",
  projectId: "project-1",
  localDate: "2026-07-02",
  timingMode: "DURATION",
  durationText: "3h 20m",
  startTime: "09:00",
  endTime: "10:00",
  description: "Implement report filters",
};

describe("time entry services", () => {
  it("skips copy targets that already have entries and copies remaining source entries", async () => {
    const { db, tx } = createTimeTrackingDb({
      sourceEntries: [
        {
          id: "source-1",
          projectId: "project-a",
          projectAssignmentId: "assignment-a",
          localDate: dateOnly("2026-07-01"),
          durationMinutes: 60,
          description: "Already copied",
          startedAt: null,
          endedAt: null,
          timezone: "Europe/Budapest",
        },
        {
          id: "source-2",
          projectId: "project-b",
          projectAssignmentId: "assignment-b",
          localDate: dateOnly("2026-07-01"),
          durationMinutes: 90,
          description: "Copy me",
          startedAt: new Date("2026-07-01T07:00:00.000Z"),
          endedAt: new Date("2026-07-01T08:30:00.000Z"),
          timezone: "Europe/Budapest",
        },
      ],
      existingTargetEntries: [
        {
          projectId: "project-a",
          localDate: dateOnly("2026-07-02"),
        },
      ],
    });

    const result = await copyPreviousDayEntries(
      {
        memberId: "member-1",
        actorMemberId: "member-1",
        targetDate: dateOnly("2026-07-02"),
        requestMetadata: {
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        },
      },
      { db: db as never },
    );

    expect(result).toEqual({
      sourceCount: 2,
      createdCount: 1,
      skippedCount: 1,
    });
    expect(tx.timeEntry.create).toHaveBeenCalledTimes(1);
    expect(tx.timeEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          memberId: "member-1",
          projectId: "project-b",
          projectAssignmentId: "assignment-project-b",
          localDate: dateOnly("2026-07-02"),
          timezone: "Europe/Budapest",
          durationMinutes: 90,
          startedAt: new Date("2026-07-02T07:00:00.000Z"),
          endedAt: new Date("2026-07-02T08:30:00.000Z"),
          description: "Copy me",
          source: "GRID",
        }),
      }),
    );
    expect(tx.projectAssignment.findFirst).toHaveBeenCalledTimes(1);
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "time_entries.copy_previous_day",
          actorMemberId: "member-1",
          after: expect.objectContaining({
            sourceCount: 2,
            createdCount: 1,
            skippedCount: 1,
            createdEntryIds: ["created-entry-1"],
          }),
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        }),
      }),
    );
  });

  it("saves a normalized time entry draft", async () => {
    const { db } = createTimeTrackingDb();

    await expect(
      saveTimeEntryDraft(
        {
          memberId: "member-1",
          draftKey: " time-entry-form ",
          payload: draftPayload,
        },
        { db: db as never },
      ),
    ).resolves.toEqual({ draftKey: "time-entry-form" });

    expect(db.timeEntryDraft.upsert).toHaveBeenCalledWith({
      where: {
        memberId_draftKey: {
          memberId: "member-1",
          draftKey: "time-entry-form",
        },
      },
      create: {
        memberId: "member-1",
        draftKey: "time-entry-form",
        payload: draftPayload,
      },
      update: {
        payload: draftPayload,
      },
      select: {
        draftKey: true,
      },
    });
  });

  it("rejects invalid draft keys before deleting drafts", async () => {
    const { db } = createTimeTrackingDb();

    await expect(
      deleteTimeEntryDraft(
        {
          memberId: "member-1",
          draftKey: "../bad",
        },
        { db: db as never },
      ),
    ).rejects.toBeInstanceOf(TimeTrackingError);

    expect(db.timeEntryDraft.deleteMany).not.toHaveBeenCalled();
  });
});
