import { isProjectColorToken, projectColorValues } from "@/src/lib/project-colors";
import { prisma } from "@/src/server/db/client";
import { formatDateOnly, normalizeDateOnly } from "@/src/server/time-tracking";

export type ReportMode = "COST_FREE" | "INTERNAL";
export type ReportView = "USER" | "PROJECT";
export type ReportMemberProfile = "EMPLOYEE" | "CONTRACTOR";
/** Every source a report can contain: `buildReportTimeEntryWhere` excludes only `DECLARED`. */
export type ReportTimeEntrySource = "GRID" | "FORM" | "TIMER" | "MCP";
export type ReportRateSource = "MEMBER_DEFAULT" | "PROJECT_OVERRIDE";

export type ReportFiltersInput = {
  periodStart: Date;
  periodEnd: Date;
  mode?: ReportMode;
  view?: ReportView;
  projectIds?: readonly string[];
  projectGroupIds?: readonly string[];
  memberIds?: readonly string[];
};

export type NormalizedReportFilters = {
  periodStart: Date;
  periodEnd: Date;
  mode: ReportMode;
  view: ReportView;
  /** Empty means every project, the same way no filter at all does. */
  projectIds: string[];
  projectGroupIds: string[];
  memberIds: string[];
};

export type ReportFilterLabels = {
  /** In the order the ids were given, so a name lines up with the id beside it. */
  projectNames: string[];
  projectGroupNames: string[];
  memberNames: string[];
};

/**
 * Readonly because a snapshot is a finished record: it gets serialized to JSON for the Typst
 * template and read back for the PDF payload, never edited in place.
 */
export type ReportSnapshotFilters = {
  projectIds: readonly string[];
  projectNames: readonly string[];
  projectGroupIds: readonly string[];
  projectGroupNames: readonly string[];
  memberIds: readonly string[];
  memberNames: readonly string[];
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

/**
 * What the report left out, stated as counts and never as amounts.
 *
 * §4 is explicit that excluding declared hours is the decision and hiding the exclusion is not part
 * of it: a project with both tracked and declared members now reports *part* of its hours, and an
 * admin reading "Atlas Platform — 94 h in September" has no way to know the number is incomplete.
 * Counts rather than amounts so the line survives being read outside the company.
 */
export type ReportExclusions = {
  declaredHours: {
    memberCount: number;
    projectCount: number;
  };
};

export type ReportSnapshotBase = {
  schemaVersion: 1;
  generatedAt: string;
  mode: ReportMode;
  view: ReportView;
  period: ReportSnapshotPeriod;
  filters: ReportSnapshotFilters;
  exclusions: ReportExclusions;
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
  /** Optional so an existing test stub keeps type-checking; see `countDeclaredExclusions`. */
  monthlyHourDeclaration?: {
    findMany(args: {
      where: Record<string, unknown>;
      select: { memberId: true; projectId: true };
    }): Promise<Array<{ memberId: string; projectId: string }>>;
  };
  /**
   * Two reads per model: the filter's own labels, now looked up by id list because the scope
   * filters take several values, and the full option list the toolbar renders. Declared as
   * overloads so each keeps its exact select and return shape.
   */
  project: {
    findMany(args: {
      where: { id: { in: string[] } };
      select: { id: true; name: true };
    }): Promise<Array<{ id: string; name: string }>>;
    findMany(args: {
      where: { deletedAt: null };
      orderBy: Array<Record<string, "asc" | "desc">>;
      select: { id: true; name: true; status: true };
    }): Promise<Array<{ id: string; name: string; status: string }>>;
  };
  projectGroup: {
    findMany(args: {
      where: { id: { in: string[] } };
      select: { id: true; name: true };
    }): Promise<Array<{ id: string; name: string }>>;
    findMany(args: {
      where: { deletedAt: null };
      orderBy: Array<Record<string, "asc" | "desc">>;
      select: { id: true; name: true; active: true };
    }): Promise<Array<{ id: string; name: string; active: boolean }>>;
  };
  member: {
    findMany(args: {
      where: { id: { in: string[] } };
      select: MemberLabelSelect & { id: true };
    }): Promise<Array<MemberLabelRecord & { id: string }>>;
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
  /** Omitted by a caller that has not counted; the snapshot then discloses nothing. */
  exclusions?: ReportExclusions;
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

  const [entries, filterLabels, exclusions] = await Promise.all([
    db.timeEntry.findMany({
      where,
      orderBy: [{ localDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select,
    }),
    loadReportFilterLabels(db, filters),
    countDeclaredExclusions(db, filters),
  ]);

  return buildReportSnapshot({
    entries,
    filters,
    generatedAt: deps.now?.() ?? new Date(),
    filterLabels,
    exclusions,
  });
}

/**
 * How many members and projects the report left out, for the disclosure line.
 *
 * It needs its own query because the exclusion has already happened by the time the report is
 * assembled: `buildReportTimeEntryWhere` removes those rows, so the omitted set is simply gone from
 * `entries`. Counted from `MonthlyHourDeclaration` rather than from declared *assignments*, because
 * a declared assignment nobody declared against omitted nothing and saying otherwise would overstate
 * what is missing.
 *
 * It runs inside the same `Promise.all` as the report's own read, so it costs a round-trip but no
 * wall-clock — and it has to run unconditionally, since there is no way to know the set is empty
 * without looking. The select is two id columns over an indexed period range.
 *
 * A caller passing a `db` stub without this model gets a disclosure of zero rather than a crash:
 * the counts are additional information about a report, and a report is still a report without
 * them.
 */
async function countDeclaredExclusions(
  db: ReportDb,
  filters: NormalizedReportFilters,
): Promise<ReportExclusions> {
  if (!db.monthlyHourDeclaration) return emptyReportExclusions;

  const where: Record<string, unknown> = {
    // A declaration covers a whole month, so it counts whenever its month overlaps the report
    // period at all — a report over one week of September still omits September's declared hours.
    periodStart: { lte: filters.periodEnd },
    periodEnd: { gte: filters.periodStart },
  };

  if (filters.memberIds.length > 0) where.memberId = { in: filters.memberIds };
  if (filters.projectIds.length > 0) where.projectId = { in: filters.projectIds };
  if (filters.projectGroupIds.length > 0) {
    where.project = {
      groupProjects: {
        some: {
          projectGroupId: { in: filters.projectGroupIds },
        },
      },
    };
  }

  const declarations = await db.monthlyHourDeclaration.findMany({
    where,
    select: { memberId: true, projectId: true },
  });

  return {
    declaredHours: {
      memberCount: new Set(declarations.map((row) => row.memberId)).size,
      projectCount: new Set(declarations.map((row) => row.projectId)).size,
    },
  };
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
    projectIds: [...(input.projectIds ?? [])],
    projectGroupIds: [...(input.projectGroupIds ?? [])],
    memberIds: [...(input.memberIds ?? [])],
  };
}

/**
 * The reporting chain's half of §4's boundary rule: declared hours belong to the timesheet and
 * invoice chain, and not to reports.
 *
 * One `where`, one call site, so every report consumer inherits the exclusion at once — the admin
 * report UI, the Typst export, and the read-only MCP endpoint when it is built, provided it uses
 * this builder rather than a query of its own. Two consequences fall out for free: a declared
 * figure can never be edited through the report line editor, which is correct because it is
 * corrected at L4; and past exports are unaffected, because `ReportExport.renderSnapshot` freezes
 * its own JSON.
 *
 * What this does **not** do is hide the exclusion. See {@link countDeclaredExclusions}.
 */
export function buildReportTimeEntryWhere(filters: NormalizedReportFilters) {
  const where: Record<string, unknown> = {
    deletedAt: null,
    source: {
      not: "DECLARED",
    },
    localDate: {
      gte: filters.periodStart,
      lte: filters.periodEnd,
    },
  };

  if (filters.memberIds.length > 0) {
    where.memberId = { in: filters.memberIds };
  }

  const projectFilter: Record<string, unknown> = {};

  if (filters.projectIds.length > 0) {
    where.projectId = { in: filters.projectIds };
  }

  if (filters.projectGroupIds.length > 0) {
    projectFilter.groupProjects = {
      some: {
        projectGroupId: { in: filters.projectGroupIds },
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
      projectIds: input.filters.projectIds,
      projectNames: input.filterLabels?.projectNames ?? [],
      projectGroupIds: input.filters.projectGroupIds,
      projectGroupNames: input.filterLabels?.projectGroupNames ?? [],
      memberIds: input.filters.memberIds,
      memberNames: input.filterLabels?.memberNames ?? [],
    },
    exclusions: input.exclusions ?? emptyReportExclusions,
  };
}

/** No declared hours were excluded, which is the truth for every report before this feature. */
const emptyReportExclusions: ReportExclusions = {
  declaredHours: {
    memberCount: 0,
    projectCount: 0,
  },
};

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
  const [projects, projectGroups, members] = await Promise.all([
    filters.projectIds.length > 0
      ? db.project.findMany({
          where: { id: { in: filters.projectIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    filters.projectGroupIds.length > 0
      ? db.projectGroup.findMany({
          where: { id: { in: filters.projectGroupIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    filters.memberIds.length > 0
      ? db.member.findMany({
          where: { id: { in: filters.memberIds } },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            displayName: true,
          },
        })
      : Promise.resolve([]),
  ]);

  return {
    projectNames: orderedNames(filters.projectIds, projects, (project) => project.name),
    projectGroupNames: orderedNames(filters.projectGroupIds, projectGroups, (group) => group.name),
    memberNames: orderedNames(filters.memberIds, members, getMemberName),
  };
}

/**
 * Names in the order the filter listed the ids rather than in whatever order the database
 * returned them, so a report header reads the same as the toolbar above it. An id with no
 * row — a project deleted since the link was made — contributes no name rather than a gap.
 */
function orderedNames<Row extends { id: string }>(
  ids: string[],
  rows: Row[],
  toName: (row: Row) => string,
) {
  const byId = new Map(rows.map((row) => [row.id, row]));

  return ids.flatMap((id) => {
    const row = byId.get(id);

    return row ? [toName(row)] : [];
  });
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
