import type { LeaveDayPartValue } from "@/src/lib/leave-days";

/** `absent` is a colleague's leave with the reason withheld; the server decides, not the calendar. */
export type LeaveCalendarKind = "vacation" | "sick" | "absent";

export type LeaveCalendarLeave = {
  id: string;
  memberId: string;
  memberName: string;
  kind: LeaveCalendarKind;
  dayPart: LeaveDayPartValue;
  startDate: string;
  endDate: string;
  workdays: number;
  isOwn: boolean;
};

export type LeaveCalendarHoliday = {
  date: string;
  name: string;
};

export type LeaveCalendarDay = {
  isoDate: string;
  dayNumber: number;
  inMonth: boolean;
  weekend: boolean;
  today: boolean;
  holiday: string | null;
};

/** One leave's run inside one week row. A leave crossing a Sunday becomes two segments. */
export type LeaveSegment = {
  leave: LeaveCalendarLeave;
  /** 0 for Monday to 6 for Sunday. */
  startColumn: number;
  span: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

export type LeaveCalendarWeek = {
  weekStart: string;
  weekNumber: number;
  days: LeaveCalendarDay[];
  segments: LeaveSegment[];
  laneCount: number;
};

export type LeaveAgendaDay = {
  day: LeaveCalendarDay;
  leaves: LeaveCalendarLeave[];
};

export type LeaveCalendarLabels = {
  /** `October 2026`, names the whole calendar. */
  calendar: string;
  /** `Week 42`. */
  week: (weekNumber: number) => string;
  /** `Kovács Dóra, vacation, Oct 12 – 16, 5 workdays`, the full sentence a leave button reads as. */
  leave: (leave: LeaveCalendarLeave) => string;
  /** The short text on the ribbon itself, `You` or a name. */
  ribbon: (leave: LeaveCalendarLeave) => string;
  /** `Wednesday, October 23, 2026`, for a day's heading in the agenda and its time element. */
  day: (isoDate: string) => string;
  kinds: Record<LeaveCalendarKind, string>;
  holiday: string;
  today: string;
  morning: string;
  afternoon: string;
  /** The agenda's line when the month holds no leave and no holiday. */
  empty: string;
};

export type LeaveCalendarProps = {
  /** `YYYY-MM-01`. */
  monthStart: string;
  todayIso: string;
  leaves: readonly LeaveCalendarLeave[];
  holidays: readonly LeaveCalendarHoliday[];
  locale: string;
  labels: LeaveCalendarLabels;
  onSelectLeave?: (leave: LeaveCalendarLeave) => void;
  className?: string;
};
