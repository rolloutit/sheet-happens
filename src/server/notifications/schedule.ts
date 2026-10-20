import {
  addDays,
  formatDateOnly,
  getMonday,
  parseDateOnly,
} from "@/src/server/time-tracking/dates";

const HOUR_MS = 3_600_000;

export function getWeeklyOccurrence(input: {
  now: Date;
  timezone: string;
  weekday: number;
  time: string;
}) {
  const local = getZonedMinute(input.now, input.timezone);
  const scheduledMinutes = parseClockMinutes(input.time);
  if (local.weekday !== input.weekday || local.minuteOfDay < scheduledMinutes) return null;

  const localDate = parseDateOnly(local.date);
  const weekStart = getMonday(localDate);
  return {
    key: `weekly-hours:${formatDateOnly(localDate)}`,
    weekStart,
    weekEnd: addDays(weekStart, 6),
  };
}

/** The wall time the month-end leave reminder goes out, in the company time zone. */
export const LEAVE_REMINDER_TIME = "09:00";

/**
 * The month-end leave reminder: the second-to-last day of the month in the company time zone,
 * from `time` on. Leaves the last day for anyone who still has to record leave or send a sick
 * note. The key is per month, so every dispatcher tick that day lands on the same notification.
 */
export function getMonthEndLeaveReminderOccurrence(input: {
  now: Date;
  timezone: string;
  time: string;
}) {
  const local = getZonedMinute(input.now, input.timezone);
  if (local.minuteOfDay < parseClockMinutes(input.time)) return null;

  const year = Number.parseInt(local.date.slice(0, 4), 10);
  const month = Number.parseInt(local.date.slice(5, 7), 10);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (Number.parseInt(local.date.slice(8, 10), 10) !== lastDay - 1) return null;

  const monthValue = local.date.slice(0, 7);
  return { key: `leave-month-end:${monthValue}`, month: monthValue };
}

export function getInvoiceReminderOccurrence(input: {
  now: Date;
  approvedAt: Date;
  initialDelayHours: number;
  repeatIntervalHours: number;
}) {
  const elapsedHours = Math.floor((input.now.getTime() - input.approvedAt.getTime()) / HOUR_MS);
  if (elapsedHours < input.initialDelayHours) return null;

  return Math.floor((elapsedHours - input.initialDelayHours) / input.repeatIntervalHours);
}

function getZonedMinute(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(value("weekday")) + 1;

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    weekday,
    minuteOfDay: Number(value("hour")) * 60 + Number(value("minute")),
  };
}

function parseClockMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}
