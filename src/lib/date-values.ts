/**
 * The wire format for calendar dates: `YYYY-MM-DD` for days, `YYYY-MM` for months.
 *
 * Every form, URL search param, and Zod schema in this app speaks these strings, and the
 * domain layer turns them into UTC-midnight `Date`s. This module is the client-safe half
 * of that contract — it is imported by the date pickers, so it must stay free of
 * `server-only`, Prisma, and Node built-ins.
 *
 * Its server twin is `src/server/time-tracking/dates.ts`, which throws
 * `TimeTrackingDateError` on bad input because it guards domain invariants. Here a bad
 * value is a user mid-keystroke, so parsing returns `undefined` instead.
 *
 * Named `date-values`, not `dates`, deliberately: `src/lib/formatting/dates.ts` already
 * documents a naming collision with the server module, and a third `dates.ts` would make
 * it worse. "Date value" names the thing this handles — the wire format.
 */

const dateValuePattern = /^\d{4}-\d{2}-\d{2}$/;
const monthValuePattern = /^\d{4}-\d{2}$/;

/** True for a real calendar date in `YYYY-MM-DD`. Round-trip validated, so `2026-02-30` is false. */
export function isDateValue(value: string) {
  if (!dateValuePattern.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && toDateValue(date) === value;
}

/** True for `YYYY-MM` with a month in `01`-`12`. */
export function isMonthValue(value: string) {
  if (!monthValuePattern.test(value)) return false;

  const month = Number.parseInt(value.slice(5, 7), 10);
  return month >= 1 && month <= 12;
}

/** `YYYY-MM-DD` to a UTC-midnight `Date`. `undefined` when the value is not a real date. */
export function parseDateValue(value: string) {
  if (!isDateValue(value)) return undefined;

  return new Date(`${value}T00:00:00.000Z`);
}

/**
 * A UTC `Date` to `YYYY-MM-DD`.
 *
 * Built from the UTC accessors rather than `toISOString().slice(0, 10)` so the output is
 * always zero-padded even below year 1000. That padding is load-bearing: several Zod
 * schemas compare date values as raw strings (`validTo <= validFrom`), and `2026-3-5`
 * would sort wrong.
 */
export function toDateValue(date: Date) {
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/** A UTC `Date` to `YYYY-MM`. */
export function toMonthValue(date: Date) {
  return toDateValue(date).slice(0, 7);
}

/** `2026-06` to `2026-06-01`, so the month value can reach the date-only formatters. */
export function monthValueToDateValue(month: string) {
  return `${month}-01`;
}

/** `2026-06-24` to `2026-06`. */
export function dateValueToMonthValue(date: string) {
  return date.slice(0, 7);
}

/** Midnight UTC on the same calendar day, discarding any time component. */
export function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Midnight UTC on the first of the month. */
export function startOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function addUtcDays(date: Date, amount: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + amount));
}

/** Adds months, clamping the day so `Jan 31 + 1` lands on the last day of February. */
export function addUtcMonths(date: Date, amount: number) {
  const targetYear = date.getUTCFullYear();
  const targetMonth = date.getUTCMonth() + amount;
  const lastDayOfTarget = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();

  return new Date(Date.UTC(targetYear, targetMonth, Math.min(date.getUTCDate(), lastDayOfTarget)));
}

/** Today as `YYYY-MM-DD` in an IANA zone. Omit the zone to use the host's. */
export function todayDateValue(timeZone?: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).formatToParts(now);

  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${lookup("year")}-${lookup("month")}-${lookup("day")}`;
}

/**
 * Lexicographic comparison, which is chronological for this format because every field is
 * fixed-width and zero-padded. Stated explicitly because the codebase already relies on the
 * property implicitly, in Zod range checks and in `src/server/time-tracking/dates.ts`.
 */
export function compareDateValues(a: string, b: string) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Pulls a date value inside an inclusive `min`/`max` window. Bounds may be omitted. */
export function clampDateValue(value: string, min?: string, max?: string) {
  if (min && compareDateValues(value, min) < 0) return min;
  if (max && compareDateValues(value, max) > 0) return max;
  return value;
}
