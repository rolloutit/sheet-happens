import { defaultLocale, resolveLocale } from "@/src/i18n/locales";
import { firstSearchParam, listSearchParam } from "@/src/lib/search-params";
import {
  addDays,
  formatDateOnly,
  getMonthStart,
  getMonday,
  getTodayIsoInTimezone,
  parseDateOnly,
} from "@/src/server/time-tracking";

import type { ReportView } from "./reports";

export type ReportPeriodMode = "month" | "week" | "day" | "year" | "custom";

export type ReportSearchParams = {
  start?: string | string[];
  end?: string | string[];
  period?: string | string[];
  anchor?: string | string[];
  project?: string | string[];
  group?: string | string[];
  member?: string | string[];
  view?: string | string[];
};

export type ParsedReportSearchParams = {
  period: ReportPeriodMode;
  anchor: string;
  periodStart: Date;
  periodEnd: Date;
  view: ReportView;
  /** Empty means every project, the same way no filter at all does. */
  projectIds: string[];
  projectGroupIds: string[];
  memberIds: string[];
  timezone: string;
};

export function parseReportSearchParams(
  searchParams: ReportSearchParams,
  timezone: string,
): ParsedReportSearchParams {
  const today = parseDateOnly(getTodayIsoInTimezone(timezone));
  const period = parsePeriodMode(firstSearchParam(searchParams.period));
  const rawAnchor = firstSearchParam(searchParams.anchor);
  const scope = {
    projectIds: listSearchParam(searchParams.project),
    projectGroupIds: listSearchParam(searchParams.group),
    memberIds: listSearchParam(searchParams.member),
  };
  const fallbackAnchor = parseAnchorDate(rawAnchor, "month", today);

  if (period === "custom") {
    const fallbackStart = getMonthStart(fallbackAnchor);
    const fallbackEnd = getMonthEnd(fallbackStart);
    const rawStart = parseDateParam(firstSearchParam(searchParams.start), fallbackStart);
    const rawEnd = parseDateParam(firstSearchParam(searchParams.end), fallbackEnd);
    const [periodStart, periodEnd] =
      rawStart.getTime() <= rawEnd.getTime() ? [rawStart, rawEnd] : [rawEnd, rawStart];

    return {
      period,
      anchor: formatDateOnly(periodStart),
      periodStart,
      periodEnd,
      view: parseReportView(firstSearchParam(searchParams.view)),
      ...scope,
      timezone,
    };
  }

  const anchorDate = parseAnchorDate(rawAnchor, period, today);
  const range = getPeriodRange(period, anchorDate);

  return {
    period,
    anchor: range.anchor,
    periodStart: range.periodStart,
    periodEnd: range.periodEnd,
    view: parseReportView(firstSearchParam(searchParams.view)),
    ...scope,
    timezone,
  };
}

export function reportSearchParamsFromFormData(formData: FormData): ReportSearchParams {
  return {
    start: formString(formData, "start"),
    end: formString(formData, "end"),
    period: formString(formData, "period"),
    anchor: formString(formData, "anchor"),
    // The scope filters are multi-selects, so each arrives as one entry per chosen value.
    project: formStrings(formData, "project"),
    group: formStrings(formData, "group"),
    member: formStrings(formData, "member"),
    view: formString(formData, "view"),
  };
}

/**
 * The serializable form of a filter set, shared by the export download (posted as hidden form
 * fields) and the export preview (sent as a query string), so a preview can never describe a
 * different slice of time than the file the same dialog downloads.
 *
 * Name/value pairs rather than an object, because the scope filters take several values each
 * and a repeated name is exactly what both consumers need: `URLSearchParams` accepts pairs
 * directly, and one hidden input per pair is what a form posts back.
 *
 * Filters only: the export options chosen in the dialog itself — language, mode and title — are
 * fields the dialog owns, so they must not be duplicated here.
 */
export type ReportExportFields = [name: string, value: string][];

export function reportExportFieldsFromFilters(
  filters: ParsedReportSearchParams,
): ReportExportFields {
  const fields: ReportExportFields = [
    ["period", filters.period],
    ["view", filters.view],
  ];

  if (filters.period === "custom") {
    fields.push(["start", formatDateOnly(filters.periodStart)]);
    fields.push(["end", formatDateOnly(filters.periodEnd)]);
  } else {
    fields.push(["anchor", filters.anchor]);
  }

  for (const projectId of filters.projectIds) fields.push(["project", projectId]);
  for (const projectGroupId of filters.projectGroupIds) fields.push(["group", projectGroupId]);
  for (const memberId of filters.memberIds) fields.push(["member", memberId]);

  return fields;
}

export function parseReportMode(value: FormDataEntryValue | string | null | undefined) {
  return value === "INTERNAL" ? "INTERNAL" : "COST_FREE";
}

/**
 * The document language is picked in the export dialog rather than taken from the request cookie,
 * so it arrives as untrusted input and gets validated like any other export field.
 */
export function parseReportExportLocale(value: FormDataEntryValue | string | null | undefined) {
  return resolveLocale(value) ?? defaultLocale;
}

export function normalizeReportExportTitle(value: FormDataEntryValue | string | null | undefined) {
  const title = typeof value === "string" ? value.trim().replaceAll(/\s+/g, " ") : "";

  return title.slice(0, 120);
}

/**
 * The download and the preview must agree on the title, including the fallback, or the preview
 * would show a heading the exported file does not carry.
 */
export function resolveReportExportTitle(
  value: FormDataEntryValue | string | null | undefined,
  period: { start: string; end: string },
) {
  return normalizeReportExportTitle(value) || `Time report ${period.start} ${period.end}`;
}

function parsePeriodMode(value: string | undefined): ReportPeriodMode {
  return value === "week" || value === "day" || value === "year" || value === "custom"
    ? value
    : "month";
}

function parseAnchorDate(value: string | undefined, period: ReportPeriodMode, fallback: Date) {
  try {
    if (period === "month") {
      return parseDateOnly(`${value?.slice(0, 7) || formatDateOnly(fallback).slice(0, 7)}-01`);
    }

    if (period === "year") {
      const year = value?.slice(0, 4) || String(fallback.getUTCFullYear());
      return parseDateOnly(`${year}-01-01`);
    }

    return parseDateParam(value, fallback);
  } catch {
    return fallback;
  }
}

function getPeriodRange(period: Exclude<ReportPeriodMode, "custom">, anchorDate: Date) {
  if (period === "week") {
    const periodStart = getMonday(anchorDate);

    return {
      anchor: formatDateOnly(anchorDate),
      periodStart,
      periodEnd: addDays(periodStart, 6),
    };
  }

  if (period === "day") {
    const day = parseDateOnly(formatDateOnly(anchorDate));

    return {
      anchor: formatDateOnly(day),
      periodStart: day,
      periodEnd: day,
    };
  }

  if (period === "year") {
    const periodStart = new Date(Date.UTC(anchorDate.getUTCFullYear(), 0, 1));

    return {
      anchor: formatDateOnly(periodStart),
      periodStart,
      periodEnd: new Date(Date.UTC(anchorDate.getUTCFullYear(), 11, 31)),
    };
  }

  const periodStart = getMonthStart(anchorDate);

  return {
    anchor: formatDateOnly(periodStart),
    periodStart,
    periodEnd: getMonthEnd(periodStart),
  };
}

function getMonthEnd(monthStart: Date) {
  return addDays(
    new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)),
    -1,
  );
}

function parseDateParam(value: string | undefined, fallback: Date) {
  if (!value) return fallback;

  try {
    return parseDateOnly(value);
  } catch {
    return fallback;
  }
}

function parseReportView(value: string | undefined): ReportView {
  return value === "PROJECT" ? "PROJECT" : "USER";
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : undefined;
}

function formStrings(formData: FormData, key: string) {
  return formData.getAll(key).filter((value): value is string => typeof value === "string");
}
