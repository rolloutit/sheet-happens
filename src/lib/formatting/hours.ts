/**
 * Duration formatting. `src/lib/duration.ts` covers the inverse direction (parsing).
 *
 * Two variants exist because the app renders hours two different ways and both are
 * load-bearing: timesheet tables put the unit in a column header, while the report
 * PDF and the reports page carry the unit inline.
 */

export const durationDisplayFormats = ["DECIMAL_HOURS", "HOURS_MINUTES"] as const;

export type DurationDisplayFormat = (typeof durationDisplayFormats)[number];

export function isDurationDisplayFormat(value: unknown): value is DurationDisplayFormat {
  return durationDisplayFormats.includes(value as DurationDisplayFormat);
}

/** `3` / `2.5`, or `3 h 23 m` when the explicit hour-minute preference is selected. */
export function formatHours(
  minutes: number,
  locale: string,
  format: DurationDisplayFormat = "DECIMAL_HOURS",
) {
  if (format === "HOURS_MINUTES") return formatHoursAndMinutes(minutes, locale);

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 4,
  }).format(minutes / 60);
}

/** `3 h` / `2.5 h` — whole hours render without decimals. */
export function formatHoursWithUnit(
  minutes: number,
  locale: string,
  format: DurationDisplayFormat = "DECIMAL_HOURS",
) {
  if (format === "HOURS_MINUTES") return formatHoursAndMinutes(minutes, locale);

  const hours = minutes / 60;
  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: hours % 1 === 0 ? 0 : 4,
  });

  return `${formatter.format(hours)} h`;
}

function formatHoursAndMinutes(minutes: number, locale: string) {
  const normalizedMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(normalizedMinutes / 60);
  const remainingMinutes = normalizedMinutes % 60;
  const hourUnit = locale.toLowerCase().startsWith("hu") ? "ó" : "h";
  const minuteUnit = locale.toLowerCase().startsWith("hu") ? "p" : "m";
  const number = new Intl.NumberFormat(locale);

  if (hours === 0 && remainingMinutes === 0) return `0 ${hourUnit}`;
  if (hours === 0) return `${number.format(remainingMinutes)} ${minuteUnit}`;
  if (remainingMinutes === 0) return `${number.format(hours)} ${hourUnit}`;
  return `${number.format(hours)} ${hourUnit} ${number.format(remainingMinutes)} ${minuteUnit}`;
}
