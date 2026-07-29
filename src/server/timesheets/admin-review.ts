import { isProjectColorToken, projectColorValues } from "@/src/lib/project-colors";
import { prisma } from "@/src/server/db/client";
import type { Prisma } from "@/src/server/db/generated/client";
import { formatDateOnly, normalizeDateOnly, parseDateOnly } from "@/src/server/time-tracking";

type TimesheetStatusRecord =
  "SUBMITTED" | "REJECTED" | "APPROVED" | "INVOICED" | "INVOICE_REJECTED" | "ACCEPTED" | "PAID";

type TimesheetEventTypeRecord = "APPROVED" | "REJECTED" | "UNLOCKED";

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
  status: TimesheetStatusRecord | "";
  contractorMemberId: string;
  projectId: string;
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

export type RejectTimesheetReviewInput = TimesheetReviewActionInput & {
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
      },
    });

    if (!timesheet || !timesheet.currentRevisionId || !timesheet.currentRevision) {
      throw new TimesheetReviewError("Timesheet not found.");
    }

    if (timesheet.status !== "SUBMITTED") {
      throw new TimesheetReviewError("Only submitted timesheets can be approved.");
    }

    await tx.timesheet.update({
      where: {
        id: timesheet.id,
      },
      data: {
        status: "APPROVED",
        approvedAt: now,
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
  });
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

function normalizeAdminTimesheetFilters(
  searchParams: AdminTimesheetSearchParams,
): AdminTimesheetFilters {
  const rawStatus = firstString(searchParams.status).trim().toUpperCase();

  return {
    query: firstString(searchParams.q).trim().slice(0, 120),
    status: STATUS_FILTERS.has(rawStatus as TimesheetStatusRecord)
      ? (rawStatus as TimesheetStatusRecord)
      : "",
    contractorMemberId: firstString(searchParams.contractor).trim(),
    projectId: firstString(searchParams.project).trim(),
    month: normalizeMonthInput(firstString(searchParams.month)),
    page: parsePositiveInteger(firstString(searchParams.page), DEFAULT_PAGE),
    pageSize: Math.min(
      parsePositiveInteger(firstString(searchParams.pageSize), DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE,
    ),
  };
}

function buildTimesheetWhere(filters: AdminTimesheetFilters): Prisma.TimesheetWhereInput {
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

  if (filters.status) {
    and.push({
      status: filters.status,
    });
  }

  if (filters.contractorMemberId) {
    and.push({
      contractorMemberId: filters.contractorMemberId,
    });
  }

  if (filters.projectId) {
    and.push({
      currentRevision: {
        is: {
          snapshotLines: {
            some: {
              projectId: filters.projectId,
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
    targetId: string;
    after: Prisma.InputJsonObject;
    requestMetadata?: TimesheetReviewRequestMetadata;
  },
) {
  await tx.auditLog.create({
    data: {
      actorMemberId: input.actorMemberId,
      action: input.action,
      targetType: "timesheet",
      targetId: input.targetId,
      after: input.after,
      ...input.requestMetadata,
    },
  });
}

function normalizeMonthInput(value: string) {
  const trimmed = value.trim();
  return MONTH_INPUT_PATTERN.test(trimmed) ? trimmed : "";
}

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.at(0) ?? "";
  return value ?? "";
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
