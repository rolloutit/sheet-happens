import { isoWeekNumber } from "@/src/lib/date-values";

import type {
  LeaveAgendaDay,
  LeaveCalendarHoliday,
  LeaveCalendarLeave,
  LeaveCalendarWeek,
  LeaveSegment,
} from "./LeaveCalendar.types";

function shift(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function mondayOf(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  return shift(isoDate, -((date.getUTCDay() + 6) % 7));
}

/** Ribbon lanes drawn per week before the rest goes behind a day's "+N more". */
export const MAX_VISIBLE_LANES = 4;

/** From this many people away the day's headcount is drawn as a warning. */
export const BUSY_DAY_THRESHOLD = 4;

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Which half-day slots of a week a segment occupies: two per day, morning then afternoon. */
function slotsOf(segment: Pick<LeaveSegment, "startColumn" | "span" | "leave">) {
  const first = segment.startColumn * 2 + (segment.leave.dayPart === "AFTERNOON" ? 1 : 0);
  const last =
    (segment.startColumn + segment.span - 1) * 2 + (segment.leave.dayPart === "MORNING" ? 0 : 1);
  return { first, last };
}

/**
 * Own leave first so it always sits on the top lane, then whatever starts earliest, then the
 * longer run, so a long leave is not pushed below the short ones it overlaps.
 */
function compareSegments(
  a: Omit<LeaveSegment, "lane" | "hidden">,
  b: Omit<LeaveSegment, "lane" | "hidden">,
) {
  if (a.leave.isOwn !== b.leave.isOwn) return a.leave.isOwn ? -1 : 1;
  if (a.startColumn !== b.startColumn) return a.startColumn - b.startColumn;
  if (a.span !== b.span) return b.span - a.span;
  return (
    a.leave.memberName.localeCompare(b.leave.memberName) || a.leave.id.localeCompare(b.leave.id)
  );
}

/**
 * The month as Monday-first rows of seven, each carrying the leave ribbons that cross it.
 *
 * Pure, so the lane packing can be tested against fixed dates. Days outside the month keep their
 * slot (`inMonth: false`) so the rows line up under the weekday header, and leave running into
 * those days is still drawn: a Friday-to-Tuesday leave reads as one continuous run.
 *
 * Lanes are packed per week in half-day slots, so a morning and an afternoon of the same day can
 * share a lane and a week with no overlap stays one lane tall. A week needing more than
 * `maxLanes` draws the first `maxLanes` and adds one row for each day's "+N more", so the row never
 * grows past a fixed height however many people are away; nothing is dropped, only listed.
 */
export function buildLeaveWeeks(input: {
  monthStart: string;
  todayIso: string;
  leaves: readonly LeaveCalendarLeave[];
  holidays: readonly LeaveCalendarHoliday[];
  maxLanes?: number;
}): LeaveCalendarWeek[] {
  const maxLanes = input.maxLanes ?? MAX_VISIBLE_LANES;
  const monthPrefix = input.monthStart.slice(0, 7);
  const year = Number.parseInt(input.monthStart.slice(0, 4), 10);
  const month = Number.parseInt(input.monthStart.slice(5, 7), 10);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthEnd = `${monthPrefix}-${String(lastDay).padStart(2, "0")}`;
  const holidays = new Map(input.holidays.map((holiday) => [holiday.date, holiday.name]));
  const weeks: LeaveCalendarWeek[] = [];

  for (
    let weekStart = mondayOf(`${monthPrefix}-01`);
    weekStart <= monthEnd;
    weekStart = shift(weekStart, 7)
  ) {
    const weekEnd = shift(weekStart, 6);
    const dates = Array.from({ length: 7 }, (_, index) => shift(weekStart, index));

    const unplaced = input.leaves
      .filter((leave) => leave.startDate <= weekEnd && leave.endDate >= weekStart)
      .map((leave) => {
        const from = leave.startDate < weekStart ? weekStart : leave.startDate;
        const to = leave.endDate > weekEnd ? weekEnd : leave.endDate;
        return {
          leave,
          startColumn: daysBetween(weekStart, from),
          span: daysBetween(from, to) + 1,
          continuesBefore: leave.startDate < weekStart,
          continuesAfter: leave.endDate > weekEnd,
        };
      })
      .sort(compareSegments);

    const lanes: boolean[][] = [];
    const placed = unplaced.map((segment) => {
      const { first, last } = slotsOf(segment);
      let lane = lanes.findIndex((slots) => slots.slice(first, last + 1).every((taken) => !taken));
      if (lane === -1) {
        lane = lanes.length;
        lanes.push(Array.from({ length: 14 }, () => false));
      }
      for (let slot = first; slot <= last; slot += 1) lanes[lane]![slot] = true;
      return { ...segment, lane };
    });

    const visibleLaneCount = Math.min(lanes.length, maxLanes);
    const segments: LeaveSegment[] = placed.map((segment) => ({
      ...segment,
      hidden: segment.lane >= visibleLaneCount,
    }));

    const isWorkday = (index: number) => index < 5 && !holidays.has(dates[index]!);
    const coversWorkday = (segment: LeaveSegment) =>
      Array.from({ length: segment.span }, (_, offset) => segment.startColumn + offset).some(
        isWorkday,
      );

    const days = dates.map((isoDate, index) => {
      const weekend = index >= 5;
      const holiday = holidays.get(isoDate) ?? null;
      const covering = segments
        .filter(
          (segment) => index >= segment.startColumn && index < segment.startColumn + segment.span,
        )
        .sort((a, b) => a.lane - b.lane);
      return {
        isoDate,
        dayNumber: Number.parseInt(isoDate.slice(8), 10),
        inMonth: isoDate.startsWith(monthPrefix),
        weekend,
        today: isoDate === input.todayIso,
        holiday,
        awayCount:
          weekend || holiday ? 0 : new Set(covering.map((segment) => segment.leave.memberId)).size,
        leaves: covering.map((segment) => segment.leave),
        // Nobody works on a weekend or a holiday, so a hidden leave running through one is not
        // worth a "+N more" there; its workdays carry the button. A leave that touches this week
        // only on such days has no workday to carry it, so its first day here does.
        hidden: covering
          .filter(
            (segment) =>
              segment.hidden &&
              (isWorkday(index) || (segment.startColumn === index && !coversWorkday(segment))),
          )
          .map((segment) => segment.leave),
      };
    });

    weeks.push({
      weekStart,
      weekNumber: isoWeekNumber(weekStart),
      days,
      segments,
      laneCount: lanes.length,
      visibleLaneCount,
    });
  }

  return weeks;
}

/**
 * The same month as a list of the days that hold something, for screens too narrow for a grid.
 * Weekends are left out unless a holiday falls on them; a leave lists on every workday it covers.
 */
export function buildLeaveAgenda(weeks: readonly LeaveCalendarWeek[]): LeaveAgendaDay[] {
  return weeks.flatMap((week) =>
    week.days.flatMap((day) => {
      if (!day.inMonth) return [];
      const leaves = day.weekend ? [] : day.leaves;
      return leaves.length > 0 || day.holiday ? [{ day, leaves }] : [];
    }),
  );
}
