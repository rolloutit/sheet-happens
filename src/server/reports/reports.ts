import { isProjectColorToken, projectColorValues } from "@/src/lib/project-colors";
import { prisma } from "@/src/server/db/client";
import { formatDateOnly, normalizeDateOnly } from "@/src/server/time-tracking";

export type ReportMode = "COST_FREE" | "INTERNAL";
export type ReportView = "USER" | "PROJECT";
export type ReportMemberProfile = "EMPLOYEE" | "CONTRACTOR";
export type ReportTimeEntrySource = "GRID" | "FORM" | "TIMER";
export type ReportRateSource = "MEMBER_DEFAULT" | "PROJECT_OVERRIDE";

export type ReportFiltersInput = {
  periodStart: Date;
  periodEnd: Date;
  mode?: ReportMode;
  view?: ReportView;
  projectId?: string | null;
  projectGroupId?: string | null;
  memberId?: string | null;
};

export type NormalizedReportFilters = {
  periodStart: Date;
  periodEnd: Date;
  mode: ReportMode;
  view: ReportView;
  projectId: string | null;
  projectGroupId: string | null;
  memberId: string | null;
};

export type ReportFilterLabels = {
  projectName: string | null;
  projectGroupName: string | null;
  memberName: string | null;
};

export type ReportSnapshotFilters = {
  projectId: string | null;
  projectName: string | null;
  projectGroupId: string | null;
  projectGroupName: string | null;
  memberId: string | null;
  memberName: string | null;
};

export type ReportSnapshotPeriod = {
  start: string;
  end: string;
  boundary: "member_timezone";
  timezones: string[];
};

export type ReportLineMember = {
  id: string;
  name: string;
  email: string;
  initials: string;
  profile: ReportMemberProfile;
  timezone: string;
};

export type ReportLineProject = {
  id: string;
  name: string;
  color: string;
  isInternal: boolean;
};

export type ReportLineBase = {
  id: string;
  localDate: string;
  durationMinutes: number;
  description: string;
  source: ReportTimeEntrySource;
  member: ReportLineMember;
  project: ReportLineProject;
};

export type ReportCostFreeLine = ReportLineBase;

export type ReportLineRate = {
  hourlyRate: string;
  currencyCode: string;
  source: ReportRateSource;
  sourceRatePeriodId: string;
};

export type ReportInternalLine = ReportLineBase & {
  rate: ReportLineRate | null;
  currencyCode: string | null;
  amount: string | null;
};

export type ReportCurrencyTotal = {
  currencyCode: string;
  amount: string;
};

export type ReportGroupBase = {
  key: string;
  kind: ReportView;
  label: string;
  totalMinutes: number;
  entryCount: number;
  percentageOfTotal: number;
  color: string | null;
  initials: string | null;
  profile: ReportMemberProfile | null;
  isInternalProject: boolean | null;
};

export type ReportCostFreeGroup = ReportGroupBase;

export type ReportInternalGroup = ReportGroupBase & {
  currencyTotals: ReportCurrencyTotal[];
  missingRateLineCount: number;
  mixedCurrency: boolean;
};

export type ReportSummaryBase = {
  totalMinutes: number;
  entryCount: number;
  peopleCount: number;
  projectCount: number;
  averageMinutesPerPerson: number;
};

export type ReportInternalSummary = ReportSummaryBase & {
  currencyTotals: ReportCurrencyTotal[];
  missingRateLineCount: number;
  mixedCurrency: boolean;
};

export type ReportWarning =
  | {
      code: "MISSING_RATE";
      lineCount: number;
    }
  | {
      code: "MIXED_CURRENCY";
      currencyCodes: string[];
    };

export type ReportSnapshotBase = {
  schemaVersion: 1;
  generatedAt: string;
  mode: ReportMode;
  view: ReportView;
  period: ReportSnapshotPeriod;
  filters: ReportSnapshotFilters;
};

export type ReportCostFreeSnapshot = ReportSnapshotBase & {
  mode: "COST_FREE";
  summary: ReportSummaryBase;
  groups: ReportCostFreeGroup[];
  lines: ReportCostFreeLine[];
  warnings: [];
};

export type ReportInternalSnapshot = ReportSnapshotBase & {
  mode: "INTERNAL";
  summary: ReportInternalSummary;
  groups: ReportInternalGroup[];
  lines: ReportInternalLine[];
  warnings: ReportWarning[];
};

export type ReportSnapshot = ReportCostFreeSnapshot | ReportInternalSnapshot;

export type ReportFilterOption = {
  value: string;
  label: string;
  caption?: string | null;
};

export type ReportFilterOptions = {
  projects: ReportFilterOption[];
  projectGroups: ReportFilterOption[];
  members: ReportFilterOption[];
};

type DecimalLike = {
  toString(): string;
};

export type ReportRatePeriodRecord = {
  id: string;
  validFrom: Date;
  validTo: Date | null;
  hourlyRate: DecimalLike | string | number;
  currencyCode: string;
};

export type ReportTimeEntryRecord = {
  id: string;
  localDate: Date;
  durationMinutes: number;
  description: string;
  source: ReportTimeEntrySource;
  timezone: string;
  createdAt: Date;
  member: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    displayName: string;
    currentProfile: ReportMemberProfile;
    timezone: string;
    defaultRatePeriods: ReportRatePeriodRecord[];
  };
  project: {
    id: string;
    name: string;
    colorToken: string;
    isInternal: boolean;
  };
  projectAssignment: {
    overrideRates: ReportRatePeriodRecord[];
  };
};

type ReportTimeEntryFindManyArgs = {
  where: Record<string, unknown>;
  orderBy: Array<Record<string, unknown>>;
  select: ReturnType<typeof buildReportTimeEntrySelect>;
};

type ReportDb = {
  timeEntry: {
    findMany(args: ReportTimeEntryFindManyArgs): Promise<ReportTimeEntryRecord[]>;
  };
  project: {
    findUnique(args: {
      where: { id: string };
      select: { name: true };
    }): Promise<{ name: string } | null>;
    findMany(args: {
      where: { deletedAt: null };
      orderBy: Array<Record<string, "asc" | "desc">>;
      select: { id: true; name: true; status: true };
    }): Promise<Array<{ id: string; name: string; status: string }>>;
  };
  projectGroup: {
    findUnique(args: {
      where: { id: string };
      select: { name: true };
    }): Promise<{ name: string } | null>;
    findMany(args: {
      where: { deletedAt: null };
      orderBy: Array<Record<string, "asc" | "desc">>;
      select: { id: true; name: true; active: true };
    }): Promise<Array<{ id: string; name: string; active: boolean }>>;
  };
  member: {
    findUnique(args: {
      where: { id: string };
      select: MemberLabelSelect;
    }): Promise<MemberLabelRecord | null>;
    findMany(args: {
      where: { deletedAt: null };
      orderBy: Array<Record<string, "asc" | "desc">>;
      select: MemberLabelSelect & { id: true; currentProfile: true };
    }): Promise<Array<MemberLabelRecord & { id: string; currentProfile: ReportMemberProfile }>>;
  };
};

type MemberLabelSelect = {
  email: true;
  firstName: true;
  lastName: true;
  displayName: true;
};

type MemberLabelRecord = {
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
};

export type ReportSnapshotDeps = {
  db?: unknown;
  now?: () => Date;
};

export type BuildReportSnapshotInput = {
  entries: ReportTimeEntryRecord[];
  filters: NormalizedReportFilters;
  generatedAt: Date;
  filterLabels?: Partial<ReportFilterLabels>;
};

export class ReportSnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportSnapshotError";
  }
}

export async function getTimeEntryReportSnapshot(
  input: ReportFiltersInput,
  deps: ReportSnapshotDeps = {},
): Promise<ReportSnapshot> {
  const filters = normalizeReportFilters(input);
  const db = (deps.db ?? prisma) as ReportDb;
  const where = buildReportTimeEntryWhere(filters);
  const ratePeriodWhere = buildRatePeriodOverlapWhere(filters.periodStart, filters.periodEnd);
  const select = buildReportTimeEntrySelect(ratePeriodWhere);

  const [entries, filterLabels] = await Promise.all([
    db.timeEntry.findMany({
      where,
      orderBy: [{ localDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select,
    }),
    loadReportFilterLabels(db, filters),
  ]);

  return buildReportSnapshot({
    entries,
    filters,
    generatedAt: deps.now?.() ?? new Date(),
    filterLabels,
  });
}

export async function listReportFilterOptions(
  deps: Pick<ReportSnapshotDeps, "db"> = {},
): Promise<ReportFilterOptions> {
  const db = (deps.db ?? prisma) as ReportDb;
  const [projects, projectGroups, members] = await Promise.all([
    db.project.findMany({
      where: { deletedAt: null },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, status: true },
    }),
    db.projectGroup.findMany({
      where: { deletedAt: null },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, active: true },
    }),
    db.member.findMany({
      where: { deletedAt: null },
      orderBy: [{ displayName: "asc" }, { email: "asc" }],
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        currentProfile: true,
      },
    }),
  ]);

  return {
    projects: projects.map((project) => ({
      value: project.id,
      label: project.name,
      caption: project.status.toLowerCase(),
    })),
    projectGroups: projectGroups.map((group) => ({
      value: group.id,
      label: group.name,
      caption: group.active ? "active" : "inactive",
    })),
    members: members.map((member) => ({
      value: member.id,
      label: getMemberName(member),
      caption: member.email,
    })),
  };
}

export function normalizeReportFilters(input: ReportFiltersInput): NormalizedReportFilters {
  const periodStart = normalizeDateOnly(input.periodStart, "Choose a valid report start date.");
  const periodEnd = normalizeDateOnly(input.periodEnd, "Choose a valid report end date.");

  if (periodEnd < periodStart) {
    throw new ReportSnapshotError("Report end date must be after the start date.");
  }

  return {
    periodStart,
    periodEnd,
    mode: input.mode ?? "COST_FREE",
    view: input.view ?? "USER",
    projectId: input.projectId ?? null,
    projectGroupId: input.projectGroupId ?? null,
    memberId: input.memberId ?? null,
  };
}

export function buildReportTimeEntryWhere(filters: NormalizedReportFilters) {
  const where: Record<string, unknown> = {
    deletedAt: null,
    localDate: {
      gte: filters.periodStart,
      lte: filters.periodEnd,
    },
  };

  if (filters.memberId) {
    where.memberId = filters.memberId;
  }

  const projectFilter: Record<string, unknown> = {};

  if (filters.projectId) {
    where.projectId = filters.projectId;
  }

  if (filters.projectGroupId) {
    projectFilter.groupProjects = {
      some: {
        projectGroupId: filters.projectGroupId,
      },
    };
  }

  if (Object.keys(projectFilter).length > 0) {
    where.project = projectFilter;
  }

  return where;
}

export function buildReportSnapshot(input: BuildReportSnapshotInput): ReportSnapshot {
  if (input.filters.mode === "INTERNAL") {
    return buildInternalReportSnapshot(input);
  }

  return buildCostFreeReportSnapshot(input);
}

export function resolveReportLineRate(input: {
  memberProfile: ReportMemberProfile;
  localDate: Date;
  memberRates: ReportRatePeriodRecord[];
  assignmentRates: ReportRatePeriodRecord[];
}): ReportLineRate | null {
  const assignmentRate =
    input.memberProfile === "CONTRACTOR"
      ? findEffectiveRate(input.assignmentRates, input.localDate)
      : null;
  const rate = assignmentRate ?? findEffectiveRate(input.memberRates, input.localDate);

  if (!rate) return null;

  return {
    hourlyRate: rate.hourlyRate.toString(),
    currencyCode: rate.currencyCode,
    source: assignmentRate ? "PROJECT_OVERRIDE" : "MEMBER_DEFAULT",
    sourceRatePeriodId: rate.id,
  };
}

function buildCostFreeReportSnapshot(input: BuildReportSnapshotInput): ReportCostFreeSnapshot {
  const lines = input.entries.map(mapCostFreeLine);
  const summary = buildBaseSummary(lines);

  return {
    ...buildSnapshotBase(input),
    mode: "COST_FREE",
    summary,
    groups: buildCostFreeGroups(lines, input.filters.view, summary.totalMinutes),
    lines,
    warnings: [],
  };
}

function buildInternalReportSnapshot(input: BuildReportSnapshotInput): ReportInternalSnapshot {
  const lines = input.entries.map(mapInternalLine);
  const baseSummary = buildBaseSummary(lines);
  const currencyTotals = buildCurrencyTotals(lines);
  const missingRateLineCount = lines.filter((line) => !line.rate).length;
  const warnings = buildInternalWarnings(currencyTotals, missingRateLineCount);
  const summary = {
    ...baseSummary,
    currencyTotals,
    missingRateLineCount,
    mixedCurrency: currencyTotals.length > 1,
  };

  return {
    ...buildSnapshotBase(input),
    mode: "INTERNAL",
    summary,
    groups: buildInternalGroups(lines, input.filters.view, summary.totalMinutes),
    lines,
    warnings,
  };
}

function buildSnapshotBase(input: BuildReportSnapshotInput): ReportSnapshotBase {
  return {
    schemaVersion: 1,
    generatedAt: input.generatedAt.toISOString(),
    mode: input.filters.mode,
    view: input.filters.view,
    period: {
      start: formatDateOnly(input.filters.periodStart),
      end: formatDateOnly(input.filters.periodEnd),
      boundary: "member_timezone",
      timezones: [...new Set(input.entries.map((entry) => entry.timezone || entry.member.timezone))]
        .filter(Boolean)
        .sort(),
    },
    filters: {
      projectId: input.filters.projectId,
      projectName: input.filterLabels?.projectName ?? null,
      projectGroupId: input.filters.projectGroupId,
      projectGroupName: input.filterLabels?.projectGroupName ?? null,
      memberId: input.filters.memberId,
      memberName: input.filterLabels?.memberName ?? null,
    },
  };
}

function mapCostFreeLine(entry: ReportTimeEntryRecord): ReportCostFreeLine {
  return mapBaseLine(entry);
}

function mapInternalLine(entry: ReportTimeEntryRecord): ReportInternalLine {
  const rate = resolveReportLineRate({
    memberProfile: entry.member.currentProfile,
    localDate: entry.localDate,
    memberRates: entry.member.defaultRatePeriods,
    assignmentRates: entry.projectAssignment.overrideRates,
  });
  const amount = rate
    ? centsToMoney(calculateLineAmountCents(entry.durationMinutes, rate.hourlyRate))
    : null;

  return {
    ...mapBaseLine(entry),
    rate,
    currencyCode: rate?.currencyCode ?? null,
    amount,
  };
}

function mapBaseLine(entry: ReportTimeEntryRecord): ReportLineBase {
  const memberName = getMemberName(entry.member);

  return {
    id: entry.id,
    localDate: formatDateOnly(entry.localDate),
    durationMinutes: entry.durationMinutes,
    description: entry.description,
    source: entry.source,
    member: {
      id: entry.member.id,
      name: memberName,
      email: entry.member.email,
      initials: getInitials(memberName),
      profile: entry.member.currentProfile,
      timezone: entry.member.timezone,
    },
    project: {
      id: entry.project.id,
      name: entry.project.name,
      color: resolveProjectColor(entry.project.colorToken),
      isInternal: entry.project.isInternal,
    },
  };
}

function buildBaseSummary(lines: ReportLineBase[]): ReportSummaryBase {
  const totalMinutes = lines.reduce((total, line) => total + line.durationMinutes, 0);
  const peopleCount = new Set(lines.map((line) => line.member.id)).size;

  return {
    totalMinutes,
    entryCount: lines.length,
    peopleCount,
    projectCount: new Set(lines.map((line) => line.project.id)).size,
    averageMinutesPerPerson: peopleCount === 0 ? 0 : Math.round(totalMinutes / peopleCount),
  };
}

function buildCostFreeGroups(
  lines: ReportCostFreeLine[],
  view: ReportView,
  totalMinutes: number,
): ReportCostFreeGroup[] {
  return buildGroupDrafts(lines, view, totalMinutes).map((group) => ({
    ...group.base,
  }));
}

function buildInternalGroups(
  lines: ReportInternalLine[],
  view: ReportView,
  totalMinutes: number,
): ReportInternalGroup[] {
  return buildGroupDrafts(lines, view, totalMinutes).map((group) => {
    const groupLines = group.lines as ReportInternalLine[];
    const currencyTotals = buildCurrencyTotals(groupLines);

    return {
      ...group.base,
      currencyTotals,
      missingRateLineCount: groupLines.filter((line) => !line.rate).length,
      mixedCurrency: currencyTotals.length > 1,
    };
  });
}

function buildGroupDrafts<TLine extends ReportLineBase>(
  lines: TLine[],
  view: ReportView,
  totalMinutes: number,
) {
  const groups = new Map<string, { base: ReportGroupBase; lines: TLine[] }>();

  for (const line of lines) {
    const identity = getGroupIdentity(line, view);
    const existing =
      groups.get(identity.key) ??
      ({
        base: {
          ...identity,
          totalMinutes: 0,
          entryCount: 0,
          percentageOfTotal: 0,
        },
        lines: [],
      } satisfies { base: ReportGroupBase; lines: TLine[] });

    existing.base.totalMinutes += line.durationMinutes;
    existing.base.entryCount += 1;
    existing.lines.push(line);
    groups.set(identity.key, existing);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      base: {
        ...group.base,
        percentageOfTotal:
          totalMinutes === 0
            ? 0
            : Number(((group.base.totalMinutes / totalMinutes) * 100).toFixed(2)),
      },
    }))
    .sort((left, right) => {
      if (right.base.totalMinutes !== left.base.totalMinutes) {
        return right.base.totalMinutes - left.base.totalMinutes;
      }

      return left.base.label.localeCompare(right.base.label);
    });
}

function getGroupIdentity(line: ReportLineBase, view: ReportView) {
  if (view === "PROJECT") {
    return {
      key: line.project.id,
      kind: "PROJECT" as const,
      label: line.project.name,
      color: line.project.color,
      initials: null,
      profile: null,
      isInternalProject: line.project.isInternal,
    };
  }

  return {
    key: line.member.id,
    kind: "USER" as const,
    label: line.member.name,
    color: null,
    initials: line.member.initials,
    profile: line.member.profile,
    isInternalProject: null,
  };
}

function buildCurrencyTotals(lines: ReportInternalLine[]): ReportCurrencyTotal[] {
  const totals = new Map<string, number>();

  for (const line of lines) {
    if (!line.currencyCode || !line.amount) continue;

    totals.set(line.currencyCode, (totals.get(line.currencyCode) ?? 0) + moneyToCents(line.amount));
  }

  return [...totals.entries()]
    .map(([currencyCode, amountCents]) => ({
      currencyCode,
      amount: centsToMoney(amountCents),
    }))
    .sort((left, right) => left.currencyCode.localeCompare(right.currencyCode));
}

function buildInternalWarnings(
  currencyTotals: ReportCurrencyTotal[],
  missingRateLineCount: number,
): ReportWarning[] {
  const warnings: ReportWarning[] = [];

  if (missingRateLineCount > 0) {
    warnings.push({
      code: "MISSING_RATE",
      lineCount: missingRateLineCount,
    });
  }

  if (currencyTotals.length > 1) {
    warnings.push({
      code: "MIXED_CURRENCY",
      currencyCodes: currencyTotals.map((total) => total.currencyCode),
    });
  }

  return warnings;
}

async function loadReportFilterLabels(
  db: ReportDb,
  filters: NormalizedReportFilters,
): Promise<ReportFilterLabels> {
  const [project, projectGroup, member] = await Promise.all([
    filters.projectId
      ? db.project.findUnique({
          where: { id: filters.projectId },
          select: { name: true },
        })
      : Promise.resolve(null),
    filters.projectGroupId
      ? db.projectGroup.findUnique({
          where: { id: filters.projectGroupId },
          select: { name: true },
        })
      : Promise.resolve(null),
    filters.memberId
      ? db.member.findUnique({
          where: { id: filters.memberId },
          select: {
            email: true,
            firstName: true,
            lastName: true,
            displayName: true,
          },
        })
      : Promise.resolve(null),
  ]);

  return {
    projectName: project?.name ?? null,
    projectGroupName: projectGroup?.name ?? null,
    memberName: member ? getMemberName(member) : null,
  };
}

function buildReportTimeEntrySelect(where: ReturnType<typeof buildRatePeriodOverlapWhere>) {
  return {
    id: true,
    localDate: true,
    durationMinutes: true,
    description: true,
    source: true,
    timezone: true,
    createdAt: true,
    member: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        currentProfile: true,
        timezone: true,
        defaultRatePeriods: {
          where,
          orderBy: [{ validFrom: "asc" }],
          select: reportRatePeriodSelect,
        },
      },
    },
    project: {
      select: {
        id: true,
        name: true,
        colorToken: true,
        isInternal: true,
      },
    },
    projectAssignment: {
      select: {
        overrideRates: {
          where,
          orderBy: [{ validFrom: "asc" }],
          select: reportRatePeriodSelect,
        },
      },
    },
  } as const;
}

const reportRatePeriodSelect = {
  id: true,
  validFrom: true,
  validTo: true,
  hourlyRate: true,
  currencyCode: true,
} as const;

function buildRatePeriodOverlapWhere(periodStart: Date, periodEnd: Date) {
  return {
    validFrom: {
      lte: periodEnd,
    },
    OR: [{ validTo: null }, { validTo: { gt: periodStart } }],
  };
}

function findEffectiveRate(rates: ReportRatePeriodRecord[], localDate: Date) {
  return (
    rates
      .filter((rate) => rate.validFrom <= localDate && (!rate.validTo || rate.validTo > localDate))
      .sort((left, right) => right.validFrom.getTime() - left.validFrom.getTime())[0] ?? null
  );
}

function resolveProjectColor(colorToken: string) {
  return projectColorValues[isProjectColorToken(colorToken) ? colorToken : "teal"];
}

function getMemberName(
  member: Pick<MemberLabelRecord, "displayName" | "firstName" | "lastName" | "email">,
) {
  return (
    member.displayName.trim() ||
    [member.firstName.trim(), member.lastName.trim()].filter(Boolean).join(" ") ||
    member.email
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function calculateLineAmountCents(durationMinutes: number, hourlyRate: string) {
  const rateCents = moneyToCents(hourlyRate);
  return Math.round((rateCents * durationMinutes) / 60);
}

function moneyToCents(value: DecimalLike | string | number) {
  return Math.round(Number(value.toString()) * 100);
}

function centsToMoney(cents: number) {
  return (cents / 100).toFixed(2);
}
