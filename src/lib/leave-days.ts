/**
 * Day arithmetic for leave, on `YYYY-MM-DD` date values.
 *
 * Client-safe on purpose: the leave form shows the same workday count the server stores rules
 * against, so both import this one module rather than keeping two counters in step.
 *
 * A workday is Monday to Friday minus the public holidays passed in. Hungarian transferred
 * workdays (a Saturday worked to bridge a holiday) are not modelled.
 */

export type LeaveDayPartValue = "FULL" | "MORNING" | "AFTERNOON";

export type LeaveRange = {
  startDate: string;
  endDate: string;
  dayPart: LeaveDayPartValue;
};

function shiftDateValue(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Every date of an inclusive range; empty when `end` is before `start`. */
export function eachDateValue(start: string, end: string) {
  const days: string[] = [];
  for (let day = start; day <= end; day = shiftDateValue(day, 1)) {
    days.push(day);
  }
  return days;
}

export function isWeekendDateValue(value: string) {
  const weekday = new Date(`${value}T00:00:00.000Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
}

/**
 * How many workdays a leave takes, a half day counting as `0.5`. `skippedHolidays` is the number
 * of holidays that would otherwise have been workdays, which the form reports back to the user.
 */
export function countLeaveWorkdays(input: LeaveRange & { holidayDates?: Iterable<string> }): {
  workdays: number;
  skippedHolidays: number;
} {
  const holidays = new Set(input.holidayDates ?? []);
  let workdays = 0;
  let skippedHolidays = 0;

  for (const day of eachDateValue(input.startDate, input.endDate)) {
    if (isWeekendDateValue(day)) continue;
    if (holidays.has(day)) {
      skippedHolidays += 1;
      continue;
    }
    workdays += 1;
  }

  return {
    workdays: input.dayPart === "FULL" ? workdays : workdays / 2,
    skippedHolidays,
  };
}

/** Whether two leaves claim the same time. A morning and an afternoon of the same day do not. */
export function leaveRangesOverlap(a: LeaveRange, b: LeaveRange) {
  if (a.startDate > b.endDate || b.startDate > a.endDate) return false;

  const halves = new Set([a.dayPart, b.dayPart]);
  return !(halves.size === 2 && !halves.has("FULL"));
}
