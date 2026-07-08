export type TimeGridDayState = "normal" | "today" | "future";

export type TimeGridDay = {
  isoDate: string;
  label: string;
  shortLabel: string;
  dayNumber: string;
  state: TimeGridDayState;
  locked: boolean;
};

const dayLabels = [
  { label: "Monday", shortLabel: "Mon" },
  { label: "Tuesday", shortLabel: "Tue" },
  { label: "Wednesday", shortLabel: "Wed" },
  { label: "Thursday", shortLabel: "Thu" },
  { label: "Friday", shortLabel: "Fri" },
  { label: "Saturday", shortLabel: "Sat" },
  { label: "Sunday", shortLabel: "Sun" },
] as const;

export function parseDateOnly(value: string, message = "Choose a valid date.") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TimeTrackingDateError(message);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || formatDateOnly(date) !== value) {
    throw new TimeTrackingDateError(message);
  }

  return date;
}

export function normalizeDateOnly(date: Date, message = "Choose a valid date.") {
  if (Number.isNaN(date.getTime())) {
    throw new TimeTrackingDateError(message);
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number) {
  const next = normalizeDateOnly(date);
  next.setUTCDate(next.getUTCDate() + days);
  return normalizeDateOnly(next);
}

export function getMonday(date: Date) {
  const normalized = normalizeDateOnly(date);
  const weekday = (normalized.getUTCDay() + 6) % 7;
  return addDays(normalized, -weekday);
}

export function getWeekEnd(weekStart: Date) {
  return addDays(weekStart, 6);
}

export function getMonthStart(date: Date) {
  const normalized = normalizeDateOnly(date);
  return new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth(), 1));
}

export function getMonthStartsInRange(start: Date, end: Date) {
  const cursor = getMonthStart(start);
  const last = getMonthStart(end);
  const months: Date[] = [];

  while (cursor <= last) {
    months.push(normalizeDateOnly(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months;
}

export function getTodayIsoInTimezone(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return formatDateOnly(now);
  }

  return `${year}-${month}-${day}`;
}

export function buildWeekDays(input: {
  weekStart: Date;
  todayIso: string;
  lockedMonthStarts: Set<string>;
}) {
  return Array.from({ length: 7 }, (_, dayIndex): TimeGridDay => {
    const date = addDays(input.weekStart, dayIndex);
    const isoDate = formatDateOnly(date);
    const state: TimeGridDayState =
      isoDate === input.todayIso ? "today" : isoDate > input.todayIso ? "future" : "normal";

    return {
      isoDate,
      label: dayLabels[dayIndex].label,
      shortLabel: dayLabels[dayIndex].shortLabel,
      dayNumber: String(date.getUTCDate()),
      state,
      locked: input.lockedMonthStarts.has(formatDateOnly(getMonthStart(date))),
    };
  });
}

export function formatWeekRange(weekStart: Date) {
  const weekEnd = getWeekEnd(weekStart);
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });

  return `${formatter.format(weekStart)} - ${formatter.format(weekEnd)}, ${weekEnd.getUTCFullYear()}`;
}

export class TimeTrackingDateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeTrackingDateError";
  }
}
