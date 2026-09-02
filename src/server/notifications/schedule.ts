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
