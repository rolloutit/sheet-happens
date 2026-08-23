import type { ReportLineEdit } from "@/src/lib/report-line-edits";
import { prisma } from "@/src/server/db/client";
import { Prisma } from "@/src/server/db/generated/client";

export type ReportLinePersistenceRequestMetadata = {
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type SaveAdminReportLineEditsInput = {
  actorMemberId: string;
  edits: ReportLineEdit[];
  reason: string;
  requestMetadata?: ReportLinePersistenceRequestMetadata;
};

export type ReportLinePersistenceErrorCode =
  | "EMPTY_REASON"
  | "ENTRY_NOT_FOUND"
  | "ENTRY_LOCKED"
  | "INVALID_DESCRIPTION"
  | "INVALID_DURATION"
  | "DAILY_LIMIT_EXCEEDED";

export class ReportLinePersistenceError extends Error {
  constructor(
    readonly code: ReportLinePersistenceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ReportLinePersistenceError";
  }
}

type ReportLinePersistenceDb = typeof prisma;

const MAX_REASON_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 1_000;
const MAX_DURATION_MINUTES = 24 * 60;

export async function saveAdminReportLineEdits(
  input: SaveAdminReportLineEditsInput,
  deps: { db?: ReportLinePersistenceDb; now?: () => Date } = {},
) {
  const db = deps.db ?? prisma;
  const now = deps.now?.() ?? new Date();
  const reason = input.reason.trim();

  if (!reason || reason.length > MAX_REASON_LENGTH) {
    throw new ReportLinePersistenceError("EMPTY_REASON", "A valid correction reason is required.");
  }

  const edits = normalizeEdits(input.edits);
  if (edits.length === 0) return { savedCount: 0, memberIds: [] as string[] };

  return db.$transaction(
    async (tx) => {
      const entries = await tx.timeEntry.findMany({
        where: {
          id: { in: edits.map((edit) => edit.id) },
          deletedAt: null,
        },
        select: {
          id: true,
          memberId: true,
          projectId: true,
          projectAssignmentId: true,
          localDate: true,
          durationMinutes: true,
          description: true,
          startedAt: true,
          endedAt: true,
          lockedByTimesheetRevisionId: true,
          adminModifiedAt: true,
          adminModifiedByMemberId: true,
          adminModificationReason: true,
        },
      });

      if (entries.length !== edits.length) {
        throw new ReportLinePersistenceError(
          "ENTRY_NOT_FOUND",
          "One or more time entries no longer exist.",
        );
      }

      const editsById = new Map(edits.map((edit) => [edit.id, edit]));
      const changedEntries = entries
        .map((entry) => {
          const edit = editsById.get(entry.id);
          if (!edit) return null;

          const description = edit.description ?? entry.description;
          const durationMinutes = edit.durationMinutes ?? entry.durationMinutes;
          const durationChanged = durationMinutes !== entry.durationMinutes;

          if (description === entry.description && !durationChanged) return null;

          return { entry, description, durationMinutes, durationChanged };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

      if (changedEntries.length === 0) {
        return { savedCount: 0, memberIds: [] as string[] };
      }

      if (changedEntries.some(({ entry }) => entry.lockedByTimesheetRevisionId)) {
        throw new ReportLinePersistenceError(
          "ENTRY_LOCKED",
          "A submitted timesheet locks one or more selected entries.",
        );
      }

      await assertPeriodsOpen(tx, changedEntries);
      await assertDailyTotals(tx, changedEntries);

      for (const { entry, description, durationMinutes, durationChanged } of changedEntries) {
        const before = serializeEntry(entry);

        await tx.timeEntry.update({
          where: { id: entry.id },
          data: {
            description,
            durationMinutes,
            startedAt: durationChanged ? null : entry.startedAt,
            endedAt: durationChanged ? null : entry.endedAt,
            updatedByMemberId: input.actorMemberId,
            adminModifiedAt: now,
            adminModifiedByMemberId: input.actorMemberId,
            adminModificationReason: reason,
          },
          select: { id: true },
        });

        await tx.auditLog.create({
          data: {
            actorMemberId: input.actorMemberId,
            action: "time_entry.admin_updated",
            targetType: "time_entry",
            targetId: entry.id,
            before,
            after: {
              ...before,
              description,
              durationMinutes,
              startedAt: durationChanged ? null : (entry.startedAt?.toISOString() ?? null),
              endedAt: durationChanged ? null : (entry.endedAt?.toISOString() ?? null),
              adminModifiedAt: now.toISOString(),
              adminModifiedByMemberId: input.actorMemberId,
              adminModificationReason: reason,
            },
            ...input.requestMetadata,
          },
        });
      }

      return {
        savedCount: changedEntries.length,
        memberIds: [...new Set(changedEntries.map(({ entry }) => entry.memberId))],
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

function normalizeEdits(edits: ReportLineEdit[]) {
  const normalized = new Map<string, ReportLineEdit>();

  for (const edit of edits) {
    if (!edit.id) continue;

    const next: ReportLineEdit = { id: edit.id };

    if (edit.description !== undefined) {
      const description = edit.description.trim();
      if (!description || description.length > MAX_DESCRIPTION_LENGTH) {
        throw new ReportLinePersistenceError(
          "INVALID_DESCRIPTION",
          "Descriptions must be between 1 and 1,000 characters.",
        );
      }
      next.description = description;
    }

    if (edit.durationMinutes !== undefined) {
      if (
        !Number.isInteger(edit.durationMinutes) ||
        edit.durationMinutes <= 0 ||
        edit.durationMinutes > MAX_DURATION_MINUTES
      ) {
        throw new ReportLinePersistenceError(
          "INVALID_DURATION",
          "Durations must be between 1 minute and 24 hours.",
        );
      }
      next.durationMinutes = edit.durationMinutes;
    }

    if (next.description !== undefined || next.durationMinutes !== undefined) {
      normalized.set(next.id, next);
    }
  }

  return [...normalized.values()];
}

async function assertPeriodsOpen(
  tx: Prisma.TransactionClient,
  changedEntries: Array<{ entry: { memberId: string; localDate: Date } }>,
) {
  const periods = new Map<string, { memberId: string; periodStart: Date }>();

  for (const { entry } of changedEntries) {
    const periodStart = new Date(
      Date.UTC(entry.localDate.getUTCFullYear(), entry.localDate.getUTCMonth(), 1),
    );
    periods.set(`${entry.memberId}:${periodStart.toISOString()}`, {
      memberId: entry.memberId,
      periodStart,
    });
  }

  const locks = await tx.periodLock.findMany({
    where: {
      unlockedAt: null,
      OR: [...periods.values()],
    },
    select: { id: true },
  });

  if (locks.length > 0) {
    throw new ReportLinePersistenceError(
      "ENTRY_LOCKED",
      "A submitted timesheet locks one or more selected entries.",
    );
  }
}

async function assertDailyTotals(
  tx: Prisma.TransactionClient,
  changedEntries: Array<{
    entry: { id: string; memberId: string; localDate: Date };
    durationMinutes: number;
  }>,
) {
  const days = new Map<string, { memberId: string; localDate: Date }>();

  for (const { entry } of changedEntries) {
    days.set(dayKey(entry.memberId, entry.localDate), {
      memberId: entry.memberId,
      localDate: entry.localDate,
    });
  }

  const dayEntries = await tx.timeEntry.findMany({
    where: {
      deletedAt: null,
      OR: [...days.values()],
    },
    select: {
      id: true,
      memberId: true,
      localDate: true,
      durationMinutes: true,
    },
  });
  const changedDurationById = new Map(
    changedEntries.map(({ entry, durationMinutes }) => [entry.id, durationMinutes]),
  );
  const totals = new Map<string, number>();

  for (const entry of dayEntries) {
    const key = dayKey(entry.memberId, entry.localDate);
    totals.set(
      key,
      (totals.get(key) ?? 0) + (changedDurationById.get(entry.id) ?? entry.durationMinutes),
    );
  }

  if ([...totals.values()].some((total) => total > MAX_DURATION_MINUTES)) {
    throw new ReportLinePersistenceError(
      "DAILY_LIMIT_EXCEEDED",
      "A corrected day would contain more than 24 hours.",
    );
  }
}

function dayKey(memberId: string, localDate: Date) {
  return `${memberId}:${localDate.toISOString().slice(0, 10)}`;
}

function serializeEntry(entry: {
  memberId: string;
  projectId: string;
  projectAssignmentId: string;
  localDate: Date;
  durationMinutes: number;
  description: string;
  startedAt: Date | null;
  endedAt: Date | null;
  adminModifiedAt: Date | null;
  adminModifiedByMemberId: string | null;
  adminModificationReason: string | null;
}) {
  return {
    memberId: entry.memberId,
    projectId: entry.projectId,
    projectAssignmentId: entry.projectAssignmentId,
    localDate: entry.localDate.toISOString().slice(0, 10),
    durationMinutes: entry.durationMinutes,
    description: entry.description,
    startedAt: entry.startedAt?.toISOString() ?? null,
    endedAt: entry.endedAt?.toISOString() ?? null,
    adminModifiedAt: entry.adminModifiedAt?.toISOString() ?? null,
    adminModifiedByMemberId: entry.adminModifiedByMemberId,
    adminModificationReason: entry.adminModificationReason,
  };
}
