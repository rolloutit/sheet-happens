import { defaultLocale, resolveLocale } from "@/src/i18n/locales";
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
  projectId: string | null;
  projectGroupId: string | null;
  memberId: string | null;
  timezone: string;
};

export function parseReportSearchParams(
  searchParams: ReportSearchParams,
  timezone: string,
): ParsedReportSearchParams {
  const today = parseDateOnly(getTodayIsoInTimezone(timezone));
  const period = parsePeriodMode(getSingleParam(searchParams.period));
  const rawAnchor = getSingleParam(searchParams.anchor);
  const fallbackAnchor = parseAnchorDate(rawAnchor, "month", today);

  if (period === "custom") {
    const fallbackStart = getMonthStart(fallbackAnchor);
    const fallbackEnd = getMonthEnd(fallbackStart);
    const rawStart = parseDateParam(getSingleParam(searchParams.start), fallbackStart);
    const rawEnd = parseDateParam(getSingleParam(searchParams.end), fallbackEnd);
    const [periodStart, periodEnd] =
      rawStart.getTime() <= rawEnd.getTime() ? [rawStart, rawEnd] : [rawEnd, rawStart];

    return {
      period,
      anchor: formatDateOnly(periodStart),
      periodStart,
      periodEnd,
      view: parseReportView(getSingleParam(searchParams.view)),
      projectId: getSingleParam(searchParams.project) || null,
      projectGroupId: getSingleParam(searchParams.group) || null,
      memberId: getSingleParam(searchParams.member) || null,
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
    view: parseReportView(getSingleParam(searchParams.view)),
    projectId: getSingleParam(searchParams.project) || null,
    projectGroupId: getSingleParam(searchParams.group) || null,
    memberId: getSingleParam(searchParams.member) || null,
    timezone,
  };
}

export function reportSearchParamsFromFormData(formData: FormData): ReportSearchParams {
  return {
    start: formString(formData, "start"),
    end: formString(formData, "end"),
    period: formString(formData, "period"),
    anchor: formString(formData, "anchor"),
    project: formString(formData, "project"),
    group: formString(formData, "group"),
    member: formString(formData, "member"),
    view: formString(formData, "view"),
  };
}

/**
 * The serializable form of a filter set, shared by the export download (posted as hidden form
 * fields) and the export preview (sent as a query string), so a preview can never describe a
 * different slice of time than the file the same dialog downloads.
 *
 * Filters only: the export options chosen in the dialog itself — language, mode and title — are
 * fields the dialog owns, so they must not be duplicated here.
 */
export type ReportExportFields = Record<string, string>;

export function reportExportFieldsFromFilters(
  filters: ParsedReportSearchParams,
): ReportExportFields {
  const fields: ReportExportFields = {
    period: filters.period,
    view: filters.view,
  };

  if (filters.period === "custom") {
    fields.start = formatDateOnly(filters.periodStart);
    fields.end = formatDateOnly(filters.periodEnd);
  } else {
    fields.anchor = filters.anchor;
  }

  if (filters.projectId) fields.project = filters.projectId;
  if (filters.projectGroupId) fields.group = filters.projectGroupId;
  if (filters.memberId) fields.member = filters.memberId;

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

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : undefined;
}
