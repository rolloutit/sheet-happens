export type TimeGridDayState = "normal" | "today" | "future";

export type TimeGridDay = {
  isoDate: string;
  label: string;
  shortLabel: string;
  dayNumber: string;
  state: TimeGridDayState;
  locked: boolean;
  /** A full-day leave covers the day; see `leave-guard.ts`. */
  onLeave: boolean;
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

/**
 * The last day of the month `date` falls in, which is the closed upper bound a month-scoped
 * `localDate` query needs. Derived from day 0 of the following month so February, leap years and
 * December all fall out of the same arithmetic.
 */
export function getMonthEnd(date: Date) {
  const start = getMonthStart(date);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
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

export function parseTimeInput(value: string, message = "Choose a valid time.") {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw new TimeTrackingDateError(message, "INVALID_TIME");
  }

  const [hourValue, minuteValue] = value.split(":");
  const hour = Number.parseInt(hourValue ?? "", 10);
  const minute = Number.parseInt(minuteValue ?? "", 10);

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new TimeTrackingDateError(message, "INVALID_TIME");
  }

  return {
    hour,
    minute,
  };
}

export function localDateTimeToUtc(input: {
  localDate: Date;
  localTime: string;
  timezone: string;
}) {
  const date = normalizeDateOnly(input.localDate);
  const dateParts = formatDateOnly(date).split("-").map(Number);
  const [year, month, day] = dateParts;

  if (!year || !month || !day) {
    throw new TimeTrackingDateError("Choose a valid date.");
  }

  const time = parseTimeInput(input.localTime);

  let guess = new Date(Date.UTC(year, month - 1, day, time.hour, time.minute));
  const targetWallTime = Date.UTC(year, month - 1, day, time.hour, time.minute);

  for (let pass = 0; pass < 3; pass += 1) {
    const wall = getZonedDateTimeParts(guess, input.timezone);
    const actualWallTime = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
    const offset = targetWallTime - actualWallTime;

    if (offset === 0) break;
    guess = new Date(guess.getTime() + offset);
  }

  return guess;
}

export function localIntervalToUtc(input: {
  localDate: Date;
  startTime: string;
  endTime: string;
  timezone: string;
}) {
  const startedAt = localDateTimeToUtc({
    localDate: input.localDate,
    localTime: input.startTime,
    timezone: input.timezone,
  });
  const start = parseTimeInput(input.startTime, "Choose a valid start time.");
  const end = parseTimeInput(input.endTime, "Choose a valid end time.");
  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes = end.hour * 60 + end.minute;
  const endLocalDate = endMinutes <= startMinutes ? addDays(input.localDate, 1) : input.localDate;
  const endedAt = localDateTimeToUtc({
    localDate: endLocalDate,
    localTime: input.endTime,
    timezone: input.timezone,
  });
  const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000);

  if (durationMinutes <= 0) {
    throw new TimeTrackingDateError("End time must be after start time.", "END_BEFORE_START");
  }

  return {
    startedAt,
    endedAt,
    durationMinutes,
  };
}

export function formatTimeInTimezone(date: Date, timezone: string) {
  const parts = getZonedDateTimeParts(date, timezone);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function buildWeekDays(input: {
  weekStart: Date;
  todayIso: string;
  lockedMonthStarts: Set<string>;
  leaveDates?: Set<string>;
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
      onLeave: input.leaveDates?.has(isoDate) ?? false,
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

/**
 * Codes for the date/time failures. The message stays the human-readable sentence the web layer
 * localizes; the code is the stable identifier a machine-facing caller (`src/server/mcp`) keys on,
 * so renaming a sentence no longer silently changes a wire contract.
 */
export type TimeTrackingDateErrorCode =
  "INVALID_DATE" | "INVALID_TIME" | "END_BEFORE_START" | "TIMEZONE_FORMAT";

export class TimeTrackingDateError extends Error {
  readonly code: TimeTrackingDateErrorCode;

  constructor(message: string, code: TimeTrackingDateErrorCode = "INVALID_DATE") {
    super(message);
    this.name = "TimeTrackingDateError";
    this.code = code;
  }
}

function getZonedDateTimeParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value)
      throw new TimeTrackingDateError("Could not format date in timezone.", "TIMEZONE_FORMAT");
    return Number.parseInt(value, 10);
  };

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}
