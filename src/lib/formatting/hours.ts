/**
 * Duration formatting. `src/lib/duration.ts` covers the inverse direction (parsing).
 *
 * Three variants exist because the app renders hours three different ways and all three are
 * load-bearing: timesheet tables put the unit in a column header, the report PDF and the
 * reports page carry the unit inline, and money-facing surfaces pin decimal so an hours figure
 * stays checkable against the amount printed beside it — see `formatDecimalHours`.
 *
 * Every variant caps at 2 fraction digits. Durations are stored as whole minutes
 * (`prisma/time-tracking.prisma`), so a 4th decimal digit represented sub-second precision the
 * app never had; every major time tracker (Toggl, Clockify, Harvest, Tempo) caps at 2 as well.
 */

export const durationDisplayFormats = ["DECIMAL_HOURS", "HOURS_MINUTES"] as const;

export type DurationDisplayFormat = (typeof durationDisplayFormats)[number];

export function isDurationDisplayFormat(value: unknown): value is DurationDisplayFormat {
  return durationDisplayFormats.includes(value as DurationDisplayFormat);
}

/** `3` / `2.5`, or `3:23` when the explicit hour-minute preference is selected. */
export function formatHours(
  minutes: number,
  locale: string,
  format: DurationDisplayFormat = "DECIMAL_HOURS",
) {
  if (format === "HOURS_MINUTES") return formatHoursAndMinutes(minutes);

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(minutes / 60);
}

/** `3 h` / `2.5 h`, or `3:23` — whole hours render without decimals. */
export function formatHoursWithUnit(
  minutes: number,
  locale: string,
  format: DurationDisplayFormat = "DECIMAL_HOURS",
) {
  if (format === "HOURS_MINUTES") return formatHoursAndMinutes(minutes);

  const hours = minutes / 60;
  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: hours % 1 === 0 ? 0 : 2,
  });

  return `${formatter.format(hours)} h`;
}

/**
 * `9.50 h` — always decimal at a pinned 2 fraction digits, ignoring the member's display
 * preference. Deliberately takes no `format` parameter: money-facing surfaces (invoices,
 * timesheet review, internal report exports) need hours to stay checkable against the amount
 * printed beside them, the way Harvest and Clockify both pin decimal on money screens. The
 * fixed 2 digits are also what makes `theme.typ`'s tabular figures actually align decimal
 * points down a PDF table's hours column.
 */
export function formatDecimalHours(minutes: number, locale: string) {
  const hours = minutes / 60;
  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${formatter.format(hours)} h`;
}

/**
 * `3:23` / `3:00` / `0:23` — locale-neutral on purpose. `parseDurationToMinutes` already
 * accepts colon-separated durations, so this is the same string a grid cell shows and a grid
 * cell accepts back as input.
 */
function formatHoursAndMinutes(minutes: number) {
  const normalizedMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(normalizedMinutes / 60);
  const remainingMinutes = normalizedMinutes % 60;

  return `${hours}:${String(remainingMinutes).padStart(2, "0")}`;
}
