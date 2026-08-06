/**
 * Date and timestamp formatting.
 *
 * Date-only values (`YYYY-MM-DD`) are calendar dates, not instants, so every helper that
 * takes one pins `timeZone: "UTC"`. Without it a UTC-midnight instant renders as the
 * previous day on any host west of UTC.
 *
 * Named `formatDateLabel` rather than `formatDateOnly` on purpose: `formatDateOnly` in
 * `src/server/time-tracking` converts a `Date` into a `YYYY-MM-DD` string, which is the
 * opposite direction.
 */

export type DateLabelStyle = "medium" | "short";

export type FormatDateLabelOptions = {
  /** `medium` renders `Jul 1, 2026`, `short` renders `Jul 1`. */
  style?: DateLabelStyle;
};

export type FormatTimeOptions = {
  /** Pin the rendering zone. Omit to use the host zone. */
  timeZone?: string;
};

function dateOnlyToInstant(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

/** `Jul 1, 2026` (medium) or `Jul 1` (short) from a `YYYY-MM-DD` string. */
export function formatDateLabel(
  isoDate: string,
  locale: string,
  options: FormatDateLabelOptions = {},
) {
  return new Intl.DateTimeFormat(locale, {
    ...(options.style === "short" ? {} : { year: "numeric" }),
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(dateOnlyToInstant(isoDate));
}

/** `Jul 1, 2026 - Jul 31, 2026` from two `YYYY-MM-DD` strings. */
export function formatPeriodRange(
  start: string,
  end: string,
  locale: string,
  options: FormatDateLabelOptions = {},
) {
  return `${formatDateLabel(start, locale, options)} - ${formatDateLabel(end, locale, options)}`;
}

/** `July 2026` from a `YYYY-MM-DD` string. */
export function formatMonthLabel(isoDate: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(dateOnlyToInstant(isoDate));
}

/** `Jul 31, 2026, 02:00 PM` — an instant with an explicit, zero-padded time. */
export function formatDateTime(
  value: Date | string,
  locale: string,
  options: FormatTimeOptions = {},
) {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(options.timeZone ? { timeZone: options.timeZone } : {}),
  }).format(typeof value === "string" ? new Date(value) : value);
}

/** `Jul 31, 2026, 2:00 PM` — an instant via locale date/time styles. `-` when absent. */
export function formatTimestamp(
  value: string | null,
  locale: string,
  options: FormatTimeOptions = {},
) {
  if (!value) return "-";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    ...(options.timeZone ? { timeZone: options.timeZone } : {}),
  }).format(new Date(value));
}
