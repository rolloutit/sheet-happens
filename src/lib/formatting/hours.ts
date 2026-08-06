/**
 * Duration formatting. `src/lib/duration.ts` covers the inverse direction (parsing).
 *
 * Two variants exist because the app renders hours two different ways and both are
 * load-bearing: timesheet tables put the unit in a column header, while the report
 * PDF and the reports page carry the unit inline.
 */

/** `3` / `2.5` — bare number, always up to 2 decimals. Used where a column header carries the unit. */
export function formatHours(minutes: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(minutes / 60);
}

/** `3 h` / `2.5 h` — whole hours render without decimals. */
export function formatHoursWithUnit(minutes: number, locale: string) {
  const hours = minutes / 60;
  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: hours % 1 === 0 ? 0 : 2,
  });

  return `${formatter.format(hours)} h`;
}
