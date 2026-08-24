import type { getTranslations } from "next-intl/server";

import {
  formatCount,
  formatDateLabel,
  formatDateTime,
  formatHoursWithUnit,
  formatMoney,
  formatPeriodRange,
  formatRate,
  type DurationDisplayFormat,
} from "@/src/lib/formatting";

import type {
  ReportCostFreeLine,
  ReportCurrencyTotal,
  ReportInternalLine,
  ReportSnapshot,
  ReportView,
  ReportWarning,
} from "./reports";

/**
 * Builds the JSON payload that `src/server/pdf/templates/report.typ` renders.
 *
 * Everything here is display-ready: `Intl` stays the single authority on locale rules, so the
 * template contains no formatting or localization logic at all. Values are never concatenated
 * into Typst markup — they travel as JSON and are read with `json()`, which is why no escaping
 * layer exists any more. The one exception to "display-ready" is `sharePercent`, which is a
 * geometry input for a bar width and is never printed.
 *
 * Translations come from the `AdminReports` namespace so the PDF reuses the labels the reports
 * screen already ships in both locales.
 *
 * The payload never names the export mode. `mode` only selects which columns the template
 * draws, and the document itself carries no "cost-free"/"internal" wording.
 */

/** A translator scoped to the `AdminReports` namespace. */
export type ReportPdfTranslator = Awaited<ReturnType<typeof getTranslations>>;

/**
 * Typographic marker for a value the report cannot state, used in numeric columns where a
 * sentence would wrap. `pdf.missingRateNote` explains it in a footnote whenever it appears.
 */
const MISSING_VALUE = "—";

/** Project colours reach Typst's `rgb()`, so anything but a plain hex triplet is dropped. */
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export type ReportPdfLabels = {
  brand: string;
  confidential: string;
  page: string;
  generatedAt: string;
  attention: string;
  breakdown: string;
  breakdownDescription: string;
  details: string;
  detailsDescription: string;
  name: string;
  hours: string;
  share: string;
  entries: string;
  amount: string;
  total: string;
  date: string;
  member: string;
  project: string;
  description: string;
  rate: string;
};

export type ReportPdfMetric = {
  label: string;
  value: string;
};

export type ReportPdfFacet = ReportPdfMetric & {
  /** Project colour of the one project this export covers, otherwise `null`. */
  color: string | null;
};

/**
 * Which identifying columns the details table draws.
 *
 * A filter pinned to a single project or member would repeat that one value on every row, so the
 * column is dropped and the header facet carries the value instead. What is left is always the
 * dimension that actually varies — dropping a column must never leave a row unattributed.
 */
export type ReportPdfDetailColumns = {
  member: boolean;
  project: boolean;
};

export type ReportPdfGroup = {
  label: string;
  /** Project colour of the group, or `null` when the group is a member. */
  color: string | null;
  /** Member initials of the group, or `null` when the group is a project. */
  initials: string | null;
  hours: string;
  share: string;
  /** 0–100, drives the share bar width. Never printed. */
  sharePercent: number;
  entries: string;
};

export type ReportPdfInternalPayloadGroup = ReportPdfGroup & {
  amount: string;
};

export type ReportPdfCostFreeLine = {
  date: string;
  member: string;
  memberInitials: string;
  project: string;
  projectColor: string | null;
  description: string;
  hours: string;
};

export type ReportPdfInternalLine = {
  date: string;
  member: string;
  project: string;
  projectColor: string | null;
  description: string;
  hours: string;
  rate: string;
  amount: string;
};

export type ReportPdfTotals = {
  hours: string;
  entries: string;
};

export type ReportPdfInternalTotals = ReportPdfTotals & {
  amount: string;
};

type ReportPdfPayloadBase = {
  schemaVersion: 2;
  view: ReportView;
  title: string;
  labels: ReportPdfLabels;
  header: {
    generatedAt: string;
    /** Scope of the export: view, period and the filters that produced it. */
    facets: ReportPdfFacet[];
  };
  summary: {
    /** Rendered large. One metric, or two once amounts are included. */
    heroes: ReportPdfMetric[];
    metrics: ReportPdfMetric[];
  };
  detailColumns: ReportPdfDetailColumns;
  warnings: string[];
  /** Time zone boundary note, plus the missing-value legend when the marker is used. */
  footnotes: string[];
};

/**
 * Discriminated on `mode` so cost-free exports cannot carry rates or amounts even by accident:
 * the fields are absent from the type and from the emitted JSON, not blanked out.
 */
export type ReportPdfPayload =
  | (ReportPdfPayloadBase & {
      mode: "COST_FREE";
      groups: ReportPdfGroup[];
      lines: ReportPdfCostFreeLine[];
      totals: ReportPdfTotals;
    })
  | (ReportPdfPayloadBase & {
      mode: "INTERNAL";
      groups: ReportPdfInternalPayloadGroup[];
      lines: ReportPdfInternalLine[];
      totals: ReportPdfInternalTotals;
    });

export type BuildReportPdfPayloadInput = {
  title: string;
  snapshot: ReportSnapshot;
  locale: string;
  generatedAt: Date;
  durationDisplayFormat: DurationDisplayFormat;
  t: ReportPdfTranslator;
};

export function normalizeReportPdfTitle(title: string) {
  return title.trim().replaceAll(/\s+/g, " ").slice(0, 120) || "Time report";
}

export function buildReportPdfPayload(input: BuildReportPdfPayloadInput): ReportPdfPayload {
  const { snapshot, locale, t } = input;
  const labels = resolveReportPdfLabels(t);
  const title = normalizeReportPdfTitle(input.title);
  const periodLabel = formatPeriodRange(snapshot.period.start, snapshot.period.end, locale);

  // A single-project or single-member export states that dimension once in the header instead of
  // repeating it down a column and counting it as "1" in the summary band.
  const scope = {
    singleProject: snapshot.filters.projectId !== null,
    singleMember: snapshot.filters.memberId !== null,
  };

  const base = {
    schemaVersion: 2,
    view: snapshot.view,
    title,
    labels,
    header: {
      generatedAt: formatDateTime(input.generatedAt, locale),
      facets: buildHeaderFacets(snapshot, periodLabel, t),
    },
    summary: buildSummary(snapshot, locale, input.durationDisplayFormat, scope, t),
    detailColumns: buildDetailColumns(snapshot, scope),
    warnings: snapshot.warnings.map((warning) => formatWarning(warning, t)),
    footnotes: buildFootnotes(snapshot, t),
  } satisfies ReportPdfPayloadBase;

  if (snapshot.mode === "INTERNAL") {
    return {
      ...base,
      mode: "INTERNAL",
      groups: snapshot.groups.map((group) => ({
        ...buildGroup(group, locale, input.durationDisplayFormat),
        amount: formatCurrencyTotals(group.currencyTotals, locale) || MISSING_VALUE,
      })),
      lines: snapshot.lines.map((line) =>
        buildInternalLine(line, locale, input.durationDisplayFormat, t),
      ),
      totals: {
        ...buildTotals(snapshot, locale, input.durationDisplayFormat),
        amount: formatCurrencyTotals(snapshot.summary.currencyTotals, locale) || MISSING_VALUE,
      },
    };
  }

  return {
    ...base,
    mode: "COST_FREE",
    groups: snapshot.groups.map((group) => buildGroup(group, locale, input.durationDisplayFormat)),
    lines: snapshot.lines.map((line) =>
      buildCostFreeLine(line, locale, input.durationDisplayFormat, t),
    ),
    totals: buildTotals(snapshot, locale, input.durationDisplayFormat),
  };
}

function resolveReportPdfLabels(t: ReportPdfTranslator): ReportPdfLabels {
  return {
    brand: t("pdf.brand"),
    confidential: t("pdf.confidential"),
    page: t("pdf.page"),
    generatedAt: t("pdf.generatedAt"),
    attention: t("pdf.attention"),
    breakdown: t("pdf.breakdown"),
    breakdownDescription: t("pdf.breakdownDescription"),
    details: t("pdf.details"),
    detailsDescription: t("pdf.detailsDescription"),
    name: t("pdf.name"),
    share: t("pdf.share"),
    entries: t("pdf.entries"),
    amount: t("pdf.amount"),
    total: t("pdf.total"),
    rate: t("pdf.rate"),
    // Reused from the reports screen rather than duplicated for the PDF.
    hours: t("table.hours"),
    date: t("table.date"),
    member: t("table.member"),
    project: t("table.project"),
    description: t("table.description"),
  };
}

/**
 * The header states the scope instead of the export mode: which view, which period, and which
 * filters were applied. A filter that was left open is spelled out as "all", so a reader can
 * tell that nothing was narrowed rather than having to assume it.
 */
function buildHeaderFacets(
  snapshot: ReportSnapshot,
  periodLabel: string,
  t: ReportPdfTranslator,
): ReportPdfFacet[] {
  const facets = [
    {
      label: t("filters.view"),
      value: t(snapshot.view === "USER" ? "views.user" : "views.project"),
      color: null,
    },
    { label: t("stats.period"), value: periodLabel, color: null },
    {
      label: t("filters.project"),
      value: snapshot.filters.projectName ?? t("filters.projectAll"),
      // Only the project facet is dotted: colour is how the app identifies a project everywhere
      // else, whereas a member's initials next to their own name would say nothing new.
      color: resolveFilteredProjectColor(snapshot),
    },
  ];

  if (snapshot.filters.projectGroupName) {
    facets.push({
      label: t("filters.group"),
      value: snapshot.filters.projectGroupName,
      color: null,
    });
  }

  facets.push({
    label: t("filters.member"),
    value: snapshot.filters.memberName ?? t("filters.memberAll"),
    color: null,
  });

  return facets;
}

/**
 * The snapshot filters name the project but not its colour, so it comes off a line. Every line
 * belongs to that one project once the filter is set, so any of them will do.
 */
function resolveFilteredProjectColor(snapshot: ReportSnapshot) {
  if (snapshot.filters.projectId === null) return null;

  return sanitizeColor(snapshot.lines[0]?.project.color ?? null);
}

function buildSummary(
  snapshot: ReportSnapshot,
  locale: string,
  durationDisplayFormat: DurationDisplayFormat,
  scope: { singleProject: boolean; singleMember: boolean },
  t: ReportPdfTranslator,
) {
  const heroes = [
    {
      label: t("stats.totalHours"),
      value: formatHoursWithUnit(snapshot.summary.totalMinutes, locale, durationDisplayFormat),
    },
  ];

  if (snapshot.mode === "INTERNAL") {
    heroes.push({
      label: t("pdf.amount"),
      value: formatCurrencyTotals(snapshot.summary.currencyTotals, locale) || t("pdf.missingRate"),
    });
  }

  const metrics = [
    { label: t("pdf.entries"), value: formatCount(snapshot.summary.entryCount, locale) },
  ];

  // A count that can only read "1" is noise next to a header facet that already names the one
  // member or project the export covers.
  if (!scope.singleMember) {
    metrics.push({
      label: t("stats.people"),
      value: formatCount(snapshot.summary.peopleCount, locale),
    });
  }

  if (!scope.singleProject) {
    metrics.push({
      label: t("stats.projects"),
      value: formatCount(snapshot.summary.projectCount, locale),
    });
  }

  return { heroes, metrics };
}

function buildTotals(
  snapshot: ReportSnapshot,
  locale: string,
  durationDisplayFormat: DurationDisplayFormat,
): ReportPdfTotals {
  return {
    hours: formatHoursWithUnit(snapshot.summary.totalMinutes, locale, durationDisplayFormat),
    entries: formatCount(snapshot.summary.entryCount, locale),
  };
}

function buildFootnotes(snapshot: ReportSnapshot, t: ReportPdfTranslator) {
  const footnotes = [
    t("warnings.timezone", {
      timezones: snapshot.period.timezones.join(", ") || t("warnings.noTimezone"),
    }),
  ];

  if (snapshot.mode === "INTERNAL" && snapshot.summary.missingRateLineCount > 0) {
    footnotes.push(t("pdf.missingRateNote", { marker: MISSING_VALUE }));
  }

  return footnotes;
}

function buildGroup(
  group: {
    kind: ReportView;
    label: string;
    totalMinutes: number;
    percentageOfTotal: number;
    entryCount: number;
    color: string | null;
    initials: string | null;
  },
  locale: string,
  durationDisplayFormat: DurationDisplayFormat,
): ReportPdfGroup {
  return {
    label: group.label,
    // A group is either a project (identified by its colour) or a member (by their initials).
    color: group.kind === "PROJECT" ? sanitizeColor(group.color) : null,
    initials: group.kind === "USER" ? group.initials : null,
    hours: formatHoursWithUnit(group.totalMinutes, locale, durationDisplayFormat),
    share: `${Math.round(group.percentageOfTotal)}%`,
    sharePercent: clampPercent(group.percentageOfTotal),
    entries: formatCount(group.entryCount, locale),
  };
}

function buildCostFreeLine(
  line: ReportCostFreeLine,
  locale: string,
  durationDisplayFormat: DurationDisplayFormat,
  t: ReportPdfTranslator,
): ReportPdfCostFreeLine {
  return {
    date: formatDateLabel(line.localDate, locale),
    member: line.member.name,
    memberInitials: line.member.initials,
    project: line.project.name,
    projectColor: sanitizeColor(line.project.color),
    description: line.description || t("table.noDescription"),
    hours: formatHoursWithUnit(line.durationMinutes, locale, durationDisplayFormat),
  };
}

/**
 * An internal export lists both dimensions, so it simply drops whichever one a filter pinned.
 *
 * A cost-free export has room for one identifying column and normally shows the dimension the
 * report is *not* grouped by — a user-view report lists projects, a project-view report lists
 * members. When a filter pins exactly that dimension, the column would repeat one value on every
 * row while the rows themselves became anonymous, so the other dimension takes its place.
 */
function buildDetailColumns(
  snapshot: ReportSnapshot,
  scope: { singleProject: boolean; singleMember: boolean },
): ReportPdfDetailColumns {
  if (snapshot.mode === "INTERNAL") {
    return { member: !scope.singleMember, project: !scope.singleProject };
  }

  if (scope.singleProject && scope.singleMember) {
    // Both dimensions are constant, so neither earns a column.
    return { member: false, project: false };
  }

  if (scope.singleProject) return { member: true, project: false };
  if (scope.singleMember) return { member: false, project: true };

  return snapshot.view === "USER"
    ? { member: false, project: true }
    : { member: true, project: false };
}

function buildInternalLine(
  line: ReportInternalLine,
  locale: string,
  durationDisplayFormat: DurationDisplayFormat,
  t: ReportPdfTranslator,
): ReportPdfInternalLine {
  return {
    date: formatDateLabel(line.localDate, locale),
    member: line.member.name,
    project: line.project.name,
    projectColor: sanitizeColor(line.project.color),
    description: line.description || t("table.noDescription"),
    hours: formatHoursWithUnit(line.durationMinutes, locale, durationDisplayFormat),
    rate: line.rate
      ? formatRate(line.rate.hourlyRate, line.rate.currencyCode, locale)
      : MISSING_VALUE,
    amount:
      line.amount && line.currencyCode
        ? formatMoney(line.amount, line.currencyCode, locale)
        : MISSING_VALUE,
  };
}

function formatWarning(warning: ReportWarning, t: ReportPdfTranslator) {
  if (warning.code === "MISSING_RATE") {
    return t("pdf.warnings.missingRates", { count: warning.lineCount });
  }

  return t("pdf.warnings.mixedCurrency", { currencies: warning.currencyCodes.join(", ") });
}

function formatCurrencyTotals(totals: ReportCurrencyTotal[], locale: string) {
  return totals.map((total) => formatMoney(total.amount, total.currencyCode, locale)).join(", ");
}

function sanitizeColor(color: string | null) {
  return color && HEX_COLOR.test(color) ? color : null;
}

function clampPercent(percentage: number) {
  return Math.min(Math.max(percentage, 0), 100);
}
