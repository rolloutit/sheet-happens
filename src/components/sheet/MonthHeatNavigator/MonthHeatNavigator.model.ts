import { isoWeekNumber } from "@/src/lib/date-values";

import type { HeatDay, HeatWeek } from "./MonthHeatNavigator.types";

export type HeatDayTotal = {
  isoDate: string;
  minutes: number;
  entryCount: number;
};

function shift(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function mondayOf(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  return shift(isoDate, -((date.getUTCDay() + 6) % 7));
}

/**
 * The month as rows of seven, Monday-first, from the per-day totals the page ships.
 *
 * Pure so it can be tested against fixed dates. Days before the 1st and after the last day of the
 * month still occupy their slot — `inMonth: false` — so the rows line up under the weekday headers
 * and a week that spans two months is one row in both.
 *
 * `today` decides `past` versus `future`, and with it what an empty cell means: a past workday with
 * nothing logged is the forgotten day the navigator exists to surface; a future one is simply not
 * here yet.
 */
export function buildHeatWeeks(input: {
  monthStart: string;
  todayIso: string;
  totals: readonly HeatDayTotal[];
}): HeatWeek[] {
  const totalsByDay = new Map(input.totals.map((total) => [total.isoDate, total]));
  const monthPrefix = input.monthStart.slice(0, 7);
  const year = Number.parseInt(input.monthStart.slice(0, 4), 10);
  const month = Number.parseInt(input.monthStart.slice(5, 7), 10);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthEnd = `${monthPrefix}-${String(lastDay).padStart(2, "0")}`;
  const weeks: HeatWeek[] = [];

  for (
    let weekStart = mondayOf(input.monthStart);
    weekStart <= monthEnd;
    weekStart = shift(weekStart, 7)
  ) {
    const days: HeatDay[] = Array.from({ length: 7 }, (_, index) => {
      const isoDate = shift(weekStart, index);
      const total = totalsByDay.get(isoDate);

      return {
        isoDate,
        dayNumber: String(Number.parseInt(isoDate.slice(8), 10)),
        inMonth: isoDate.startsWith(monthPrefix),
        workday: index < 5,
        state: isoDate === input.todayIso ? "today" : isoDate > input.todayIso ? "future" : "past",
        minutes: total?.minutes ?? 0,
        entryCount: total?.entryCount ?? 0,
      };
    });

    weeks.push({
      weekStart,
      weekNumber: isoWeekNumber(weekStart),
      totalMinutes: days.reduce((sum, day) => sum + (day.inMonth ? day.minutes : 0), 0),
      days,
    });
  }

  return weeks;
}

/**
 * `14 of 22 workdays`: how many of the month's Monday-to-Friday days up to today hold anything,
 * against how many the whole month has. The future is not counted as forgotten.
 */
export function countWorkdays(weeks: readonly HeatWeek[]) {
  let workdays = 0;
  let logged = 0;

  for (const week of weeks) {
    for (const day of week.days) {
      if (!day.inMonth || !day.workday) continue;
      workdays += 1;
      if (day.minutes > 0) logged += 1;
    }
  }

  return { workdays, logged };
}

/** Which of the four intensity steps a day sits on; `0` for nothing logged. */
export function heatStep(minutes: number, capacityMinutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0) return 0;

  const ratio = minutes / capacityMinutes;

  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}
