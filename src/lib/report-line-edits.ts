import type {
  ReportCostFreeGroup,
  ReportCostFreeLine,
  ReportCostFreeSnapshot,
  ReportCurrencyTotal,
  ReportGroupBase,
  ReportInternalGroup,
  ReportInternalLine,
  ReportInternalSnapshot,
  ReportLineBase,
  ReportSnapshot,
  ReportSummaryBase,
  ReportView,
  ReportWarning,
} from "@/src/server/reports";

export type ReportLineEdit = {
  id: string;
  description?: string;
  durationMinutes?: number;
};

const MAX_EDIT_COUNT = 1_000;
const MAX_SERIALIZED_LENGTH = 250_000;
const MAX_DESCRIPTION_LENGTH = 1_000;
const MAX_DURATION_MINUTES = 24 * 60;

export function serializeReportLineEdits(edits: ReportLineEdit[]) {
  return edits.length === 0 ? "" : JSON.stringify(edits);
}

export function parseReportLineEdits(value: unknown): ReportLineEdit[] {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_SERIALIZED_LENGTH) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed) || parsed.length > MAX_EDIT_COUNT) return [];

  const edits = new Map<string, ReportLineEdit>();

  for (const candidate of parsed) {
    if (!candidate || typeof candidate !== "object") continue;

    const record = candidate as Record<string, unknown>;
    if (typeof record.id !== "string" || record.id.length === 0 || record.id.length > 100) continue;

    const edit: ReportLineEdit = { id: record.id };

    if (
      typeof record.description === "string" &&
      record.description.length <= MAX_DESCRIPTION_LENGTH
    ) {
      edit.description = record.description;
    }

    if (
      typeof record.durationMinutes === "number" &&
      Number.isInteger(record.durationMinutes) &&
      record.durationMinutes >= 0 &&
      record.durationMinutes <= MAX_DURATION_MINUTES
    ) {
      edit.durationMinutes = record.durationMinutes;
    }

    if (edit.description !== undefined || edit.durationMinutes !== undefined) {
      edits.set(edit.id, edit);
    }
  }

  return [...edits.values()];
}

export function applyReportLineEdits(
  snapshot: ReportSnapshot,
  edits: ReportLineEdit[],
): ReportSnapshot {
  if (edits.length === 0) return snapshot;

  const editsById = new Map(edits.map((edit) => [edit.id, edit]));

  if (snapshot.mode === "INTERNAL") {
    return applyInternalEdits(snapshot, editsById);
  }

  return applyCostFreeEdits(snapshot, editsById);
}

function applyCostFreeEdits(
  snapshot: ReportCostFreeSnapshot,
  editsById: Map<string, ReportLineEdit>,
): ReportCostFreeSnapshot {
  const lines = snapshot.lines.map((line) => applyBaseEdit(line, editsById.get(line.id)));
  const summary = buildBaseSummary(lines);

  return {
    ...snapshot,
    summary,
    groups: buildCostFreeGroups(lines, snapshot.view, summary.totalMinutes),
    lines,
  };
}

function applyInternalEdits(
  snapshot: ReportInternalSnapshot,
  editsById: Map<string, ReportLineEdit>,
): ReportInternalSnapshot {
  const lines = snapshot.lines.map((line) => {
    const edited = applyBaseEdit(line, editsById.get(line.id));

    return {
      ...edited,
      amount: edited.rate
        ? calculateLineAmount(edited.durationMinutes, edited.rate.hourlyRate)
        : null,
    } satisfies ReportInternalLine;
  });
  const baseSummary = buildBaseSummary(lines);
  const currencyTotals = buildCurrencyTotals(lines);
  const missingRateLineCount = lines.filter((line) => !line.rate).length;
  const summary = {
    ...baseSummary,
    currencyTotals,
    missingRateLineCount,
    mixedCurrency: currencyTotals.length > 1,
  };

  return {
    ...snapshot,
    summary,
    groups: buildInternalGroups(lines, snapshot.view, summary.totalMinutes),
    lines,
    warnings: buildInternalWarnings(currencyTotals, missingRateLineCount),
  };
}

function applyBaseEdit<TLine extends ReportLineBase>(line: TLine, edit?: ReportLineEdit): TLine {
  if (!edit) return line;

  return {
    ...line,
    description: edit.description ?? line.description,
    durationMinutes: edit.durationMinutes ?? line.durationMinutes,
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
  return buildGroupDrafts(lines, view, totalMinutes).map((group) => group.base);
}

function buildInternalGroups(
  lines: ReportInternalLine[],
  view: ReportView,
  totalMinutes: number,
): ReportInternalGroup[] {
  return buildGroupDrafts(lines, view, totalMinutes).map((group) => {
    const currencyTotals = buildCurrencyTotals(group.lines);

    return {
      ...group.base,
      currencyTotals,
      missingRateLineCount: group.lines.filter((line) => !line.rate).length,
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
    const group: { base: ReportGroupBase; lines: TLine[] } = groups.get(identity.key) ?? {
      base: {
        ...identity,
        totalMinutes: 0,
        entryCount: 0,
        percentageOfTotal: 0,
      },
      lines: [],
    };

    group.base.totalMinutes += line.durationMinutes;
    group.base.entryCount += 1;
    group.lines.push(line);
    groups.set(identity.key, group);
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

  if (missingRateLineCount > 0)
    warnings.push({ code: "MISSING_RATE", lineCount: missingRateLineCount });
  if (currencyTotals.length > 1) {
    warnings.push({
      code: "MIXED_CURRENCY",
      currencyCodes: currencyTotals.map((total) => total.currencyCode),
    });
  }

  return warnings;
}

function calculateLineAmount(durationMinutes: number, hourlyRate: string) {
  const rateCents = Math.round(Number(hourlyRate) * 100);
  return centsToMoney(Math.round((rateCents * durationMinutes) / 60));
}

function moneyToCents(value: string) {
  return Math.round(Number(value) * 100);
}

function centsToMoney(value: number) {
  return (value / 100).toFixed(2);
}
