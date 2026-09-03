import { isProjectColorToken, projectColorValues } from "@/src/lib/project-colors";
import { firstSearchParam, listSearchParam } from "@/src/lib/search-params";
import { prisma } from "@/src/server/db/client";
import type { Prisma } from "@/src/server/db/generated/client";
import { formatDateOnly, normalizeDateOnly, parseDateOnly } from "@/src/server/time-tracking";

type TimesheetStatusRecord =
  "SUBMITTED" | "REJECTED" | "APPROVED" | "INVOICED" | "INVOICE_REJECTED" | "ACCEPTED" | "PAID";

type TimesheetEventTypeRecord =
  "APPROVED" | "REJECTED" | "UNLOCKED" | "INVOICE_ACCEPTED" | "INVOICE_REJECTED" | "PAID";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MONTH_INPUT_PATTERN = /^\d{4}-\d{2}$/;
const STATUS_FILTERS = new Set<TimesheetStatusRecord>([
  "SUBMITTED",
  "REJECTED",
  "APPROVED",
  "INVOICED",
  "INVOICE_REJECTED",
  "ACCEPTED",
  "PAID",
]);

export type AdminTimesheetSearchParams = Record<string, string | string[] | undefined>;

export type AdminTimesheetFilters = {
  query: string;
  /** Empty means every status, the same way no filter at all does. */
  statuses: TimesheetStatusRecord[];
  contractorMemberIds: string[];
  projectIds: string[];
  month: string;
  page: number;
  pageSize: number;
};

export type AdminTimesheetFilterOption = {
  value: string;
  label: string;
  email?: string;
};

export type AdminTimesheetRow = {
  id: string;
  contractorMemberId: string;
  contractorName: string;
  contractorEmail: string;
  periodStart: string;
  periodEnd: string;
  status: TimesheetStatusRecord;
  currencyCode: string;
  revisionNumber: number;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  totalMinutes: number;
  totalAmount: string;
  entryCount: number;
  projectCount: number;
};

export type AdminTimesheetListResult = {
  rows: AdminTimesheetRow[];
  filters: AdminTimesheetFilters;
  totalItems: number;
  totalPages: number;
  pageStart: number;
  pageEnd: number;
  contractorOptions: AdminTimesheetFilterOption[];
  projectOptions: AdminTimesheetFilterOption[];
};

export type AdminTimesheetReviewLine = {
  id: string;
  sourceTimeEntryId: string;
  localDate: string;
  description: string;
  durationMinutes: number;
  rateSource: "MEMBER_DEFAULT" | "PROJECT_OVERRIDE";
  hourlyRate: string;
  currencyCode: string;
  lineAmount: string;
};

export type AdminTimesheetReviewProject = {
  projectId: string;
  projectName: string;
  projectColor: string;
  totalMinutes: number;
  totalAmount: string;
  currencyCode: string;
  entryCount: number;
  lines: AdminTimesheetReviewLine[];
};

export type AdminTimesheetReviewEvent = {
  id: string;
  eventType: string;
  actorName: string;
  actorEmail: string;
  reason: string | null;
  metadata: unknown;
  createdAt: string;
};

export type AdminTimesheetReviewInvoice = {
  id: string;
  invoiceNumber: string;
  status: "UPLOADED" | "ACCEPTED" | "REJECTED" | "REPLACED" | "CANCELLED" | "DELETED";
  role: "ORIGINAL" | "REPLACEMENT" | "CANCELLATION" | "CORRECTED";
  declaredAmount: string;
  currencyCode: string;
  originalFilename: string;
  contentType: string;
  byteSize: number;
  uploadedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  referencesInvoiceId: string | null;
  replacedByInvoiceId: string | null;
};

export type AdminTimesheetReview = {
  id: string;
  contractorMemberId: string;
  contractorName: string;
  contractorEmail: string;
  periodStart: string;
  periodEnd: string;
  status: TimesheetStatusRecord;
  currencyCode: string;
  revisionId: string | null;
  revisionNumber: number;
  submittedAt: string | null;
  approvedAt: string | null;
  acceptedAt: string | null;
  paidAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  totalMinutes: number;
  totalAmount: string;
  entryCount: number;
  projectCount: number;
  activeLockCount: number;
  invoice: AdminTimesheetReviewInvoice | null;
  invoices: AdminTimesheetReviewInvoice[];
  projects: AdminTimesheetReviewProject[];
  events: AdminTimesheetReviewEvent[];
};

export type TimesheetReviewRequestMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type TimesheetReviewActionInput = {
  timesheetId: string;
  actorMemberId: string;
  requestMetadata?: TimesheetReviewRequestMetadata;
};

export type BulkTimesheetReviewActionInput = {
  timesheetIds: string[];
  actorMemberId: string;
  requestMetadata?: TimesheetReviewRequestMetadata;
};

export type RejectTimesheetReviewInput = TimesheetReviewActionInput & {
  reason: string;
};

export type ReviewInvoiceInput = TimesheetReviewActionInput & {
  invoiceId: string;
};

export type RejectInvoiceReviewInput = ReviewInvoiceInput & {
  reason: string;
};

export class TimesheetReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimesheetReviewError";
  }
}

export async function listTimesheetsForAdmin(
  searchParams: AdminTimesheetSearchParams = {},
): Promise<AdminTimesheetListResult> {
  const filters = normalizeAdminTimesheetFilters(searchParams);
  const where = buildTimesheetWhere(filters);

  const [totalItems, contractorOptions, projectOptions] = await Promise.all([
    prisma.timesheet.count({ where }),
    prisma.member.findMany({
      where: {
        currentProfile: "CONTRACTOR",
        deletedAt: null,
      },
      orderBy: [{ displayName: "asc" }, { email: "asc" }],
      select: {
        id: true,
        displayName: true,
        email: true,
      },
    }),
    prisma.project.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalItems / filters.pageSize));
  const safeFilters = {
    ...filters,
    page: Math.min(filters.page, totalPages),
  };
  const skip = (safeFilters.page - 1) * safeFilters.pageSize;
  const records = await prisma.timesheet.findMany({
    where,
    orderBy: [{ periodStart: "desc" }, { submittedAt: "desc" }, { id: "desc" }],
    skip,
    take: safeFilters.pageSize,
    select: {
      id: true,
      contractorMemberId: true,
      periodStart: true,
      periodEnd: true,
      status: true,
      currencyCode: true,
      currentRevisionNumber: true,
      submittedAt: true,
      approvedAt: true,
      contractor: {
        select: {
          displayName: true,
          email: true,
        },
      },
      currentRevision: {
        select: {
          revisionNumber: true,
          rejectedAt: true,
          rejectionReason: true,
          totalMinutes: true,
          totalAmount: true,
          snapshotLines: {
            select: {
              id: true,
              projectId: true,
            },
          },
        },
      },
    },
  });

  return {
    rows: records.map((record) => {
      const revision = record.currentRevision;
      const projectIds = new Set(revision?.snapshotLines.map((line) => line.projectId) ?? []);

      return {
        id: record.id,
        contractorMemberId: record.contractorMemberId,
        contractorName: record.contractor.displayName,
        contractorEmail: record.contractor.email,
        periodStart: formatDateOnly(record.periodStart),
        periodEnd: formatDateOnly(record.periodEnd),
        status: record.status,
        currencyCode: record.currencyCode,
        revisionNumber: revision?.revisionNumber ?? record.currentRevisionNumber,
        submittedAt: record.submittedAt?.toISOString() ?? null,
        approvedAt: record.approvedAt?.toISOString() ?? null,
        rejectedAt: revision?.rejectedAt?.toISOString() ?? null,
        rejectionReason: revision?.rejectionReason ?? null,
        totalMinutes: revision?.totalMinutes ?? 0,
        totalAmount: revision?.totalAmount.toString() ?? "0.00",
        entryCount: revision?.snapshotLines.length ?? 0,
        projectCount: projectIds.size,
      };
    }),
    filters: safeFilters,
    totalItems,
    totalPages,
    pageStart: totalItems === 0 ? 0 : skip + 1,
    pageEnd: Math.min(skip + records.length, totalItems),
    contractorOptions: contractorOptions.map((contractor) => ({
      value: contractor.id,
      label: contractor.displayName,
      email: contractor.email,
    })),
    projectOptions: projectOptions.map((project) => ({
      value: project.id,
      label: project.name,
    })),
  };
}

export async function getTimesheetReviewForAdmin(
  timesheetId: string,
): Promise<AdminTimesheetReview | null> {
  const timesheet = await prisma.timesheet.findUnique({
    where: {
      id: timesheetId,
    },
    select: {
      id: true,
      contractorMemberId: true,
      periodStart: true,
      periodEnd: true,
      status: true,
      currencyCode: true,
      currentRevisionNumber: true,
      submittedAt: true,
      approvedAt: true,
      acceptedAt: true,
      paidAt: true,
      contractor: {
        select: {
          displayName: true,
          email: true,
        },
      },
      currentRevision: {
        select: {
          id: true,
          revisionNumber: true,
          submittedAt: true,
          approvedAt: true,
          acceptedAt: true,
          paidAt: true,
          rejectedAt: true,
          rejectionReason: true,
          currencyCode: true,
          totalMinutes: true,
          totalAmount: true,
          snapshotLines: {
            orderBy: [{ projectId: "asc" }, { localDate: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              sourceTimeEntryId: true,
              projectId: true,
              localDate: true,
              description: true,
              durationMinutes: true,
              rateSource: true,
              hourlyRate: true,
              currencyCode: true,
              lineAmount: true,
              project: {
                select: {
                  name: true,
                  colorToken: true,
                },
              },
            },
          },
        },
      },
      locks: {
        where: {
          unlockedAt: null,
        },
        select: {
          id: true,
        },
      },
      invoices: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          role: true,
          declaredAmount: true,
          currencyCode: true,
          createdAt: true,
          reviewedAt: true,
          rejectionReason: true,
          referencesInvoiceId: true,
          replacedByInvoiceId: true,
          document: {
            select: {
              originalFilename: true,
              contentType: true,
              byteSize: true,
            },
          },
        },
      },
      events: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          eventType: true,
          reason: true,
          metadata: true,
          createdAt: true,
          actor: {
            select: {
              displayName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!timesheet) return null;

  const revision = timesheet.currentRevision;
  const projects = groupSnapshotLinesByProject(revision?.snapshotLines ?? []);
  const invoices = timesheet.invoices.map((invoice) => ({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    role: invoice.role,
    declaredAmount: invoice.declaredAmount.toString(),
    currencyCode: invoice.currencyCode,
    originalFilename: invoice.document.originalFilename,
    contentType: invoice.document.contentType,
    byteSize: Number(invoice.document.byteSize),
    uploadedAt: invoice.createdAt.toISOString(),
    reviewedAt: invoice.reviewedAt?.toISOString() ?? null,
    rejectionReason: invoice.rejectionReason,
    referencesInvoiceId: invoice.referencesInvoiceId,
    replacedByInvoiceId: invoice.replacedByInvoiceId,
  }));
  const invoice = invoices.find((candidate) => candidate.role !== "CANCELLATION") ?? null;

  return {
    id: timesheet.id,
    contractorMemberId: timesheet.contractorMemberId,
    contractorName: timesheet.contractor.displayName,
    contractorEmail: timesheet.contractor.email,
    periodStart: formatDateOnly(timesheet.periodStart),
    periodEnd: formatDateOnly(timesheet.periodEnd),
    status: timesheet.status,
    currencyCode: revision?.currencyCode ?? timesheet.currencyCode,
    revisionId: revision?.id ?? null,
    revisionNumber: revision?.revisionNumber ?? timesheet.currentRevisionNumber,
    submittedAt:
      revision?.submittedAt.toISOString() ?? timesheet.submittedAt?.toISOString() ?? null,
    approvedAt: revision?.approvedAt?.toISOString() ?? timesheet.approvedAt?.toISOString() ?? null,
    acceptedAt: revision?.acceptedAt?.toISOString() ?? timesheet.acceptedAt?.toISOString() ?? null,
    paidAt: revision?.paidAt?.toISOString() ?? timesheet.paidAt?.toISOString() ?? null,
    rejectedAt: revision?.rejectedAt?.toISOString() ?? null,
    rejectionReason: revision?.rejectionReason ?? null,
    totalMinutes: revision?.totalMinutes ?? 0,
    totalAmount: revision?.totalAmount.toString() ?? "0.00",
    entryCount: revision?.snapshotLines.length ?? 0,
    projectCount: projects.length,
    activeLockCount: timesheet.locks.length,
    invoice,
    invoices,
    projects,
    events: timesheet.events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      actorName: event.actor.displayName,
      actorEmail: event.actor.email,
      reason: event.reason,
      metadata: event.metadata,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

export async function approveTimesheetForAdmin(
  input: TimesheetReviewActionInput,
  deps: { now?: Date; db?: Pick<typeof prisma, "$transaction"> } = {},
) {
  const now = deps.now ?? new Date();

  return (deps.db ?? prisma).$transaction((tx) => approveTimesheetInTransaction(tx, input, now));
}

export async function approveTimesheetsForAdmin(
  input: BulkTimesheetReviewActionInput,
  deps: { now?: Date; db?: Pick<typeof prisma, "$transaction"> } = {},
) {
  const timesheetIds = [...new Set(input.timesheetIds)];

  if (timesheetIds.length === 0) {
    throw new TimesheetReviewError("Select at least one timesheet to approve.");
  }

  if (timesheetIds.length > MAX_PAGE_SIZE) {
    throw new TimesheetReviewError("Too many timesheets selected for bulk approval.");
  }

  const now = deps.now ?? new Date();

  return (deps.db ?? prisma).$transaction(async (tx) => {
    for (const timesheetId of timesheetIds) {
      await approveTimesheetInTransaction(
        tx,
        {
          timesheetId,
          actorMemberId: input.actorMemberId,
          requestMetadata: input.requestMetadata,
        },
        now,
      );
    }

    return {
      approvedCount: timesheetIds.length,
      timesheetIds,
    };
  });
}

async function approveTimesheetInTransaction(
  tx: Prisma.TransactionClient,
  input: TimesheetReviewActionInput,
  now: Date,
) {
  const timesheet = await tx.timesheet.findUnique({
    where: {
      id: input.timesheetId,
    },
    select: {
      id: true,
      status: true,
      periodStart: true,
      periodEnd: true,
      currentRevisionId: true,
      currentRevision: {
        select: {
          id: true,
          revisionNumber: true,
          totalMinutes: true,
          totalAmount: true,
          currencyCode: true,
          snapshotLines: {
            select: {
              id: true,
              projectId: true,
            },
          },
        },
      },
    },
  });

  if (!timesheet || !timesheet.currentRevisionId || !timesheet.currentRevision) {
    throw new TimesheetReviewError("Timesheet not found.");
  }

  if (timesheet.status !== "SUBMITTED") {
    throw new TimesheetReviewError("Only submitted timesheets can be approved.");
  }

  const updatedTimesheet = await tx.timesheet.updateMany({
    where: {
      id: timesheet.id,
      status: "SUBMITTED",
      currentRevisionId: timesheet.currentRevisionId,
    },
    data: {
      status: "APPROVED",
      approvedAt: now,
      updatedByMemberId: input.actorMemberId,
    },
  });

  if (updatedTimesheet.count !== 1) {
    throw new TimesheetReviewError("Only submitted timesheets can be approved.");
  }

  await tx.timesheetRevision.update({
    where: {
      id: timesheet.currentRevisionId,
    },
    data: {
      status: "APPROVED",
      approvedAt: now,
      rejectedAt: null,
      rejectionReason: null,
    },
    select: {
      id: true,
    },
  });

  const metadata = buildReviewMetadata({
    periodStart: timesheet.periodStart,
    periodEnd: timesheet.periodEnd,
    revision: timesheet.currentRevision,
  });

  await createTimesheetEvent(tx, {
    timesheetId: timesheet.id,
    timesheetRevisionId: timesheet.currentRevisionId,
    eventType: "APPROVED",
    actorMemberId: input.actorMemberId,
    reason: null,
    metadata,
    createdAt: now,
  });

  await createReviewAuditLog(tx, {
    actorMemberId: input.actorMemberId,
    action: "timesheet.approved",
    targetId: timesheet.id,
    after: {
      ...metadata,
      status: "APPROVED",
    },
    requestMetadata: input.requestMetadata,
  });

  return {
    timesheetId: timesheet.id,
    status: "APPROVED" as const,
  };
}

export async function rejectTimesheetForAdmin(
  input: RejectTimesheetReviewInput,
  deps: { now?: Date } = {},
) {
  const reason = input.reason.trim();

  if (reason.length < 3) {
    throw new TimesheetReviewError("Rejection reason is required.");
  }

  const now = deps.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    const timesheet = await tx.timesheet.findUnique({
      where: {
        id: input.timesheetId,
      },
      select: {
        id: true,
        contractorMemberId: true,
        status: true,
        periodStart: true,
        periodEnd: true,
        currentRevisionId: true,
        currentRevision: {
          select: {
            id: true,
            revisionNumber: true,
            totalMinutes: true,
            totalAmount: true,
            currencyCode: true,
            snapshotLines: {
              select: {
                id: true,
                projectId: true,
              },
            },
          },
        },
      },
    });

    if (!timesheet || !timesheet.currentRevisionId || !timesheet.currentRevision) {
      throw new TimesheetReviewError("Timesheet not found.");
    }

    if (timesheet.status !== "SUBMITTED") {
      throw new TimesheetReviewError("Only submitted timesheets can be rejected.");
    }

    await tx.timesheet.update({
      where: {
        id: timesheet.id,
      },
      data: {
        status: "REJECTED",
        approvedAt: null,
        acceptedAt: null,
        paidAt: null,
        updatedByMemberId: input.actorMemberId,
      },
      select: {
        id: true,
      },
    });

    await tx.timesheetRevision.update({
      where: {
        id: timesheet.currentRevisionId,
      },
      data: {
        status: "REJECTED",
        approvedAt: null,
        acceptedAt: null,
        paidAt: null,
        rejectedAt: now,
        rejectionReason: reason,
      },
      select: {
        id: true,
      },
    });

    const unlockedLocks = await tx.periodLock.updateMany({
      where: {
        timesheetId: timesheet.id,
        timesheetRevisionId: timesheet.currentRevisionId,
        unlockedAt: null,
      },
      data: {
        unlockedAt: now,
        unlockedByMemberId: input.actorMemberId,
        unlockReason: reason,
      },
    });

    const unlockedEntries = await tx.timeEntry.updateMany({
      where: {
        memberId: timesheet.contractorMemberId,
        lockedByTimesheetRevisionId: timesheet.currentRevisionId,
        deletedAt: null,
      },
      data: {
        lockedByTimesheetRevisionId: null,
        updatedByMemberId: input.actorMemberId,
      },
    });

    const metadata = {
      ...buildReviewMetadata({
        periodStart: timesheet.periodStart,
        periodEnd: timesheet.periodEnd,
        revision: timesheet.currentRevision,
      }),
      unlockedLockCount: unlockedLocks.count,
      unlockedEntryCount: unlockedEntries.count,
    };

    await createTimesheetEvent(tx, {
      timesheetId: timesheet.id,
      timesheetRevisionId: timesheet.currentRevisionId,
      eventType: "REJECTED",
      actorMemberId: input.actorMemberId,
      reason,
      metadata,
      createdAt: now,
    });

    await createTimesheetEvent(tx, {
      timesheetId: timesheet.id,
      timesheetRevisionId: timesheet.currentRevisionId,
      eventType: "UNLOCKED",
      actorMemberId: input.actorMemberId,
      reason,
      metadata,
      createdAt: now,
    });

    await createReviewAuditLog(tx, {
      actorMemberId: input.actorMemberId,
      action: "timesheet.rejected",
      targetId: timesheet.id,
      after: {
        ...metadata,
        status: "REJECTED",
        rejectionReason: reason,
      },
      requestMetadata: input.requestMetadata,
    });

    return {
      timesheetId: timesheet.id,
      status: "REJECTED" as const,
      unlockedEntryCount: unlockedEntries.count,
    };
  });
}

export async function acceptInvoiceForAdmin(input: ReviewInvoiceInput, deps: { now?: Date } = {}) {
  const now = deps.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    const invoice = await getInvoiceForReview(tx, input);

    if (invoice.status !== "UPLOADED" || invoice.timesheet.status !== "INVOICED") {
      throw new TimesheetReviewError("Only uploaded invoices can be accepted.");
    }

    if (invoice.role === "CANCELLATION") {
      throw new TimesheetReviewError(
        "Cancellation invoice must be paired with a replacement invoice.",
      );
    }

    if (invoice.timesheet.currentRevisionId !== invoice.timesheetRevisionId) {
      throw new TimesheetReviewError("Invoice does not belong to the current timesheet revision.");
    }

    const cancellationInvoiceIds = getRequiredCancellationInvoiceIds(invoice);

    if (invoice.role === "REPLACEMENT" && cancellationInvoiceIds.length === 0) {
      throw new TimesheetReviewError(
        "Replacement invoice requires a cancellation invoice for the rejected invoice.",
      );
    }

    await tx.contractorInvoice.update({
      where: {
        id: invoice.id,
      },
      data: {
        status: "ACCEPTED",
        reviewedByMemberId: input.actorMemberId,
        reviewedAt: now,
        rejectionReason: null,
      },
      select: {
        id: true,
      },
    });

    if (cancellationInvoiceIds.length > 0) {
      await tx.contractorInvoice.updateMany({
        where: {
          timesheetRevisionId: invoice.timesheetRevision.id,
          role: "CANCELLATION",
          status: "UPLOADED",
        },
        data: {
          status: "ACCEPTED",
          reviewedByMemberId: input.actorMemberId,
          reviewedAt: now,
          rejectionReason: null,
        },
      });
    }

    await tx.timesheet.update({
      where: {
        id: invoice.timesheet.id,
      },
      data: {
        status: "ACCEPTED",
        acceptedAt: now,
        updatedByMemberId: input.actorMemberId,
      },
      select: {
        id: true,
      },
    });

    await tx.timesheetRevision.update({
      where: {
        id: invoice.timesheetRevision.id,
      },
      data: {
        status: "ACCEPTED",
        acceptedAt: now,
      },
      select: {
        id: true,
      },
    });

    const metadata = buildInvoiceReviewMetadata(invoice);

    await createTimesheetEvent(tx, {
      timesheetId: invoice.timesheet.id,
      timesheetRevisionId: invoice.timesheetRevision.id,
      eventType: "INVOICE_ACCEPTED",
      actorMemberId: input.actorMemberId,
      reason: null,
      metadata,
      createdAt: now,
    });

    await createReviewAuditLog(tx, {
      actorMemberId: input.actorMemberId,
      action: "invoice.accepted",
      targetType: "contractor_invoice",
      targetId: invoice.id,
      after: {
        ...metadata,
        status: "ACCEPTED",
      },
      requestMetadata: input.requestMetadata,
    });

    return {
      invoiceId: invoice.id,
      timesheetId: invoice.timesheet.id,
      status: "ACCEPTED" as const,
    };
  });
}

export async function rejectInvoiceForAdmin(
  input: RejectInvoiceReviewInput,
  deps: { now?: Date } = {},
) {
  const reason = input.reason.trim();

  if (reason.length < 3) {
    throw new TimesheetReviewError("Invoice rejection reason is required.");
  }

  const now = deps.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    const invoice = await getInvoiceForReview(tx, input);

    if (invoice.status !== "UPLOADED" || invoice.timesheet.status !== "INVOICED") {
      throw new TimesheetReviewError("Only uploaded invoices can be rejected.");
    }

    if (invoice.role === "CANCELLATION") {
      throw new TimesheetReviewError(
        "Cancellation invoice must be paired with a replacement invoice.",
      );
    }

    if (invoice.timesheet.currentRevisionId !== invoice.timesheetRevisionId) {
      throw new TimesheetReviewError("Invoice does not belong to the current timesheet revision.");
    }

    await tx.contractorInvoice.update({
      where: {
        id: invoice.id,
      },
      data: {
        status: "REJECTED",
        reviewedByMemberId: input.actorMemberId,
        reviewedAt: now,
        rejectionReason: reason,
      },
      select: {
        id: true,
      },
    });

    await tx.timesheet.update({
      where: {
        id: invoice.timesheet.id,
      },
      data: {
        status: "INVOICE_REJECTED",
        acceptedAt: null,
        paidAt: null,
        updatedByMemberId: input.actorMemberId,
      },
      select: {
        id: true,
      },
    });

    await tx.timesheetRevision.update({
      where: {
        id: invoice.timesheetRevision.id,
      },
      data: {
        status: "INVOICE_REJECTED",
        acceptedAt: null,
        paidAt: null,
      },
      select: {
        id: true,
      },
    });

    const metadata = buildInvoiceReviewMetadata(invoice);

    await createTimesheetEvent(tx, {
      timesheetId: invoice.timesheet.id,
      timesheetRevisionId: invoice.timesheetRevision.id,
      eventType: "INVOICE_REJECTED",
      actorMemberId: input.actorMemberId,
      reason,
      metadata,
      createdAt: now,
    });

    await createReviewAuditLog(tx, {
      actorMemberId: input.actorMemberId,
      action: "invoice.rejected",
      targetType: "contractor_invoice",
      targetId: invoice.id,
      after: {
        ...metadata,
        status: "REJECTED",
        rejectionReason: reason,
      },
      requestMetadata: input.requestMetadata,
    });

    return {
      invoiceId: invoice.id,
      timesheetId: invoice.timesheet.id,
      status: "REJECTED" as const,
    };
  });
}

export async function markTimesheetPaidForAdmin(
  input: TimesheetReviewActionInput,
  deps: { now?: Date } = {},
) {
  const now = deps.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    const timesheet = await tx.timesheet.findUnique({
      where: {
        id: input.timesheetId,
      },
      select: {
        id: true,
        status: true,
        periodStart: true,
        periodEnd: true,
        currentRevisionId: true,
        currentRevision: {
          select: {
            id: true,
            revisionNumber: true,
            totalMinutes: true,
            totalAmount: true,
            currencyCode: true,
            snapshotLines: {
              select: {
                id: true,
                projectId: true,
              },
            },
          },
        },
        invoices: {
          where: {
            role: {
              in: ["ORIGINAL", "REPLACEMENT", "CORRECTED"],
            },
            status: "ACCEPTED",
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          select: {
            id: true,
            invoiceNumber: true,
            declaredAmount: true,
            currencyCode: true,
            documentId: true,
          },
        },
      },
    });

    if (!timesheet || !timesheet.currentRevisionId || !timesheet.currentRevision) {
      throw new TimesheetReviewError("Timesheet not found.");
    }

    if (timesheet.status !== "ACCEPTED") {
      throw new TimesheetReviewError("Only accepted timesheets can be marked as paid.");
    }

    const invoice = timesheet.invoices.at(0) ?? null;

    if (!invoice) {
      throw new TimesheetReviewError("Accepted invoice not found.");
    }

    const paidTimesheetUpdate = await tx.timesheet.updateMany({
      where: {
        id: timesheet.id,
        status: "ACCEPTED",
      },
      data: {
        status: "PAID",
        paidAt: now,
        updatedByMemberId: input.actorMemberId,
      },
    });

    if (paidTimesheetUpdate.count !== 1) {
      throw new TimesheetReviewError("Only accepted timesheets can be marked as paid.");
    }

    const paidRevisionUpdate = await tx.timesheetRevision.updateMany({
      where: {
        id: timesheet.currentRevisionId,
        status: "ACCEPTED",
      },
      data: {
        status: "PAID",
        paidAt: now,
      },
    });

    if (paidRevisionUpdate.count !== 1) {
      throw new TimesheetReviewError("Only accepted timesheets can be marked as paid.");
    }

    const metadata = {
      ...buildReviewMetadata({
        periodStart: timesheet.periodStart,
        periodEnd: timesheet.periodEnd,
        revision: timesheet.currentRevision,
      }),
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDeclaredAmount: invoice.declaredAmount.toString(),
      invoiceCurrencyCode: invoice.currencyCode,
      documentId: invoice.documentId,
    };

    await createTimesheetEvent(tx, {
      timesheetId: timesheet.id,
      timesheetRevisionId: timesheet.currentRevisionId,
      eventType: "PAID",
      actorMemberId: input.actorMemberId,
      reason: null,
      metadata,
      createdAt: now,
    });

    await createReviewAuditLog(tx, {
      actorMemberId: input.actorMemberId,
      action: "timesheet.paid",
      targetId: timesheet.id,
      after: {
        ...metadata,
        status: "PAID",
      },
      requestMetadata: input.requestMetadata,
    });

    return {
      timesheetId: timesheet.id,
      invoiceId: invoice.id,
      status: "PAID" as const,
    };
  });
}

async function getInvoiceForReview(tx: Prisma.TransactionClient, input: ReviewInvoiceInput) {
  const invoice = await tx.contractorInvoice.findFirst({
    where: {
      id: input.invoiceId,
      timesheetId: input.timesheetId,
    },
    select: {
      id: true,
      status: true,
      role: true,
      timesheetRevisionId: true,
      invoiceNumber: true,
      declaredAmount: true,
      currencyCode: true,
      documentId: true,
      replacesInvoice: {
        select: {
          id: true,
          referencedBy: {
            where: {
              role: "CANCELLATION",
              status: {
                not: "DELETED",
              },
            },
            select: {
              id: true,
              status: true,
            },
          },
        },
      },
      timesheet: {
        select: {
          id: true,
          status: true,
          periodStart: true,
          periodEnd: true,
          currentRevisionId: true,
        },
      },
      timesheetRevision: {
        select: {
          id: true,
          revisionNumber: true,
          totalMinutes: true,
          totalAmount: true,
          currencyCode: true,
          snapshotLines: {
            select: {
              id: true,
              projectId: true,
            },
          },
        },
      },
    },
  });

  if (!invoice) {
    throw new TimesheetReviewError("Invoice not found.");
  }

  return invoice;
}

function getRequiredCancellationInvoiceIds(input: {
  role: "ORIGINAL" | "REPLACEMENT" | "CANCELLATION" | "CORRECTED";
  replacesInvoice: {
    referencedBy: Array<{
      id: string;
      status: "UPLOADED" | "ACCEPTED" | "REJECTED" | "REPLACED" | "CANCELLED" | "DELETED";
    }>;
  } | null;
}) {
  if (input.role !== "REPLACEMENT") return [];

  return (
    input.replacesInvoice?.referencedBy
      .filter((invoice) => invoice.status === "UPLOADED" || invoice.status === "ACCEPTED")
      .map((invoice) => invoice.id) ?? []
  );
}

/** Exported for tests, like the audit log's equivalents. */
export function normalizeAdminTimesheetFilters(
  searchParams: AdminTimesheetSearchParams,
): AdminTimesheetFilters {
  return {
    query: firstSearchParam(searchParams.q).trim().slice(0, 120),
    // Unknown statuses drop out rather than emptying the filter: a stale link naming one
    // real and one retired status should still narrow the list to the real one.
    statuses: listSearchParam(searchParams.status)
      .map((status) => status.toUpperCase())
      .filter((status): status is TimesheetStatusRecord =>
        STATUS_FILTERS.has(status as TimesheetStatusRecord),
      ),
    contractorMemberIds: listSearchParam(searchParams.contractor),
    projectIds: listSearchParam(searchParams.project),
    month: normalizeMonthInput(firstSearchParam(searchParams.month)),
    page: parsePositiveInteger(firstSearchParam(searchParams.page), DEFAULT_PAGE),
    pageSize: Math.min(
      parsePositiveInteger(firstSearchParam(searchParams.pageSize), DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE,
    ),
  };
}

/** Exported for tests, like the audit log's equivalents. */
export function buildTimesheetWhere(filters: AdminTimesheetFilters): Prisma.TimesheetWhereInput {
  const and: Prisma.TimesheetWhereInput[] = [];

  if (filters.query) {
    const containsFilter = {
      contains: filters.query,
      mode: "insensitive" as const,
    };

    and.push({
      contractor: {
        is: {
          OR: [
            { displayName: containsFilter },
            { firstName: containsFilter },
            { lastName: containsFilter },
            { email: containsFilter },
          ],
        },
      },
    });
  }

  if (filters.statuses.length > 0) {
    and.push({
      status: { in: filters.statuses },
    });
  }

  if (filters.contractorMemberIds.length > 0) {
    and.push({
      contractorMemberId: { in: filters.contractorMemberIds },
    });
  }

  if (filters.projectIds.length > 0) {
    and.push({
      currentRevision: {
        is: {
          // A timesheet matches when any of its lines is on any of the chosen projects.
          snapshotLines: {
            some: {
              projectId: { in: filters.projectIds },
            },
          },
        },
      },
    });
  }

  if (filters.month) {
    and.push({
      periodStart: parseDateOnly(`${filters.month}-01`),
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

function groupSnapshotLinesByProject(
  lines: Array<{
    id: string;
    sourceTimeEntryId: string;
    projectId: string;
    localDate: Date;
    description: string;
    durationMinutes: number;
    rateSource: "MEMBER_DEFAULT" | "PROJECT_OVERRIDE";
    hourlyRate: Prisma.Decimal;
    currencyCode: string;
    lineAmount: Prisma.Decimal;
    project: {
      name: string;
      colorToken: string | null;
    };
  }>,
): AdminTimesheetReviewProject[] {
  const projects = new Map<string, AdminTimesheetReviewProject & { totalAmountCents: number }>();

  for (const line of lines) {
    const project =
      projects.get(line.projectId) ??
      ({
        projectId: line.projectId,
        projectName: line.project.name,
        projectColor: resolveProjectColor(line.project.colorToken),
        totalMinutes: 0,
        totalAmount: "0.00",
        totalAmountCents: 0,
        currencyCode: line.currencyCode,
        entryCount: 0,
        lines: [],
      } satisfies AdminTimesheetReviewProject & { totalAmountCents: number });

    project.totalMinutes += line.durationMinutes;
    project.totalAmountCents += moneyToCents(line.lineAmount.toString());
    project.entryCount += 1;
    project.currencyCode = line.currencyCode;
    project.lines.push({
      id: line.id,
      sourceTimeEntryId: line.sourceTimeEntryId,
      localDate: formatDateOnly(line.localDate),
      description: line.description,
      durationMinutes: line.durationMinutes,
      rateSource: line.rateSource,
      hourlyRate: line.hourlyRate.toString(),
      currencyCode: line.currencyCode,
      lineAmount: line.lineAmount.toString(),
    });
    project.totalAmount = centsToMoney(project.totalAmountCents);
    projects.set(line.projectId, project);
  }

  return [...projects.values()].map((project) => ({
    projectId: project.projectId,
    projectName: project.projectName,
    projectColor: project.projectColor,
    totalMinutes: project.totalMinutes,
    totalAmount: project.totalAmount,
    currencyCode: project.currencyCode,
    entryCount: project.entryCount,
    lines: project.lines.sort((left, right) => left.localDate.localeCompare(right.localDate)),
  }));
}

function buildReviewMetadata(input: {
  periodStart: Date;
  periodEnd: Date;
  revision: {
    id: string;
    revisionNumber: number;
    totalMinutes: number;
    totalAmount: Prisma.Decimal;
    currencyCode: string;
    snapshotLines: Array<{ id: string; projectId: string }>;
  };
}): Prisma.InputJsonObject {
  return {
    periodStart: formatDateOnly(normalizeDateOnly(input.periodStart)),
    periodEnd: formatDateOnly(normalizeDateOnly(input.periodEnd)),
    revisionId: input.revision.id,
    revisionNumber: input.revision.revisionNumber,
    entryCount: input.revision.snapshotLines.length,
    projectCount: new Set(input.revision.snapshotLines.map((line) => line.projectId)).size,
    currencyCode: input.revision.currencyCode,
    totalMinutes: input.revision.totalMinutes,
    totalAmount: input.revision.totalAmount.toString(),
  };
}

function buildInvoiceReviewMetadata(input: {
  id: string;
  invoiceNumber: string;
  declaredAmount: Prisma.Decimal;
  currencyCode: string;
  documentId: string;
  timesheet: {
    id: string;
    periodStart: Date;
    periodEnd: Date;
  };
  timesheetRevision: {
    id: string;
    revisionNumber: number;
    totalMinutes: number;
    totalAmount: Prisma.Decimal;
    currencyCode: string;
    snapshotLines: Array<{ id: string; projectId: string }>;
  };
}): Prisma.InputJsonObject {
  return {
    invoiceId: input.id,
    invoiceNumber: input.invoiceNumber,
    invoiceDeclaredAmount: input.declaredAmount.toString(),
    invoiceCurrencyCode: input.currencyCode,
    documentId: input.documentId,
    timesheetId: input.timesheet.id,
    periodStart: formatDateOnly(normalizeDateOnly(input.timesheet.periodStart)),
    periodEnd: formatDateOnly(normalizeDateOnly(input.timesheet.periodEnd)),
    revisionId: input.timesheetRevision.id,
    revisionNumber: input.timesheetRevision.revisionNumber,
    entryCount: input.timesheetRevision.snapshotLines.length,
    projectCount: new Set(input.timesheetRevision.snapshotLines.map((line) => line.projectId)).size,
    timesheetTotalMinutes: input.timesheetRevision.totalMinutes,
    timesheetTotalAmount: input.timesheetRevision.totalAmount.toString(),
    timesheetCurrencyCode: input.timesheetRevision.currencyCode,
  };
}

async function createTimesheetEvent(
  tx: Prisma.TransactionClient,
  input: {
    timesheetId: string;
    timesheetRevisionId: string;
    eventType: TimesheetEventTypeRecord;
    actorMemberId: string;
    reason: string | null;
    metadata: Prisma.InputJsonObject;
    createdAt: Date;
  },
) {
  await tx.timesheetEvent.create({
    data: {
      timesheetId: input.timesheetId,
      timesheetRevisionId: input.timesheetRevisionId,
      eventType: input.eventType,
      actorMemberId: input.actorMemberId,
      reason: input.reason,
      metadata: input.metadata,
      createdAt: input.createdAt,
    },
  });
}

async function createReviewAuditLog(
  tx: Prisma.TransactionClient,
  input: {
    actorMemberId: string;
    action: string;
    targetType?: string;
    targetId: string;
    after: Prisma.InputJsonObject;
    requestMetadata?: TimesheetReviewRequestMetadata;
  },
) {
  await tx.auditLog.create({
    data: {
      actorMemberId: input.actorMemberId,
      action: input.action,
      targetType: input.targetType ?? "timesheet",
      targetId: input.targetId,
      after: input.after,
      ...input.requestMetadata,
    },
  });
}

/**
 * Narrows the `month` search param to `YYYY-MM`, or drops it entirely.
 *
 * Exported for the test that pins this against what `MonthPicker` emits. The coupling is
 * worth stating out loud: anything else — `YYYY-MM-01` most plausibly — silently becomes an
 * empty string, which removes the filter with no error and no visible signal, and the admin
 * sees every month's timesheets at once.
 */
export function normalizeMonthInput(value: string) {
  const trimmed = value.trim();
  return MONTH_INPUT_PATTERN.test(trimmed) ? trimmed : "";
}

function parsePositiveInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveProjectColor(colorToken: string | null) {
  return isProjectColorToken(colorToken) ? projectColorValues[colorToken] : projectColorValues.teal;
}

function moneyToCents(amount: string) {
  const normalized = amount.trim();
  const sign = normalized.startsWith("-") ? -1 : 1;
  const unsigned = normalized.replace(/^-/, "");
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const cents = Number.parseInt(whole || "0", 10) * 100;
  const fractionalCents = Number.parseInt(fraction.padEnd(2, "0").slice(0, 2) || "0", 10);

  return sign * (cents + fractionalCents);
}

function centsToMoney(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");

  return `${sign}${whole}.${fraction}`;
}
