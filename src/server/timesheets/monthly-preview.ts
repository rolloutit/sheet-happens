import { isProjectColorToken, projectColorValues } from "@/src/lib/project-colors";
import { prisma } from "@/src/server/db/client";
import {
  addDays,
  formatDateOnly,
  getMonthStart,
  getTodayIsoInTimezone,
  normalizeDateOnly,
  parseDateOnly,
} from "@/src/server/time-tracking";

export type TimesheetPreviewStatus =
  | "not_created"
  | "submitted"
  | "rejected"
  | "approved"
  | "invoiced"
  | "invoice_rejected"
  | "accepted"
  | "paid"
  | "missing";

export type TimesheetPreviewRateSource = "MEMBER_DEFAULT" | "PROJECT_OVERRIDE";

export type TimesheetPreviewRate = {
  hourlyRate: string;
  currencyCode: string;
  source: TimesheetPreviewRateSource;
  sourceRatePeriodId: string;
};

export type TimesheetMonthOption = {
  month: string;
  periodStart: string;
  periodEnd: string;
  status: TimesheetPreviewStatus;
  totalMinutes: number;
};

export type TimesheetProjectPreview = {
  projectId: string;
  projectName: string;
  projectColor: string;
  totalMinutes: number;
  entryCount: number;
  singleRate: TimesheetPreviewRate | null;
  mixedRates: boolean;
  missingRateLineCount: number;
  currencyCode: string | null;
  mixedCurrency: boolean;
  amount: string | null;
};

export type ContractorTimesheetMonthlyPreview = {
  memberId: string;
  periodStart: string;
  periodEnd: string;
  selectedMonth: string;
  months: TimesheetMonthOption[];
  status: TimesheetPreviewStatus;
  source: "current_time_entries" | "timesheet_snapshot";
  revisionNumber: number | null;
  submittedAt: string | null;
  approvedAt: string | null;
  acceptedAt: string | null;
  paidAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  totalMinutes: number;
  entryCount: number;
  currencyCode: string | null;
  mixedCurrency: boolean;
  missingRateLineCount: number;
  totalAmount: string | null;
  projects: TimesheetProjectPreview[];
  invoice: ContractorTimesheetInvoicePreview | null;
  invoices: ContractorTimesheetInvoicePreview[];
};

export type ContractorTimesheetInvoicePreview = {
  id: string;
  invoiceNumber: string;
  status: "uploaded" | "accepted" | "rejected" | "replaced" | "cancelled" | "deleted";
  role: "original" | "replacement" | "cancellation" | "corrected";
  declaredAmount: string;
  currencyCode: string;
  originalFilename: string;
  uploadedAt: string;
  rejectionReason: string | null;
  referencesInvoiceId: string | null;
  replacedByInvoiceId: string | null;
};

type DecimalLike = {
  toString(): string;
};

export type TimesheetPreviewRatePeriod = {
  id: string;
  validFrom: Date;
  validTo: Date | null;
  hourlyRate: DecimalLike | string | number;
  currencyCode: string;
};

export type TimesheetPreviewLine = {
  id: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  localDate: Date;
  durationMinutes: number;
  rate: TimesheetPreviewRate | null;
  amountCents: number | null;
};

type TimesheetStatusRecord =
  "SUBMITTED" | "REJECTED" | "APPROVED" | "INVOICED" | "INVOICE_REJECTED" | "ACCEPTED" | "PAID";

export class TimesheetPreviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimesheetPreviewError";
  }
}

export async function getContractorTimesheetMonthlyPreview(input: {
  memberId: string;
  monthStart?: Date | null;
  now?: Date;
}): Promise<ContractorTimesheetMonthlyPreview> {
  const member = await prisma.member.findUnique({
    where: {
      id: input.memberId,
    },
    select: {
      id: true,
      currentProfile: true,
      timezone: true,
      deletedAt: true,
    },
  });

  if (!member || member.deletedAt) {
    throw new TimesheetPreviewError("Member not found.");
  }

  if (member.currentProfile !== "CONTRACTOR") {
    throw new TimesheetPreviewError("Contractor profile required.");
  }

  const todayIso = getTodayIsoInTimezone(member.timezone, input.now);
  const currentMonthStart = getMonthStart(parseDateOnly(todayIso));
  const selectedMonthStart = getMonthStart(input.monthStart ?? currentMonthStart);
  const selectedMonthEnd = getTimesheetMonthEnd(selectedMonthStart);
  const monthStarts = getMonthOptionStarts(currentMonthStart, selectedMonthStart);

  const [optionTimesheets, selectedTimesheet] = await Promise.all([
    prisma.timesheet.findMany({
      where: {
        contractorMemberId: member.id,
        periodStart: {
          in: monthStarts,
        },
      },
      select: {
        periodStart: true,
        status: true,
        currentRevision: {
          select: {
            totalMinutes: true,
          },
        },
      },
    }),
    prisma.timesheet.findUnique({
      where: {
        contractorMemberId_periodStart: {
          contractorMemberId: member.id,
          periodStart: selectedMonthStart,
        },
      },
      select: {
        status: true,
        currentRevisionNumber: true,
        submittedAt: true,
        approvedAt: true,
        acceptedAt: true,
        paidAt: true,
        currentRevision: {
          select: {
            revisionNumber: true,
            status: true,
            submittedAt: true,
            approvedAt: true,
            acceptedAt: true,
            paidAt: true,
            rejectedAt: true,
            rejectionReason: true,
            totalMinutes: true,
            totalAmount: true,
            currencyCode: true,
            snapshotLines: {
              orderBy: [{ localDate: "asc" }, { projectId: "asc" }],
              select: {
                id: true,
                projectId: true,
                localDate: true,
                durationMinutes: true,
                hourlyRate: true,
                currencyCode: true,
                lineAmount: true,
                rateSource: true,
                sourceRatePeriodId: true,
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
        invoices: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            status: true,
            role: true,
            invoiceNumber: true,
            declaredAmount: true,
            currencyCode: true,
            createdAt: true,
            rejectionReason: true,
            referencesInvoiceId: true,
            replacedByInvoiceId: true,
            document: {
              select: {
                originalFilename: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const optionTimesheetsByMonth = new Map(
    optionTimesheets.map((timesheet) => [formatDateOnly(timesheet.periodStart), timesheet]),
  );
  const snapshotLines = selectedTimesheet?.currentRevision?.snapshotLines ?? [];
  const shouldUseSnapshot =
    Boolean(selectedTimesheet) &&
    selectedTimesheet?.status !== "REJECTED" &&
    snapshotLines.length > 0;
  const lines = shouldUseSnapshot
    ? snapshotLines.map((line): TimesheetPreviewLine => {
        const projectColor = resolveProjectColor(line.project.colorToken);
        const rate = {
          hourlyRate: line.hourlyRate.toString(),
          currencyCode: line.currencyCode,
          source: line.rateSource,
          sourceRatePeriodId: line.sourceRatePeriodId ?? "",
        };

        return {
          id: line.id,
          projectId: line.projectId,
          projectName: line.project.name,
          projectColor,
          localDate: line.localDate,
          durationMinutes: line.durationMinutes,
          rate,
          amountCents: moneyToCents(line.lineAmount),
        };
      })
    : await getCurrentTimeEntryPreviewLines({
        memberId: member.id,
        periodStart: selectedMonthStart,
        periodEnd: selectedMonthEnd,
      });

  const aggregate = aggregateTimesheetPreviewLines(lines);
  const revision = selectedTimesheet?.currentRevision ?? null;
  const revisionNumber =
    revision?.revisionNumber ?? selectedTimesheet?.currentRevisionNumber ?? null;
  const invoices = (selectedTimesheet?.invoices ?? []).map((invoice) => ({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: mapInvoiceStatus(invoice.status),
    role: mapInvoiceRole(invoice.role),
    declaredAmount: invoice.declaredAmount.toString(),
    currencyCode: invoice.currencyCode,
    originalFilename: invoice.document.originalFilename,
    uploadedAt: invoice.createdAt.toISOString(),
    rejectionReason: invoice.rejectionReason,
    referencesInvoiceId: invoice.referencesInvoiceId,
    replacedByInvoiceId: invoice.replacedByInvoiceId,
  }));
  const latestMainInvoice =
    invoices.find((invoice) => invoice.role !== "cancellation") ?? invoices.at(0) ?? null;

  return {
    memberId: member.id,
    periodStart: formatDateOnly(selectedMonthStart),
    periodEnd: formatDateOnly(selectedMonthEnd),
    selectedMonth: formatMonthParam(selectedMonthStart),
    months: monthStarts.map((monthStart) => {
      const timesheet = optionTimesheetsByMonth.get(formatDateOnly(monthStart));

      return {
        month: formatMonthParam(monthStart),
        periodStart: formatDateOnly(monthStart),
        periodEnd: formatDateOnly(getTimesheetMonthEnd(monthStart)),
        status: timesheet ? mapTimesheetStatus(timesheet.status) : "not_created",
        totalMinutes: timesheet?.currentRevision?.totalMinutes ?? 0,
      };
    }),
    status: selectedTimesheet ? mapTimesheetStatus(selectedTimesheet.status) : "not_created",
    source: shouldUseSnapshot ? "timesheet_snapshot" : "current_time_entries",
    revisionNumber,
    submittedAt:
      revision?.submittedAt?.toISOString() ?? selectedTimesheet?.submittedAt?.toISOString() ?? null,
    approvedAt:
      revision?.approvedAt?.toISOString() ?? selectedTimesheet?.approvedAt?.toISOString() ?? null,
    acceptedAt:
      revision?.acceptedAt?.toISOString() ?? selectedTimesheet?.acceptedAt?.toISOString() ?? null,
    paidAt: revision?.paidAt?.toISOString() ?? selectedTimesheet?.paidAt?.toISOString() ?? null,
    rejectedAt: revision?.rejectedAt?.toISOString() ?? null,
    rejectionReason: revision?.rejectionReason ?? null,
    totalMinutes: aggregate.totalMinutes,
    entryCount: aggregate.entryCount,
    currencyCode: aggregate.currencyCode,
    mixedCurrency: aggregate.mixedCurrency,
    missingRateLineCount: aggregate.missingRateLineCount,
    totalAmount: aggregate.totalAmount,
    projects: aggregate.projects,
    invoice: latestMainInvoice,
    invoices,
  };
}

export function parseTimesheetMonthParam(value: string | undefined) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}$/.test(value)) return null;

  try {
    return parseDateOnly(`${value}-01`);
  } catch {
    return null;
  }
}

export function resolveTimesheetLineRate(input: {
  localDate: Date;
  memberRates: TimesheetPreviewRatePeriod[];
  assignmentRates: TimesheetPreviewRatePeriod[];
}): TimesheetPreviewRate | null {
  const assignmentRate = findEffectiveRate(input.assignmentRates, input.localDate);
  const rate = assignmentRate ?? findEffectiveRate(input.memberRates, input.localDate);

  if (!rate) return null;

  return {
    hourlyRate: rate.hourlyRate.toString(),
    currencyCode: rate.currencyCode,
    source: assignmentRate ? "PROJECT_OVERRIDE" : "MEMBER_DEFAULT",
    sourceRatePeriodId: rate.id,
  };
}

export function aggregateTimesheetPreviewLines(lines: TimesheetPreviewLine[]) {
  const projects = new Map<string, TimesheetProjectPreview & { amountCents: number | null }>();
  let totalMinutes = 0;
  let entryCount = 0;
  let missingRateLineCount = 0;
  let totalAmountCents = 0;
  let hasAnyAmount = false;
  const currencies = new Set<string>();

  for (const line of lines) {
    totalMinutes += line.durationMinutes;
    entryCount += 1;

    if (!line.rate) {
      missingRateLineCount += 1;
    } else {
      currencies.add(line.rate.currencyCode);
    }

    if (line.amountCents !== null) {
      totalAmountCents += line.amountCents;
      hasAnyAmount = true;
    }

    const existing =
      projects.get(line.projectId) ??
      ({
        projectId: line.projectId,
        projectName: line.projectName,
        projectColor: line.projectColor,
        totalMinutes: 0,
        entryCount: 0,
        singleRate: line.rate,
        mixedRates: false,
        missingRateLineCount: 0,
        currencyCode: line.rate?.currencyCode ?? null,
        mixedCurrency: false,
        amount: null,
        amountCents: null,
      } satisfies TimesheetProjectPreview & { amountCents: number | null });

    existing.totalMinutes += line.durationMinutes;
    existing.entryCount += 1;
    if (!line.rate) existing.missingRateLineCount += 1;

    if (line.rate && existing.singleRate && !sameRate(existing.singleRate, line.rate)) {
      existing.singleRate = null;
      existing.mixedRates = true;
    }

    if (line.rate && !existing.singleRate && existing.entryCount === 1) {
      existing.singleRate = line.rate;
    }

    if (line.rate?.currencyCode) {
      if (!existing.currencyCode) {
        existing.currencyCode = line.rate.currencyCode;
      } else if (existing.currencyCode !== line.rate.currencyCode) {
        existing.currencyCode = null;
        existing.mixedCurrency = true;
      }
    }

    if (line.amountCents !== null) {
      existing.amountCents = (existing.amountCents ?? 0) + line.amountCents;
    }

    projects.set(line.projectId, existing);
  }

  const mixedCurrency = currencies.size > 1;

  return {
    totalMinutes,
    entryCount,
    missingRateLineCount,
    currencyCode: currencies.size === 1 ? [...currencies][0] : null,
    mixedCurrency,
    totalAmount: hasAnyAmount && !mixedCurrency ? centsToMoney(totalAmountCents) : null,
    projects: [...projects.values()]
      .map(({ amountCents, ...project }) => ({
        ...project,
        amount: amountCents !== null && !project.mixedCurrency ? centsToMoney(amountCents) : null,
      }))
      .sort((left, right) => left.projectName.localeCompare(right.projectName)),
  };
}

async function getCurrentTimeEntryPreviewLines(input: {
  memberId: string;
  periodStart: Date;
  periodEnd: Date;
}): Promise<TimesheetPreviewLine[]> {
  const [memberRates, entries] = await Promise.all([
    prisma.memberDefaultRatePeriod.findMany({
      where: {
        memberId: input.memberId,
        validFrom: {
          lte: input.periodEnd,
        },
        OR: [{ validTo: null }, { validTo: { gt: input.periodStart } }],
      },
      orderBy: [{ validFrom: "asc" }],
      select: {
        id: true,
        validFrom: true,
        validTo: true,
        hourlyRate: true,
        currencyCode: true,
      },
    }),
    prisma.timeEntry.findMany({
      where: {
        memberId: input.memberId,
        deletedAt: null,
        localDate: {
          gte: input.periodStart,
          lte: input.periodEnd,
        },
      },
      orderBy: [{ localDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        projectId: true,
        projectAssignmentId: true,
        localDate: true,
        durationMinutes: true,
        project: {
          select: {
            name: true,
            colorToken: true,
          },
        },
        projectAssignment: {
          select: {
            overrideRates: {
              where: {
                validFrom: {
                  lte: input.periodEnd,
                },
                OR: [{ validTo: null }, { validTo: { gt: input.periodStart } }],
              },
              orderBy: [{ validFrom: "asc" }],
              select: {
                id: true,
                validFrom: true,
                validTo: true,
                hourlyRate: true,
                currencyCode: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return entries.map((entry) => {
    const rate = resolveTimesheetLineRate({
      localDate: entry.localDate,
      memberRates,
      assignmentRates: entry.projectAssignment.overrideRates,
    });

    return {
      id: entry.id,
      projectId: entry.projectId,
      projectName: entry.project.name,
      projectColor: resolveProjectColor(entry.project.colorToken),
      localDate: entry.localDate,
      durationMinutes: entry.durationMinutes,
      rate,
      amountCents: rate ? calculateLineAmountCents(entry.durationMinutes, rate.hourlyRate) : null,
    };
  });
}

function findEffectiveRate(rates: TimesheetPreviewRatePeriod[], localDate: Date) {
  return (
    rates
      .filter((rate) => rate.validFrom <= localDate && (!rate.validTo || rate.validTo > localDate))
      .sort((left, right) => right.validFrom.getTime() - left.validFrom.getTime())[0] ?? null
  );
}

function getMonthOptionStarts(currentMonthStart: Date, selectedMonthStart: Date) {
  const monthStarts = new Map<string, Date>();

  monthStarts.set(formatDateOnly(selectedMonthStart), selectedMonthStart);

  for (let index = 0; index < 6; index += 1) {
    const monthStart = addMonths(currentMonthStart, -index);
    monthStarts.set(formatDateOnly(monthStart), monthStart);
  }

  return [...monthStarts.values()].sort((left, right) => right.getTime() - left.getTime());
}

function addMonths(date: Date, months: number) {
  const normalized = normalizeDateOnly(date);
  return new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth() + months, 1));
}

export function getTimesheetMonthEnd(monthStart: Date) {
  return addDays(addMonths(monthStart, 1), -1);
}

function formatMonthParam(monthStart: Date) {
  return formatDateOnly(monthStart).slice(0, 7);
}

function mapTimesheetStatus(status: TimesheetStatusRecord): TimesheetPreviewStatus {
  return status.toLowerCase() as TimesheetPreviewStatus;
}

function mapInvoiceStatus(status: string): ContractorTimesheetInvoicePreview["status"] {
  return status.toLowerCase() as ContractorTimesheetInvoicePreview["status"];
}

function mapInvoiceRole(role: string): ContractorTimesheetInvoicePreview["role"] {
  return role.toLowerCase() as ContractorTimesheetInvoicePreview["role"];
}

function resolveProjectColor(colorToken: string) {
  return projectColorValues[isProjectColorToken(colorToken) ? colorToken : "teal"];
}

function sameRate(left: TimesheetPreviewRate, right: TimesheetPreviewRate) {
  return (
    left.hourlyRate === right.hourlyRate &&
    left.currencyCode === right.currencyCode &&
    left.source === right.source
  );
}

export function calculateLineAmountCents(durationMinutes: number, hourlyRate: string) {
  const rateCents = moneyToCents(hourlyRate);
  return Math.round((rateCents * durationMinutes) / 60);
}

function moneyToCents(value: DecimalLike | string | number) {
  return Math.round(Number(value.toString()) * 100);
}

export function centsToMoney(cents: number) {
  return (cents / 100).toFixed(2);
}
