import { createHash, randomUUID } from "node:crypto";

import { prisma } from "@/src/server/db/client";
import { getObjectStorage, type ObjectStorage } from "@/src/server/storage";

import { formatDateOnly, getMonthEnd, getMonthStart, normalizeDateOnly } from "./dates";
import { resolveTrackingMode } from "./tracking-mode";
import type { TimeTrackingRequestMetadata } from "./time-entries";

/**
 * The declared-hours write path: one figure per member, project and month, plus its proof.
 *
 * **Every save materializes or updates exactly one `TimeEntry`** in the same transaction —
 * `source = DECLARED`, `localDate = periodStart`, `description = note` — which is what lets the
 * whole financial chain (submission, locking, rate resolution, the admin review, invoice
 * comparison) keep reading `TimeEntry` unchanged. §3 of `docs/time-view-zoom-axis.md` has the full
 * argument; the short version is that `TimesheetSnapshotLine.sourceTimeEntryId` is not nullable, so
 * a parallel source would make the immutable snapshot polymorphic.
 *
 * **This is why the entry is written here rather than through `createTimeEntry`.** That path
 * enforces `DAILY_HARD_LIMIT_MINUTES` (24 h) per entry and per day, in five places. A 52-hour
 * declaration is 3 120 minutes and fails both — correctly, for a day of work, and meaninglessly for
 * a month of it. The implausible-figure check a monthly aggregate actually deserves is
 * {@link resolveDeclarationSanityLimit}: 24 h × days in the month, and a **warning rather than a
 * block**, consistent with how this app treats every other data-quality signal.
 *
 * The declaration row exists beside the entry rather than being skipped because it carries what the
 * entry cannot: the proof document, the one-number-per-month key
 * (`@@unique([memberId, projectId, periodStart])`), and its own audit trail.
 */

/** Under the 12 MB Server Action body limit, and the same ceiling payslips use. */
export const HOURS_PROOF_MAX_BYTES = 10 * 1024 * 1024;

export type DeclarationErrorCode =
  | "INVALID_PERIOD"
  | "INVALID_MINUTES"
  | "NOTE_REQUIRED"
  | "PERIOD_LOCKED"
  | "ASSIGNMENT_NOT_FOUND"
  | "NOT_DECLARED"
  | "TRACKED_ENTRIES_EXIST"
  | "DECLARATION_NOT_FOUND"
  | "REASON_REQUIRED"
  | "PROOF_REQUIRED"
  | "PROOF_TOO_LARGE"
  | "PROOF_NOT_PDF";

export class DeclarationError extends Error {
  readonly code: DeclarationErrorCode;

  constructor(code: DeclarationErrorCode, message: string) {
    super(message);
    this.name = "DeclarationError";
    this.code = code;
  }
}

export type DeclarationProofFileInput = {
  bytes: Buffer;
  originalFilename: string;
  contentType: string;
  byteSize: number;
};

export type SaveMonthlyHourDeclarationInput = {
  memberId: string;
  actorMemberId: string;
  projectId: string;
  /** Any day of the month; normalized to the 1st, which is where the entry is dated. */
  periodStart: Date;
  minutes: number;
  note: string;
  /**
   * An admin correcting someone else's figure. Records `adminModified*` on both records and writes
   * the audit row the notification dispatcher reads — see {@link ADMIN_AUDIT_ACTION}.
   */
  adminModificationReason?: string | null;
  requestMetadata?: TimeTrackingRequestMetadata;
};

export type DeleteMonthlyHourDeclarationInput = {
  memberId: string;
  actorMemberId: string;
  projectId: string;
  periodStart: Date;
  requestMetadata?: TimeTrackingRequestMetadata;
};

export type UploadDeclarationProofInput = {
  memberId: string;
  actorMemberId: string;
  projectId: string;
  periodStart: Date;
  file: DeclarationProofFileInput;
  requestMetadata?: TimeTrackingRequestMetadata;
};

export type SaveMonthlyHourDeclarationResult = {
  declarationId: string;
  timeEntryId: string;
  created: boolean;
};

/**
 * The audit action an admin correction is written under.
 *
 * Deliberately the **time entry's** action rather than a declaration-shaped one. The notification
 * dispatcher selects audit rows through an explicit allowlist and maps anything non-`payslip.*` to
 * `TIME_ENTRY_ADMIN_MODIFIED`; a new action name would be dropped silently — no error, no
 * notification. A declaration *is* a materialized time entry, its `targetId` is that entry, and the
 * notification's `/time` action URL is already where the member would go to look, so reusing the
 * action is both the honest description and the one that works. The dispatcher also skips any row
 * whose merged payload names no member, which is why `memberId` is written into `after`.
 */
const ADMIN_AUDIT_ACTION = "time_entry.admin_updated";

/**
 * The implausible-figure bound: 24 h × days in the month.
 *
 * A **warning, not a block** (§4). The app already treats over-24h days, overlaps and future dates
 * as data-quality signals rather than database constraints, and a declared figure is copied from
 * another company's system — refusing it would leave a member unable to record what they were
 * actually paid for.
 */
export function resolveDeclarationSanityLimit(periodStart: Date) {
  const monthStart = getMonthStart(normalizeDateOnly(periodStart));

  return getMonthEnd(monthStart).getUTCDate() * 24 * 60;
}

export function isDeclarationImplausible(minutes: number, periodStart: Date) {
  return minutes > resolveDeclarationSanityLimit(periodStart);
}

export function validateHoursProofFile(file: DeclarationProofFileInput) {
  if (file.byteSize <= 0) {
    throw new DeclarationError("PROOF_REQUIRED", "An hours proof PDF is required.");
  }

  if (file.byteSize > HOURS_PROOF_MAX_BYTES) {
    throw new DeclarationError("PROOF_TOO_LARGE", "The hours proof PDF is too large.");
  }

  if (file.contentType !== "application/pdf") {
    throw new DeclarationError("PROOF_NOT_PDF", "The hours proof must be a PDF.");
  }

  if (!file.originalFilename.toLowerCase().endsWith(".pdf")) {
    throw new DeclarationError("PROOF_NOT_PDF", "The hours proof must be a PDF.");
  }

  /* The extension and the declared content type are both client-supplied. The magic bytes are the
     only part of this check the browser does not choose, so it is the one that matters. */
  if (!file.bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new DeclarationError("PROOF_NOT_PDF", "The hours proof must be a PDF.");
  }
}

export function buildHoursProofObjectKey(input: {
  memberId: string;
  periodStart: Date;
  originalFilename: string;
}) {
  return [
    "hours-proofs",
    input.memberId,
    formatDateOnly(getMonthStart(normalizeDateOnly(input.periodStart))),
    `${randomUUID()}-${sanitizeFilename(input.originalFilename)}`,
  ].join("/");
}

/**
 * Create or correct one month's declared figure.
 *
 * Editing updates the **same** entry rather than writing a second one, which is what keeps the
 * month from double-counting after a correction and what makes the `@@unique` key meaningful.
 */
export async function saveMonthlyHourDeclaration(
  input: SaveMonthlyHourDeclarationInput,
  deps: { db?: typeof prisma; now?: Date } = {},
): Promise<SaveMonthlyHourDeclarationResult> {
  const db = deps.db ?? prisma;
  const now = deps.now ?? new Date();
  const periodStart = normalizePeriodStart(input.periodStart);
  const periodEnd = getMonthEnd(periodStart);
  const minutes = normalizeDeclaredMinutes(input.minutes);
  const note = normalizeNote(input.note);
  const byAdmin = input.actorMemberId !== input.memberId;
  const reason = input.adminModificationReason?.trim() ?? "";

  if (byAdmin && !reason) {
    throw new DeclarationError("REASON_REQUIRED", "An admin correction needs a reason.");
  }

  return db.$transaction(async (tx) => {
    await assertMonthOpen(tx, input.memberId, periodStart);

    const assignment = await findDeclaredAssignmentForMonth(tx, {
      memberId: input.memberId,
      projectId: input.projectId,
      periodStart,
      periodEnd,
    });

    /* The other half of the double-count guard. The ordinary write paths refuse a declared
       assignment (`time-entries.ts`), and this refuses a month that already holds their output —
       which is what a mode switched after the fact would leave behind. */
    const trackedEntryCount = await tx.timeEntry.count({
      where: {
        memberId: input.memberId,
        projectId: input.projectId,
        deletedAt: null,
        source: {
          not: "DECLARED",
        },
        localDate: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });

    if (trackedEntryCount > 0) {
      throw new DeclarationError(
        "TRACKED_ENTRIES_EXIST",
        "This month already holds tracked time entries for this project.",
      );
    }

    const timezone = await getMemberTimezone(tx, input.memberId);
    const existing = await tx.monthlyHourDeclaration.findUnique({
      where: {
        memberId_projectId_periodStart: {
          memberId: input.memberId,
          projectId: input.projectId,
          periodStart,
        },
      },
      select: {
        id: true,
        minutes: true,
        note: true,
        timeEntryId: true,
        timeEntry: {
          select: {
            id: true,
            durationMinutes: true,
            description: true,
            deletedAt: true,
            lockedByTimesheetRevisionId: true,
          },
        },
      },
    });

    if (existing?.timeEntry.lockedByTimesheetRevisionId) {
      throw new DeclarationError(
        "PERIOD_LOCKED",
        "This declaration is locked by a submitted timesheet.",
      );
    }

    const adminFields = byAdmin
      ? {
          adminModifiedAt: now,
          adminModifiedByMemberId: input.actorMemberId,
          adminModificationReason: reason,
        }
      : {};

    if (existing) {
      await tx.timeEntry.update({
        where: {
          id: existing.timeEntryId,
        },
        data: {
          projectAssignmentId: assignment.id,
          durationMinutes: minutes,
          description: note,
          // A withdrawn declaration soft-deletes its entry; re-declaring the same month has to
          // bring that same entry back rather than orphan it behind a new one.
          deletedAt: null,
          updatedByMemberId: input.actorMemberId,
          ...adminFields,
        },
        select: {
          id: true,
        },
      });

      await tx.monthlyHourDeclaration.update({
        where: {
          id: existing.id,
        },
        data: {
          projectAssignmentId: assignment.id,
          periodEnd,
          minutes,
          note,
          timezone,
          updatedByMemberId: input.actorMemberId,
          ...adminFields,
        },
        select: {
          id: true,
        },
      });

      await writeDeclarationAudit(tx, {
        input,
        byAdmin,
        reason,
        declarationId: existing.id,
        timeEntryId: existing.timeEntryId,
        periodStart,
        action: "hours_declaration.updated",
        before: {
          minutes: existing.minutes,
          note: existing.note,
        },
        after: {
          minutes,
          note,
        },
      });

      return {
        declarationId: existing.id,
        timeEntryId: existing.timeEntryId,
        created: false,
      };
    }

    // The entry first: `MonthlyHourDeclaration.timeEntryId` is non-nullable, so the declaration
    // cannot exist before the row it points at.
    const timeEntry = await tx.timeEntry.create({
      data: {
        memberId: input.memberId,
        projectId: input.projectId,
        projectAssignmentId: assignment.id,
        localDate: periodStart,
        timezone,
        durationMinutes: minutes,
        description: note,
        source: "DECLARED",
        createdByMemberId: input.actorMemberId,
        updatedByMemberId: input.actorMemberId,
        ...adminFields,
      },
      select: {
        id: true,
      },
    });

    const declaration = await tx.monthlyHourDeclaration.create({
      data: {
        memberId: input.memberId,
        projectId: input.projectId,
        projectAssignmentId: assignment.id,
        periodStart,
        periodEnd,
        minutes,
        note,
        timezone,
        timeEntryId: timeEntry.id,
        createdByMemberId: input.actorMemberId,
        updatedByMemberId: input.actorMemberId,
        ...adminFields,
      },
      select: {
        id: true,
      },
    });

    await writeDeclarationAudit(tx, {
      input,
      byAdmin,
      reason,
      declarationId: declaration.id,
      timeEntryId: timeEntry.id,
      periodStart,
      action: "hours_declaration.created",
      before: null,
      after: {
        minutes,
        note,
      },
    });

    return {
      declarationId: declaration.id,
      timeEntryId: timeEntry.id,
      created: true,
    };
  });
}

/**
 * Withdraw a month's declaration.
 *
 * The declaration row goes and its entry is **soft**-deleted. Hard-deleting the entry is not an
 * option — `TimesheetSnapshotLine.sourceTimeEntryId` restricts it once a revision has snapshotted
 * the month — and the declaration row has to go rather than be flagged, because
 * `@@unique([memberId, projectId, periodStart])` has to be free again for a re-declaration.
 */
export async function deleteMonthlyHourDeclaration(
  input: DeleteMonthlyHourDeclarationInput,
  deps: { db?: typeof prisma; now?: Date } = {},
) {
  const db = deps.db ?? prisma;
  const now = deps.now ?? new Date();
  const periodStart = normalizePeriodStart(input.periodStart);

  return db.$transaction(async (tx) => {
    await assertMonthOpen(tx, input.memberId, periodStart);

    const declaration = await tx.monthlyHourDeclaration.findUnique({
      where: {
        memberId_projectId_periodStart: {
          memberId: input.memberId,
          projectId: input.projectId,
          periodStart,
        },
      },
      select: {
        id: true,
        minutes: true,
        note: true,
        timeEntryId: true,
        proofDocumentId: true,
        timeEntry: {
          select: {
            lockedByTimesheetRevisionId: true,
          },
        },
      },
    });

    if (!declaration) {
      throw new DeclarationError("DECLARATION_NOT_FOUND", "No declaration exists for this month.");
    }

    if (declaration.timeEntry.lockedByTimesheetRevisionId) {
      throw new DeclarationError(
        "PERIOD_LOCKED",
        "This declaration is locked by a submitted timesheet.",
      );
    }

    // The declaration first: it holds `Restrict` foreign keys onto both the entry and the proof
    // document, so nothing it points at can be touched while the row still exists.
    await tx.monthlyHourDeclaration.delete({
      where: {
        id: declaration.id,
      },
      select: {
        id: true,
      },
    });

    if (declaration.proofDocumentId) {
      await tx.document.update({
        where: {
          id: declaration.proofDocumentId,
        },
        data: {
          status: "DELETED",
          deletedAt: now,
          deletedByMemberId: input.actorMemberId,
        },
        select: {
          id: true,
        },
      });
    }

    await tx.timeEntry.update({
      where: {
        id: declaration.timeEntryId,
      },
      data: {
        deletedAt: now,
        updatedByMemberId: input.actorMemberId,
      },
      select: {
        id: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "hours_declaration.deleted",
        targetType: "hours_declaration",
        targetId: declaration.id,
        before: {
          memberId: input.memberId,
          projectId: input.projectId,
          periodStart: formatDateOnly(periodStart),
          minutes: declaration.minutes,
          note: declaration.note,
          timeEntryId: declaration.timeEntryId,
        },
        after: {
          memberId: input.memberId,
          deletedAt: now.toISOString(),
        },
        ...input.requestMetadata,
      },
    });

    return {
      declarationId: declaration.id,
      timeEntryId: declaration.timeEntryId,
    };
  });
}

/**
 * Attach or replace the proof PDF for a month's declaration.
 *
 * Follows `uploadPayslip` exactly: validate, put the object, *then* transact, and delete the
 * orphaned object if the transaction fails. Ordering it that way is what keeps a half-written
 * document row out of the database; the cost is an object with no row, which the catch cleans up.
 */
export async function uploadDeclarationProof(
  input: UploadDeclarationProofInput,
  deps: { db?: typeof prisma; storage?: ObjectStorage; now?: Date } = {},
) {
  const db = deps.db ?? prisma;
  const now = deps.now ?? new Date();
  const storage = deps.storage ?? getObjectStorage();
  const periodStart = normalizePeriodStart(input.periodStart);

  validateHoursProofFile(input.file);

  const declaration = await db.monthlyHourDeclaration.findUnique({
    where: {
      memberId_projectId_periodStart: {
        memberId: input.memberId,
        projectId: input.projectId,
        periodStart,
      },
    },
    select: {
      id: true,
      proofDocumentId: true,
      timeEntry: {
        select: {
          lockedByTimesheetRevisionId: true,
        },
      },
    },
  });

  if (!declaration) {
    throw new DeclarationError("DECLARATION_NOT_FOUND", "Declare the hours before the proof.");
  }

  if (declaration.timeEntry.lockedByTimesheetRevisionId) {
    throw new DeclarationError(
      "PERIOD_LOCKED",
      "This declaration is locked by a submitted timesheet.",
    );
  }

  const checksumSha256 = createHash("sha256").update(input.file.bytes).digest("hex");
  const objectRef = await storage.putObject({
    key: buildHoursProofObjectKey({
      memberId: input.memberId,
      periodStart,
      originalFilename: input.file.originalFilename,
    }),
    body: input.file.bytes,
    contentType: "application/pdf",
    byteSize: input.file.byteSize,
    checksumSha256,
  });

  try {
    const result = await db.$transaction(async (tx) => {
      await assertMonthOpen(tx, input.memberId, periodStart);

      const current = await tx.monthlyHourDeclaration.findUnique({
        where: {
          id: declaration.id,
        },
        select: {
          id: true,
          proofDocumentId: true,
          proofDocument: {
            select: {
              storageBucket: true,
              storageKey: true,
              originalFilename: true,
            },
          },
        },
      });

      if (!current) {
        throw new DeclarationError(
          "DECLARATION_NOT_FOUND",
          "No declaration exists for this month.",
        );
      }

      const document = await tx.document.create({
        data: {
          type: "HOURS_PROOF",
          status: "AVAILABLE",
          ownerMemberId: input.memberId,
          storageBucket: objectRef.bucket,
          storageKey: objectRef.key,
          originalFilename: input.file.originalFilename,
          contentType: "application/pdf",
          byteSize: BigInt(input.file.byteSize),
          checksumSha256,
          uploadedByMemberId: input.actorMemberId,
          createdAt: now,
        },
        select: {
          id: true,
        },
      });

      await tx.monthlyHourDeclaration.update({
        where: {
          id: current.id,
        },
        data: {
          proofDocumentId: document.id,
          updatedByMemberId: input.actorMemberId,
        },
        select: {
          id: true,
        },
      });

      if (current.proofDocumentId) {
        await tx.document.update({
          where: {
            id: current.proofDocumentId,
          },
          data: {
            status: "DELETED",
            deletedAt: now,
            deletedByMemberId: input.actorMemberId,
          },
          select: {
            id: true,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorMemberId: input.actorMemberId,
          action: current.proofDocumentId
            ? "hours_declaration.proof_replaced"
            : "hours_declaration.proof_uploaded",
          targetType: "hours_declaration",
          targetId: current.id,
          after: {
            memberId: input.memberId,
            projectId: input.projectId,
            periodStart: formatDateOnly(periodStart),
            documentId: document.id,
            storageKey: objectRef.key,
            originalFilename: input.file.originalFilename,
            byteSize: input.file.byteSize,
            checksumSha256,
            replacesDocumentId: current.proofDocumentId,
          },
          ...input.requestMetadata,
          createdAt: now,
        },
      });

      return {
        declarationId: current.id,
        documentId: document.id,
        previousObject: current.proofDocument ?? null,
        replaced: Boolean(current.proofDocumentId),
      };
    });

    if (result.previousObject) {
      await storage
        .deleteObject({
          bucket: result.previousObject.storageBucket,
          key: result.previousObject.storageKey,
        })
        .catch(() => undefined);
    }

    return result;
  } catch (error) {
    await storage.deleteObject(objectRef).catch(() => undefined);
    throw error;
  }
}

type DeclarationTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function normalizePeriodStart(value: Date) {
  if (Number.isNaN(value.getTime())) {
    throw new DeclarationError("INVALID_PERIOD", "Choose a valid month.");
  }

  return getMonthStart(normalizeDateOnly(value));
}

function normalizeDeclaredMinutes(value: number) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new DeclarationError("INVALID_MINUTES", "Declared hours must be greater than zero.");
  }

  return value;
}

/**
 * The note is a **submission precondition**, not a nicety: it becomes the entry's `description`,
 * and `submit-timesheet.ts` rejects any entry without one. It is also copied verbatim into the
 * immutable snapshot and the PDF, which is why it is written by a human and never generated.
 */
function normalizeNote(value: string) {
  const note = value.trim();

  if (!note) {
    throw new DeclarationError("NOTE_REQUIRED", "Describe what the declared hours cover.");
  }

  return note.slice(0, 1_000);
}

async function assertMonthOpen(tx: DeclarationTransaction, memberId: string, periodStart: Date) {
  const lock = await tx.periodLock.findFirst({
    where: {
      memberId,
      periodStart,
      unlockedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (lock) {
    throw new DeclarationError("PERIOD_LOCKED", "This period is locked by a submitted timesheet.");
  }
}

/**
 * The assignment a month's figure belongs to.
 *
 * Any assignment **overlapping** the month, not one valid on the 1st: an assignment starting on the
 * 10th still earns the month's declaration, and the entry is still dated the 1st because that is
 * what makes rate resolution deterministic (§3). The later-starting period wins when a project has
 * two inside one month, which is the same row `buildMonthOverview` collapses to.
 */
async function findDeclaredAssignmentForMonth(
  tx: DeclarationTransaction,
  input: {
    memberId: string;
    projectId: string;
    periodStart: Date;
    periodEnd: Date;
  },
) {
  const assignment = await tx.projectAssignment.findFirst({
    where: {
      memberId: input.memberId,
      projectId: input.projectId,
      active: true,
      validFrom: {
        lte: input.periodEnd,
      },
      OR: [{ validTo: null }, { validTo: { gte: input.periodStart } }],
      project: {
        deletedAt: null,
        status: "ACTIVE",
      },
    },
    orderBy: {
      validFrom: "desc",
    },
    select: {
      id: true,
      trackingMode: true,
      member: {
        select: {
          defaultTrackingMode: true,
        },
      },
    },
  });

  if (!assignment) {
    throw new DeclarationError(
      "ASSIGNMENT_NOT_FOUND",
      "This project is not assigned for the selected month.",
    );
  }

  if (resolveTrackingMode(assignment.member, assignment).mode !== "DECLARED") {
    throw new DeclarationError(
      "NOT_DECLARED",
      "This project tracks hours in Sheet Happens, so it cannot be declared.",
    );
  }

  return assignment;
}

async function getMemberTimezone(tx: DeclarationTransaction, memberId: string) {
  const member = await tx.member.findUnique({
    where: {
      id: memberId,
    },
    select: {
      timezone: true,
    },
  });

  return member?.timezone ?? "Europe/Budapest";
}

async function writeDeclarationAudit(
  tx: DeclarationTransaction,
  input: {
    input: SaveMonthlyHourDeclarationInput;
    byAdmin: boolean;
    reason: string;
    declarationId: string;
    timeEntryId: string;
    periodStart: Date;
    action: string;
    before: { minutes: number; note: string } | null;
    after: { minutes: number; note: string };
  },
) {
  const identity = {
    memberId: input.input.memberId,
    projectId: input.input.projectId,
    periodStart: formatDateOnly(input.periodStart),
    declarationId: input.declarationId,
    timeEntryId: input.timeEntryId,
  };

  await tx.auditLog.create({
    data: {
      actorMemberId: input.input.actorMemberId,
      // An admin correction is reported as a time-entry admin update so the existing
      // `TIME_ENTRY_ADMIN_MODIFIED` notification fires — see `ADMIN_AUDIT_ACTION`.
      action: input.byAdmin ? ADMIN_AUDIT_ACTION : input.action,
      targetType: input.byAdmin ? "time_entry" : "hours_declaration",
      targetId: input.byAdmin ? input.timeEntryId : input.declarationId,
      before: input.before ? { ...identity, ...input.before } : undefined,
      after: {
        ...identity,
        ...input.after,
        ...(input.byAdmin
          ? {
              adminModificationReason: input.reason,
              adminModifiedByMemberId: input.input.actorMemberId,
            }
          : {}),
      },
      ...input.input.requestMetadata,
    },
  });
}

function sanitizeFilename(filename: string) {
  const normalized = filename.trim().replaceAll(/[^a-zA-Z0-9._-]/g, "-");
  return normalized || "hours-proof.pdf";
}
