import { isProjectColorToken, projectColorValues } from "@/src/lib/project-colors";
import { prisma } from "@/src/server/db/client";
import {
  formatDateOnly,
  getMonday,
  getMonthStart,
  getTodayIsoInTimezone,
  getWeekEnd,
  parseDateOnly,
  resolveTrackingMode,
  type TrackingMode,
} from "@/src/server/time-tracking";
import {
  calculateLineAmountCents,
  centsToMoney,
  getContractorTimesheetMonthlyPreview,
  getTimesheetMonthEnd,
  listTimesheetsForAdmin,
  type AdminTimesheetRow,
  type TimesheetPreviewStatus,
} from "@/src/server/timesheets";

export type DashboardMember = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  role: "ADMIN" | "MEMBER";
  currentProfile: "CONTRACTOR" | "EMPLOYEE";
  timezone: string;
};

export type DashboardPeriod = {
  today: string;
  weekStart: string;
  weekEnd: string;
  monthStart: string;
  monthEnd: string;
  previousMonthStart: string;
  previousMonthEnd: string;
};

export type DashboardWeeklyProject = {
  projectId: string;
  projectName: string;
  projectColor: string;
  logged: boolean;
  inactive: boolean;
};

export type MemberDashboardBase = {
  kind: "employee" | "contractor";
  greetingName: string;
  period: DashboardPeriod;
  activeProjectCount: number;
  monthMinutes: number;
  previousMonthMinutes: number;
  averageWeekMinutes: number;
  weeklyProjects: DashboardWeeklyProject[];
};

export type ContractorDashboardData = MemberDashboardBase & {
  kind: "contractor";
  timesheet: {
    status: TimesheetPreviewStatus;
    selectedMonth: string;
    totalAmount: string | null;
    currencyCode: string | null;
    mixedCurrency: boolean;
    missingRateLineCount: number;
    totalMinutes: number;
    invoiceUploaded: boolean;
  };
  nextAction: ContractorDashboardNextAction;
};

export type EmployeeDashboardData = MemberDashboardBase & {
  kind: "employee";
  monthStatus: EmployeeMonthStatus;
  projectBreakdown: EmployeeDashboardProject[];
  costTotals: EmployeeDashboardCurrencyTotal[];
  missingRateLineCount: number;
  mixedCurrency: boolean;
};

export type EmployeeMonthStatus = "no_projects" | "not_started" | "tracked" | "missing_rates";

export type EmployeeDashboardRate = {
  hourlyRate: string;
  currencyCode: string;
};

export type EmployeeDashboardCurrencyTotal = {
  currencyCode: string;
  amount: string;
};

export type EmployeeDashboardProject = {
  projectId: string;
  projectName: string;
  projectColor: string;
  totalMinutes: number;
  entryCount: number;
  singleRate: EmployeeDashboardRate | null;
  mixedRates: boolean;
  missingRateLineCount: number;
  costTotals: EmployeeDashboardCurrencyTotal[];
  mixedCurrency: boolean;
};

export type ContractorDashboardActionId =
  | "record_time"
  | "resolve_rates"
  | "review_and_submit"
  | "correct_timesheet"
  | "awaiting_approval"
  | "upload_invoice"
  | "upload_cancellation_invoice"
  | "upload_replacement_invoice"
  | "review_invoice_rejection"
  | "awaiting_invoice_review"
  | "awaiting_payment"
  | "complete";

export type ContractorDashboardNextAction = {
  id: ContractorDashboardActionId;
  href: string;
};

export type AdminPriorityMetric = {
  id: "submitted" | "approved" | "invoiced" | "accepted" | "missing";
  count: number;
  href: string;
};

export type AdminStatusSegment = {
  id:
    | "submitted"
    | "rejected"
    | "approved"
    | "invoiced"
    | "invoice_rejected"
    | "accepted"
    | "paid"
    | "missing";
  count: number;
};

export type DashboardFlaggedUser = {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  initials: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  lastLoggedDate: string | null;
};

export type AdminDashboardDrilldownId =
  "submitted" | "approved" | "invoiced" | "accepted" | "missing" | "flagged";

export type AdminDashboardStoredStatusDrilldownId = Exclude<
  AdminDashboardDrilldownId,
  "missing" | "flagged"
>;

export type AdminDashboardMissingTimesheetRow = {
  memberId: string;
  memberName: string;
  memberEmail: string;
  initials: string;
  activeProjectCount: number;
  monthMinutes: number;
  lastLoggedDate: string | null;
};

export type AdminDashboardTimesheetDrilldown = {
  kind: "timesheets";
  id: AdminDashboardStoredStatusDrilldownId;
  rows: AdminTimesheetRow[];
  totalItems: number;
  fullHref: string;
};

export type AdminDashboardMissingDrilldown = {
  kind: "missing";
  id: "missing";
  rows: AdminDashboardMissingTimesheetRow[];
  totalItems: number;
  fullHref: string;
};

export type AdminDashboardFlaggedDrilldown = {
  kind: "flagged";
  id: "flagged";
  rows: DashboardFlaggedUser[];
  totalItems: number;
  fullHref: string;
};

export type AdminDashboardDrilldown =
  | AdminDashboardTimesheetDrilldown
  | AdminDashboardMissingDrilldown
  | AdminDashboardFlaggedDrilldown;

export type AdminDashboardData = {
  kind: "admin";
  greetingName: string;
  period: DashboardPeriod;
  priorityMetrics: AdminPriorityMetric[];
  statusSegments: AdminStatusSegment[];
  flaggedUsers: DashboardFlaggedUser[];
  drilldown: AdminDashboardDrilldown | null;
};

export type DashboardData = EmployeeDashboardData | ContractorDashboardData | AdminDashboardData;

type DashboardAssignment = {
  memberId: string;
  projectId: string;
  /** `null` inherits the member default — resolved through `resolveTrackingMode`, never inline. */
  trackingMode: TrackingMode | null;
  /** Carried per row so the resolver needs no second query, as in `month-overview.ts`. */
  validFrom: Date;
  member: {
    id: string;
    displayName: string;
    firstName: string;
    lastName: string;
    email: string;
    defaultTrackingMode: TrackingMode;
  };
  project: {
    id: string;
    name: string;
    colorToken: string;
  };
};

/** One declared month, as the flagging rhythm reads it: the pair, and which month it covers. */
type DashboardDeclarationPresence = {
  memberId: string;
  projectId: string;
};

type DashboardTimeEntryPresence = {
  memberId: string;
  projectId: string;
};

type DashboardInactiveWeekPresence = {
  memberId: string;
  projectId: string;
};

type DashboardLastLoggedEntry = {
  memberId: string;
  projectId: string;
  localDate: Date;
};

type DashboardExpectedContractor = {
  memberId: string;
};

type DashboardExistingTimesheet = {
  contractorMemberId: string;
};

type DashboardMemberIdentity = {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
};

type DashboardMissingExpectedContractor = {
  memberId: string;
  projectId?: string;
  member: DashboardMemberIdentity;
};

type DashboardMissingTimeEntry = {
  memberId: string;
  durationMinutes: number;
  localDate: Date;
  member: DashboardMemberIdentity;
};

type EmployeeDashboardRatePeriod = {
  id: string;
  validFrom: Date;
  validTo: Date | null;
  hourlyRate: { toString(): string } | string | number;
  currencyCode: string;
};

type EmployeeDashboardTimeEntry = {
  id: string;
  projectId: string;
  localDate: Date;
  durationMinutes: number;
  project: {
    id: string;
    name: string;
    colorToken: string;
  };
};

const dashboardStatusOrder: AdminStatusSegment["id"][] = [
  "submitted",
  "rejected",
  "approved",
  "invoiced",
  "invoice_rejected",
  "accepted",
  "paid",
  "missing",
];

export async function getDashboardDataForMember(
  member: DashboardMember,
  input: { now?: Date; drilldown?: string | string[] | null } = {},
): Promise<DashboardData> {
  const now = input.now ?? new Date();
  const period = getDashboardPeriod(member.timezone, now);

  if (member.role === "ADMIN") {
    return getAdminDashboard(member, period, parseAdminDashboardDrilldown(input.drilldown));
  }

  return getProfileDashboard(member, period, now);
}

export function parseAdminDashboardDrilldown(
  value: string | string[] | null | undefined,
): AdminDashboardDrilldownId | null {
  const raw = (Array.isArray(value) ? value.at(0) : value)?.trim().toLowerCase();

  return raw === "submitted" ||
    raw === "approved" ||
    raw === "invoiced" ||
    raw === "accepted" ||
    raw === "missing" ||
    raw === "flagged"
    ? raw
    : null;
}

export function getDashboardPeriod(timezone: string, now = new Date()): DashboardPeriod {
  const today = parseDateOnly(getTodayIsoInTimezone(timezone, now));
  const weekStart = getMonday(today);
  const monthStart = getMonthStart(today);
  const previousMonthStart = addMonths(monthStart, -1);

  return {
    today: formatDateOnly(today),
    weekStart: formatDateOnly(weekStart),
    weekEnd: formatDateOnly(getWeekEnd(weekStart)),
    monthStart: formatDateOnly(monthStart),
    monthEnd: formatDateOnly(getTimesheetMonthEnd(monthStart)),
    previousMonthStart: formatDateOnly(previousMonthStart),
    previousMonthEnd: formatDateOnly(getTimesheetMonthEnd(previousMonthStart)),
  };
}

/**
 * Which member/project pairs have nothing against them, on the rhythm each pair actually works to.
 *
 * A **tracked** pair is flagged when the current week holds no entry and no inactive-week marker,
 * which is the check this has always made.
 *
 * A **declared** pair is flagged on a monthly rhythm instead (§4 item 4). Its materialized entry
 * would satisfy the weekly check unchanged, but a declared project is *expected* to have nothing
 * until the member declares near month end — so a weekly flag would nag for three weeks out of
 * four and train people to ignore the panel. The month that matters is therefore the last one that
 * has **ended**: by the end of a month its figure should exist, and the current month is not yet
 * late. A pair whose assignment only began after that month closed is not flagged either, because
 * there was nothing to declare.
 *
 * `InactiveProjectWeek` plays no part for a declared pair: "nothing happened this week" is not a
 * statement anyone can make about a monthly figure, and it is not offered for one.
 */
export function deriveFlaggedUsers(input: {
  assignments: DashboardAssignment[];
  entries: DashboardTimeEntryPresence[];
  inactiveWeeks: DashboardInactiveWeekPresence[];
  lastLoggedEntries: DashboardLastLoggedEntry[];
  /** Declarations for the last ended month. Empty when the caller does not read them. */
  declarations?: DashboardDeclarationPresence[];
  /** The last ended month's end, `YYYY-MM-DD`, against which a declared assignment is judged. */
  declaredMonthEnd?: string;
}): DashboardFlaggedUser[] {
  const loggedPairs = new Set(input.entries.map(getMemberProjectKey));
  const inactivePairs = new Set(input.inactiveWeeks.map(getMemberProjectKey));
  const declaredPairs = new Set((input.declarations ?? []).map(getMemberProjectKey));
  const lastLoggedByPair = new Map(
    input.lastLoggedEntries.map((entry) => [
      getMemberProjectKey(entry),
      formatDateOnly(entry.localDate),
    ]),
  );
  const seenPairs = new Set<string>();
  const flagged: DashboardFlaggedUser[] = [];

  for (const assignment of input.assignments) {
    const pairKey = getMemberProjectKey(assignment);

    if (seenPairs.has(pairKey)) continue;

    if (resolveTrackingMode(assignment.member, assignment).mode === "DECLARED") {
      if (declaredPairs.has(pairKey)) continue;
      // No month has ended since the assignment began, so nothing is yet overdue.
      if (input.declaredMonthEnd && formatDateOnly(assignment.validFrom) > input.declaredMonthEnd) {
        continue;
      }

      seenPairs.add(pairKey);
      flagged.push(buildFlaggedUser(assignment, pairKey, lastLoggedByPair.get(pairKey) ?? null));
      continue;
    }

    if (loggedPairs.has(pairKey) || inactivePairs.has(pairKey)) {
      continue;
    }

    seenPairs.add(pairKey);
    flagged.push(buildFlaggedUser(assignment, pairKey, lastLoggedByPair.get(pairKey) ?? null));
  }

  return flagged.sort((left, right) => {
    const nameCompare = left.memberName.localeCompare(right.memberName);
    if (nameCompare !== 0) return nameCompare;
    return left.projectName.localeCompare(right.projectName);
  });
}

function buildFlaggedUser(
  assignment: DashboardAssignment,
  pairKey: string,
  lastLoggedDate: string | null,
): DashboardFlaggedUser {
  const memberName = getDisplayName(assignment.member);

  return {
    id: pairKey,
    memberId: assignment.memberId,
    memberName,
    memberEmail: assignment.member.email,
    initials: getInitials(memberName),
    projectId: assignment.projectId,
    projectName: assignment.project.name,
    projectColor: resolveProjectColor(assignment.project.colorToken),
    lastLoggedDate,
  };
}

export function deriveMissingTimesheetCount(input: {
  expectedContractors: DashboardExpectedContractor[];
  existingTimesheets: DashboardExistingTimesheet[];
}) {
  const existing = new Set(
    input.existingTimesheets.map((timesheet) => timesheet.contractorMemberId),
  );

  return unique(input.expectedContractors.map((contractor) => contractor.memberId)).filter(
    (memberId) => !existing.has(memberId),
  ).length;
}

export function deriveMissingTimesheetRows(input: {
  expectedContractors: DashboardMissingExpectedContractor[];
  timeEntries: DashboardMissingTimeEntry[];
  existingTimesheets: DashboardExistingTimesheet[];
}): AdminDashboardMissingTimesheetRow[] {
  const existing = new Set(
    input.existingTimesheets.map((timesheet) => timesheet.contractorMemberId),
  );
  const rowsByMember = new Map<string, AdminDashboardMissingTimesheetRow>();

  for (const expectedContractor of input.expectedContractors) {
    if (existing.has(expectedContractor.memberId)) continue;

    const row =
      rowsByMember.get(expectedContractor.memberId) ??
      buildMissingTimesheetRow(expectedContractor.member);

    row.activeProjectCount += expectedContractor.projectId ? 1 : 0;
    rowsByMember.set(expectedContractor.memberId, row);
  }

  for (const timeEntry of input.timeEntries) {
    if (existing.has(timeEntry.memberId)) continue;

    const row = rowsByMember.get(timeEntry.memberId) ?? buildMissingTimesheetRow(timeEntry.member);
    const localDate = formatDateOnly(timeEntry.localDate);

    row.monthMinutes += timeEntry.durationMinutes;
    if (!row.lastLoggedDate || localDate.localeCompare(row.lastLoggedDate) > 0) {
      row.lastLoggedDate = localDate;
    }
    rowsByMember.set(timeEntry.memberId, row);
  }

  return [...rowsByMember.values()].sort((left, right) =>
    left.memberName.localeCompare(right.memberName),
  );
}

export function buildEmployeeMonthlyProjectBreakdown(input: {
  entries: EmployeeDashboardTimeEntry[];
  ratePeriods: EmployeeDashboardRatePeriod[];
}) {
  const projects = new Map<
    string,
    EmployeeDashboardProject & {
      rateKeys: Set<string>;
      costTotalCentsByCurrency: Map<string, number>;
    }
  >();

  for (const entry of input.entries) {
    const project =
      projects.get(entry.projectId) ??
      ({
        projectId: entry.projectId,
        projectName: entry.project.name,
        projectColor: resolveProjectColor(entry.project.colorToken),
        totalMinutes: 0,
        entryCount: 0,
        singleRate: null,
        mixedRates: false,
        missingRateLineCount: 0,
        costTotals: [],
        mixedCurrency: false,
        rateKeys: new Set<string>(),
        costTotalCentsByCurrency: new Map<string, number>(),
      } satisfies EmployeeDashboardProject & {
        rateKeys: Set<string>;
        costTotalCentsByCurrency: Map<string, number>;
      });
    const rate = findEffectiveEmployeeRate(input.ratePeriods, entry.localDate);

    project.totalMinutes += entry.durationMinutes;
    project.entryCount += 1;

    if (!rate) {
      project.missingRateLineCount += 1;
    } else {
      const hourlyRate = rate.hourlyRate.toString();
      const rateKey = `${hourlyRate}:${rate.currencyCode}`;
      const amountCents = calculateLineAmountCents(entry.durationMinutes, hourlyRate);

      project.rateKeys.add(rateKey);
      project.costTotalCentsByCurrency.set(
        rate.currencyCode,
        (project.costTotalCentsByCurrency.get(rate.currencyCode) ?? 0) + amountCents,
      );
      project.singleRate = {
        hourlyRate,
        currencyCode: rate.currencyCode,
      };
    }

    project.mixedRates = project.rateKeys.size > 1;
    project.costTotals = buildDashboardCurrencyTotals(project.costTotalCentsByCurrency);
    project.mixedCurrency = project.costTotals.length > 1;
    if (project.mixedRates) project.singleRate = null;

    projects.set(entry.projectId, project);
  }

  return [...projects.values()]
    .map((project) => ({
      projectId: project.projectId,
      projectName: project.projectName,
      projectColor: project.projectColor,
      totalMinutes: project.totalMinutes,
      entryCount: project.entryCount,
      singleRate: project.singleRate,
      mixedRates: project.mixedRates,
      missingRateLineCount: project.missingRateLineCount,
      costTotals: project.costTotals,
      mixedCurrency: project.mixedCurrency,
    }))
    .sort((left, right) => {
      const minutesCompare = right.totalMinutes - left.totalMinutes;
      if (minutesCompare !== 0) return minutesCompare;
      return left.projectName.localeCompare(right.projectName);
    });
}

export function calculateAverageWeekMinutes(input: {
  monthMinutes: number;
  monthStart: string;
  today: string;
}) {
  const monthStart = parseDateOnly(input.monthStart);
  const today = parseDateOnly(input.today);
  const elapsedDays = Math.max(
    1,
    Math.floor((today.getTime() - monthStart.getTime()) / 86_400_000) + 1,
  );
  const elapsedWeeks = Math.max(1, Math.ceil(elapsedDays / 7));

  return Math.round(input.monthMinutes / elapsedWeeks);
}

// The greeting addresses the member by first name. A display name carries no name order, so no
// word of it can stand in for the first name; it is only the fallback when firstName is blank.
export function getGreetingName(member: {
  displayName: string;
  firstName: string;
  lastName: string;
}) {
  return member.firstName.trim() || getDisplayName(member);
}

export function getContractorDashboardNextAction(input: {
  status: TimesheetPreviewStatus;
  selectedMonth: string;
  totalMinutes: number;
  missingRateLineCount: number;
  mixedCurrency: boolean;
  invoices: ReadonlyArray<{
    id: string;
    role: "original" | "replacement" | "cancellation" | "corrected";
    status: "uploaded" | "accepted" | "rejected" | "replaced" | "cancelled" | "deleted";
    referencesInvoiceId: string | null;
  }>;
}): ContractorDashboardNextAction {
  const timesheetHref = `/timesheets?month=${encodeURIComponent(input.selectedMonth)}`;
  const hasRateIssue = input.missingRateLineCount > 0 || input.mixedCurrency;

  if (input.status === "not_created" || input.status === "missing") {
    if (hasRateIssue) return { id: "resolve_rates", href: timesheetHref };
    if (input.totalMinutes === 0) return { id: "record_time", href: "/time" };
    return { id: "review_and_submit", href: timesheetHref };
  }

  if (input.status === "rejected") {
    if (hasRateIssue) return { id: "resolve_rates", href: timesheetHref };
    return { id: "correct_timesheet", href: timesheetHref };
  }

  if (input.status === "submitted") return { id: "awaiting_approval", href: timesheetHref };
  if (input.status === "approved") return { id: "upload_invoice", href: timesheetHref };

  if (input.status === "invoice_rejected") {
    const rejectedInvoice = input.invoices.find(
      (invoice) => invoice.role !== "cancellation" && invoice.status === "rejected",
    );
    if (!rejectedInvoice) return { id: "review_invoice_rejection", href: timesheetHref };

    const cancellationInvoice = input.invoices.find(
      (invoice) =>
        invoice.role === "cancellation" &&
        invoice.referencesInvoiceId === rejectedInvoice.id &&
        invoice.status !== "deleted",
    );

    return cancellationInvoice
      ? { id: "upload_replacement_invoice", href: timesheetHref }
      : { id: "upload_cancellation_invoice", href: timesheetHref };
  }

  if (input.status === "invoiced") return { id: "awaiting_invoice_review", href: timesheetHref };
  if (input.status === "accepted") return { id: "awaiting_payment", href: timesheetHref };
  return { id: "complete", href: timesheetHref };
}

async function getProfileDashboard(
  member: DashboardMember,
  period: DashboardPeriod,
  now: Date,
): Promise<EmployeeDashboardData | ContractorDashboardData> {
  const [activeProjectCount, monthMinutes, previousMonthMinutes, weeklyProjects] =
    await Promise.all([
      getActiveProjectCount(member.id, period),
      getMemberMinutesInPeriod(member.id, period.monthStart, period.monthEnd),
      getMemberMinutesInPeriod(member.id, period.previousMonthStart, period.previousMonthEnd),
      getWeeklyProjectChecklist(member.id, period),
    ]);
  const base = {
    greetingName: getGreetingName(member),
    period,
    activeProjectCount,
    monthMinutes,
    previousMonthMinutes,
    averageWeekMinutes: calculateAverageWeekMinutes({
      monthMinutes,
      monthStart: period.monthStart,
      today: period.today,
    }),
    weeklyProjects,
  };

  if (member.currentProfile !== "CONTRACTOR") {
    const employeeMonth = await getEmployeeMonthlyBreakdown(member.id, period);

    return {
      ...base,
      kind: "employee",
      monthStatus: getEmployeeMonthStatus({
        activeProjectCount,
        monthMinutes,
        missingRateLineCount: employeeMonth.missingRateLineCount,
      }),
      projectBreakdown: employeeMonth.projectBreakdown,
      costTotals: employeeMonth.costTotals,
      missingRateLineCount: employeeMonth.missingRateLineCount,
      mixedCurrency: employeeMonth.costTotals.length > 1,
    };
  }

  const timesheet = await getContractorTimesheetMonthlyPreview({
    memberId: member.id,
    monthStart: parseDateOnly(period.monthStart),
    now,
  });

  return {
    ...base,
    kind: "contractor",
    timesheet: {
      status: timesheet.status,
      selectedMonth: timesheet.selectedMonth,
      totalAmount: timesheet.totalAmount,
      currencyCode: timesheet.currencyCode,
      mixedCurrency: timesheet.mixedCurrency,
      missingRateLineCount: timesheet.missingRateLineCount,
      totalMinutes: timesheet.totalMinutes,
      invoiceUploaded: Boolean(timesheet.invoice),
    },
    nextAction: getContractorDashboardNextAction({
      status: timesheet.status,
      selectedMonth: timesheet.selectedMonth,
      totalMinutes: timesheet.totalMinutes,
      missingRateLineCount: timesheet.missingRateLineCount,
      mixedCurrency: timesheet.mixedCurrency,
      invoices: timesheet.invoices,
    }),
  };
}

async function getEmployeeMonthlyBreakdown(memberId: string, period: DashboardPeriod) {
  const ratePeriodWhere = {
    memberId,
    validFrom: {
      lte: parseDateOnly(period.monthEnd),
    },
    OR: [{ validTo: null }, { validTo: { gt: parseDateOnly(period.monthStart) } }],
  };
  const [entries, ratePeriods] = await Promise.all([
    prisma.timeEntry.findMany({
      where: {
        memberId,
        deletedAt: null,
        localDate: {
          gte: parseDateOnly(period.monthStart),
          lte: parseDateOnly(period.monthEnd),
        },
      },
      orderBy: [{ localDate: "asc" }, { project: { name: "asc" } }],
      select: {
        id: true,
        projectId: true,
        localDate: true,
        durationMinutes: true,
        project: {
          select: {
            id: true,
            name: true,
            colorToken: true,
          },
        },
      },
    }),
    prisma.memberDefaultRatePeriod.findMany({
      where: ratePeriodWhere,
      orderBy: [{ validFrom: "asc" }],
      select: {
        id: true,
        validFrom: true,
        validTo: true,
        hourlyRate: true,
        currencyCode: true,
      },
    }),
  ]);
  const projectBreakdown = buildEmployeeMonthlyProjectBreakdown({
    entries,
    ratePeriods,
  });
  const totalCentsByCurrency = new Map<string, number>();
  let missingRateLineCount = 0;

  for (const project of projectBreakdown) {
    missingRateLineCount += project.missingRateLineCount;

    for (const total of project.costTotals) {
      totalCentsByCurrency.set(
        total.currencyCode,
        (totalCentsByCurrency.get(total.currencyCode) ?? 0) + moneyToCents(total.amount),
      );
    }
  }

  return {
    projectBreakdown,
    costTotals: buildDashboardCurrencyTotals(totalCentsByCurrency),
    missingRateLineCount,
  };
}

function getEmployeeMonthStatus(input: {
  activeProjectCount: number;
  monthMinutes: number;
  missingRateLineCount: number;
}): EmployeeMonthStatus {
  if (input.activeProjectCount === 0) return "no_projects";
  if (input.monthMinutes === 0) return "not_started";
  if (input.missingRateLineCount > 0) return "missing_rates";
  return "tracked";
}

async function getAdminDashboard(
  member: DashboardMember,
  period: DashboardPeriod,
  requestedDrilldown: AdminDashboardDrilldownId | null,
): Promise<AdminDashboardData> {
  const [statusCounts, missingCount, flaggedUsers] = await Promise.all([
    getAdminTimesheetStatusCounts(period),
    getMissingTimesheetCount(period),
    getFlaggedUsers(period),
  ]);
  const drilldown = await getAdminDashboardDrilldown(period, requestedDrilldown, flaggedUsers);
  const getStatusCount = (status: string) => statusCounts.get(status) ?? 0;
  const statusSegments = buildStatusSegments(statusCounts, missingCount);

  return {
    kind: "admin",
    greetingName: getGreetingName(member),
    period,
    priorityMetrics: [
      {
        id: "submitted",
        count: getStatusCount("SUBMITTED"),
        href: "/dashboard?drilldown=submitted",
      },
      {
        id: "approved",
        count: getStatusCount("APPROVED"),
        href: "/dashboard?drilldown=approved",
      },
      {
        id: "invoiced",
        count: getStatusCount("INVOICED"),
        href: "/dashboard?drilldown=invoiced",
      },
      {
        id: "accepted",
        count: getStatusCount("ACCEPTED"),
        href: "/dashboard?drilldown=accepted",
      },
      {
        id: "missing",
        count: missingCount,
        href: "/dashboard?drilldown=missing",
      },
    ],
    statusSegments,
    flaggedUsers,
    drilldown,
  };
}

async function getAdminDashboardDrilldown(
  period: DashboardPeriod,
  drilldown: AdminDashboardDrilldownId | null,
  flaggedUsers: DashboardFlaggedUser[],
): Promise<AdminDashboardDrilldown | null> {
  if (!drilldown) return null;

  if (drilldown === "flagged") {
    return {
      kind: "flagged",
      id: drilldown,
      rows: flaggedUsers,
      totalItems: flaggedUsers.length,
      fullHref: `/admin/reports?period=week&anchor=${period.weekStart}&view=USER`,
    };
  }

  if (drilldown === "missing") {
    const rows = await getMissingTimesheetRows(period);

    return {
      kind: "missing",
      id: drilldown,
      rows,
      totalItems: rows.length,
      fullHref: `/admin/reports?period=month&anchor=${period.monthStart}&view=USER`,
    };
  }

  const monthParam = period.monthStart.slice(0, 7);
  const status = dashboardDrilldownToTimesheetStatus(drilldown);
  const result = await listTimesheetsForAdmin({
    status,
    month: monthParam,
    pageSize: "8",
  });

  return {
    kind: "timesheets",
    id: drilldown,
    rows: result.rows,
    totalItems: result.totalItems,
    fullHref: `/admin/timesheets?status=${status}&month=${monthParam}`,
  };
}

async function getActiveProjectCount(memberId: string, period: DashboardPeriod) {
  const rows = await prisma.projectAssignment.findMany({
    where: {
      memberId,
      active: true,
      validFrom: {
        lte: parseDateOnly(period.monthEnd),
      },
      OR: [{ validTo: null }, { validTo: { gte: parseDateOnly(period.monthStart) } }],
      project: activeProjectWhere(period.monthStart, period.monthEnd),
    },
    distinct: ["projectId"],
    select: {
      projectId: true,
    },
  });

  return rows.length;
}

async function getMemberMinutesInPeriod(memberId: string, periodStart: string, periodEnd: string) {
  const result = await prisma.timeEntry.aggregate({
    where: {
      memberId,
      deletedAt: null,
      localDate: {
        gte: parseDateOnly(periodStart),
        lte: parseDateOnly(periodEnd),
      },
    },
    _sum: {
      durationMinutes: true,
    },
  });

  return result._sum.durationMinutes ?? 0;
}

async function getWeeklyProjectChecklist(
  memberId: string,
  period: DashboardPeriod,
): Promise<DashboardWeeklyProject[]> {
  const [assignments, entries, inactiveWeeks] = await Promise.all([
    prisma.projectAssignment.findMany({
      where: {
        memberId,
        active: true,
        validFrom: {
          lte: parseDateOnly(period.weekEnd),
        },
        OR: [{ validTo: null }, { validTo: { gte: parseDateOnly(period.weekStart) } }],
        project: activeProjectWhere(period.weekStart, period.weekEnd),
      },
      orderBy: [{ project: { name: "asc" } }, { validFrom: "asc" }],
      distinct: ["projectId"],
      select: {
        projectId: true,
        project: {
          select: {
            id: true,
            name: true,
            colorToken: true,
          },
        },
      },
    }),
    prisma.timeEntry.findMany({
      where: {
        memberId,
        deletedAt: null,
        localDate: {
          gte: parseDateOnly(period.weekStart),
          lte: parseDateOnly(period.weekEnd),
        },
      },
      distinct: ["projectId"],
      select: {
        projectId: true,
      },
    }),
    prisma.inactiveProjectWeek.findMany({
      where: {
        memberId,
        weekStartDate: parseDateOnly(period.weekStart),
      },
      select: {
        projectId: true,
      },
    }),
  ]);
  const loggedProjectIds = new Set(entries.map((entry) => entry.projectId));
  const inactiveProjectIds = new Set(inactiveWeeks.map((inactiveWeek) => inactiveWeek.projectId));

  return assignments.map((assignment) => ({
    projectId: assignment.projectId,
    projectName: assignment.project.name,
    projectColor: resolveProjectColor(assignment.project.colorToken),
    logged: loggedProjectIds.has(assignment.projectId),
    inactive: inactiveProjectIds.has(assignment.projectId),
  }));
}

async function getAdminTimesheetStatusCounts(period: DashboardPeriod) {
  const groups = await prisma.timesheet.groupBy({
    by: ["status"],
    where: {
      periodStart: parseDateOnly(period.monthStart),
    },
    _count: {
      _all: true,
    },
  });

  return new Map<string, number>(groups.map((group) => [group.status, group._count._all]));
}

function buildStatusSegments(statusCounts: Map<string, number>, missingCount: number) {
  return dashboardStatusOrder
    .map((status): AdminStatusSegment => {
      const dbStatus = status.toUpperCase();

      return {
        id: status,
        count: status === "missing" ? missingCount : (statusCounts.get(dbStatus) ?? 0),
      };
    })
    .filter((segment) => segment.count > 0 || isDefaultStatusSegment(segment.id));
}

function isDefaultStatusSegment(status: AdminStatusSegment["id"]) {
  return ["submitted", "approved", "invoiced", "accepted", "paid", "missing"].includes(status);
}

async function getMissingTimesheetCount(period: DashboardPeriod) {
  const [assignmentContractors, timeEntryContractors, existingTimesheets] = await Promise.all([
    prisma.projectAssignment.findMany({
      where: {
        active: true,
        validFrom: {
          lte: parseDateOnly(period.monthEnd),
        },
        OR: [{ validTo: null }, { validTo: { gte: parseDateOnly(period.monthStart) } }],
        member: activeContractorWhere(),
        project: activeProjectWhere(period.monthStart, period.monthEnd),
      },
      distinct: ["memberId"],
      select: {
        memberId: true,
      },
    }),
    prisma.timeEntry.findMany({
      where: {
        deletedAt: null,
        localDate: {
          gte: parseDateOnly(period.monthStart),
          lte: parseDateOnly(period.monthEnd),
        },
        member: activeContractorWhere(),
      },
      distinct: ["memberId"],
      select: {
        memberId: true,
      },
    }),
    prisma.timesheet.findMany({
      where: {
        periodStart: parseDateOnly(period.monthStart),
      },
      select: {
        contractorMemberId: true,
      },
    }),
  ]);

  return deriveMissingTimesheetCount({
    expectedContractors: [...assignmentContractors, ...timeEntryContractors],
    existingTimesheets,
  });
}

async function getMissingTimesheetRows(period: DashboardPeriod) {
  const [assignmentContractors, timeEntryContractors, existingTimesheets] = await Promise.all([
    prisma.projectAssignment.findMany({
      where: {
        active: true,
        validFrom: {
          lte: parseDateOnly(period.monthEnd),
        },
        OR: [{ validTo: null }, { validTo: { gte: parseDateOnly(period.monthStart) } }],
        member: activeContractorWhere(),
        project: activeProjectWhere(period.monthStart, period.monthEnd),
      },
      distinct: ["memberId", "projectId"],
      select: {
        memberId: true,
        projectId: true,
        member: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    }),
    prisma.timeEntry.findMany({
      where: {
        deletedAt: null,
        localDate: {
          gte: parseDateOnly(period.monthStart),
          lte: parseDateOnly(period.monthEnd),
        },
        member: activeContractorWhere(),
      },
      select: {
        memberId: true,
        durationMinutes: true,
        localDate: true,
        member: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    }),
    prisma.timesheet.findMany({
      where: {
        periodStart: parseDateOnly(period.monthStart),
      },
      select: {
        contractorMemberId: true,
      },
    }),
  ]);

  return deriveMissingTimesheetRows({
    expectedContractors: assignmentContractors,
    timeEntries: timeEntryContractors,
    existingTimesheets,
  });
}

async function getFlaggedUsers(period: DashboardPeriod) {
  const assignments = await prisma.projectAssignment.findMany({
    where: {
      active: true,
      validFrom: {
        lte: parseDateOnly(period.weekEnd),
      },
      OR: [{ validTo: null }, { validTo: { gte: parseDateOnly(period.weekStart) } }],
      member: {
        status: "ACTIVE",
        deletedAt: null,
      },
      project: activeProjectWhere(period.weekStart, period.weekEnd),
    },
    orderBy: [{ member: { displayName: "asc" } }, { project: { name: "asc" } }],
    select: {
      memberId: true,
      projectId: true,
      trackingMode: true,
      validFrom: true,
      member: {
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          email: true,
          defaultTrackingMode: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          colorToken: true,
        },
      },
    },
  });

  if (assignments.length === 0) return [];

  const memberIds = unique(assignments.map((assignment) => assignment.memberId));
  const projectIds = unique(assignments.map((assignment) => assignment.projectId));
  /* The last month that has *ended*. A declared figure arrives at month end, so the current month
     is never late and flagging against it would nag for most of every month. */
  const declaredMonthStart = parseDateOnly(period.previousMonthStart);
  const [entries, inactiveWeeks, lastEntries, declarations] = await Promise.all([
    prisma.timeEntry.findMany({
      where: {
        memberId: {
          in: memberIds,
        },
        projectId: {
          in: projectIds,
        },
        deletedAt: null,
        localDate: {
          gte: parseDateOnly(period.weekStart),
          lte: parseDateOnly(period.weekEnd),
        },
      },
      distinct: ["memberId", "projectId"],
      select: {
        memberId: true,
        projectId: true,
      },
    }),
    prisma.inactiveProjectWeek.findMany({
      where: {
        memberId: {
          in: memberIds,
        },
        projectId: {
          in: projectIds,
        },
        weekStartDate: parseDateOnly(period.weekStart),
      },
      select: {
        memberId: true,
        projectId: true,
      },
    }),
    prisma.timeEntry.findMany({
      where: {
        memberId: {
          in: memberIds,
        },
        projectId: {
          in: projectIds,
        },
        deletedAt: null,
        localDate: {
          lt: parseDateOnly(period.weekStart),
        },
      },
      orderBy: [{ localDate: "desc" }, { updatedAt: "desc" }],
      select: {
        memberId: true,
        projectId: true,
        localDate: true,
      },
    }),
    prisma.monthlyHourDeclaration.findMany({
      where: {
        memberId: {
          in: memberIds,
        },
        projectId: {
          in: projectIds,
        },
        periodStart: declaredMonthStart,
      },
      select: {
        memberId: true,
        projectId: true,
      },
    }),
  ]);
  const latestEntriesByPair = new Map<string, DashboardLastLoggedEntry>();

  for (const entry of lastEntries) {
    const key = getMemberProjectKey(entry);
    if (!latestEntriesByPair.has(key)) latestEntriesByPair.set(key, entry);
  }

  return deriveFlaggedUsers({
    assignments,
    entries,
    inactiveWeeks,
    lastLoggedEntries: [...latestEntriesByPair.values()],
    declarations,
    declaredMonthEnd: period.previousMonthEnd,
  });
}

function activeProjectWhere(periodStart: string, periodEnd: string) {
  return {
    deletedAt: null,
    status: "ACTIVE" as const,
    AND: [
      { OR: [{ startsOn: null }, { startsOn: { lte: parseDateOnly(periodEnd) } }] },
      { OR: [{ endsOn: null }, { endsOn: { gte: parseDateOnly(periodStart) } }] },
    ],
  };
}

function activeContractorWhere() {
  return {
    currentProfile: "CONTRACTOR" as const,
    status: "ACTIVE" as const,
    deletedAt: null,
  };
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function resolveProjectColor(colorToken: string) {
  return projectColorValues[isProjectColorToken(colorToken) ? colorToken : "teal"];
}

function getDisplayName(member: {
  displayName: string;
  firstName: string;
  lastName: string;
  email?: string;
}) {
  return (
    member.displayName.trim() ||
    [member.firstName.trim(), member.lastName.trim()].filter(Boolean).join(" ") ||
    member.email ||
    ""
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function buildMissingTimesheetRow(
  member: DashboardMemberIdentity,
): AdminDashboardMissingTimesheetRow {
  const memberName = getDisplayName(member);

  return {
    memberId: member.id,
    memberName,
    memberEmail: member.email,
    initials: getInitials(memberName),
    activeProjectCount: 0,
    monthMinutes: 0,
    lastLoggedDate: null,
  };
}

function dashboardDrilldownToTimesheetStatus(id: AdminDashboardStoredStatusDrilldownId) {
  if (id === "submitted") return "SUBMITTED";
  if (id === "approved") return "APPROVED";
  if (id === "invoiced") return "INVOICED";
  return "ACCEPTED";
}

function findEffectiveEmployeeRate(rates: EmployeeDashboardRatePeriod[], localDate: Date) {
  return (
    rates
      .filter((rate) => rate.validFrom <= localDate && (!rate.validTo || rate.validTo > localDate))
      .sort((left, right) => right.validFrom.getTime() - left.validFrom.getTime())[0] ?? null
  );
}

function buildDashboardCurrencyTotals(
  totalCentsByCurrency: Map<string, number>,
): EmployeeDashboardCurrencyTotal[] {
  return [...totalCentsByCurrency.entries()]
    .map(([currencyCode, amountCents]) => ({
      currencyCode,
      amount: centsToMoney(amountCents),
    }))
    .sort((left, right) => left.currencyCode.localeCompare(right.currencyCode));
}

function moneyToCents(value: string) {
  return Math.round(Number(value) * 100);
}

function getMemberProjectKey(input: { memberId: string; projectId: string }) {
  return `${input.memberId}:${input.projectId}`;
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}
