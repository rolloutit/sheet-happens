export type HeatDayState = "past" | "today" | "future";

/** One cell of the month. Days outside the month still occupy a slot so the rows stay 7 wide. */
export type HeatDay = {
  isoDate: string;
  dayNumber: string;
  inMonth: boolean;
  /** Monday to Friday. Weekends are never counted as forgotten. */
  workday: boolean;
  state: HeatDayState;
  minutes: number;
  entryCount: number;
};

export type HeatWeek = {
  /** The Monday, `YYYY-MM-DD`. */
  weekStart: string;
  /** ISO week number. */
  weekNumber: number;
  totalMinutes: number;
  days: HeatDay[];
};

export type MonthHeatNavigatorLabels = {
  /** The grid's accessible name — `Days of September 2026`. */
  grid: string;
  /** A row header's name — `Open week 36`. */
  openWeek: (week: HeatWeek) => string;
  /** A row header's visible text — `W36`. */
  weekRow: (week: HeatWeek) => string;
  /** A logged cell — `Tuesday, September 1, 6.5 hours`. */
  cell: (day: HeatDay) => string;
  /** `Tuesday, September 1, nothing logged`. */
  empty: (day: HeatDay) => string;
  /** `Tuesday, September 1, in the future`. */
  future: (day: HeatDay) => string;
  /** A day of the neighbouring month that pads the row — `Monday, August 31, outside this month`. */
  outside: (day: HeatDay) => string;
  /** The hover detail — `6.5 h · 2 entries`. */
  detail: (day: HeatDay) => string;
  /** Shown once when the month is locked. */
  locked: string;
  /** The three legend entries. */
  legendLogged: string;
  legendEmpty: string;
  legendFuture: string;
};

export type MonthHeatNavigatorProps = {
  weeks: HeatWeek[];
  /** Short weekday labels, Monday first, in the member's locale. */
  weekdayLabels: string[];
  /** The week the member returns to when zooming back in; its row is tinted. */
  selectedWeekStart: string;
  selectedDayIso?: string;
  /** The daily target the intensity ramp is measured against. */
  capacityMinutes: number;
  locked?: boolean;
  formatMinutes: (minutes: number) => string;
  labels: MonthHeatNavigatorLabels;
  /**
   * Whether the rows draw in one after another. On only for a scope *change* into the month —
   * never on first paint — and skipped under reduced motion.
   */
  animate?: boolean;
  disabled?: boolean;
  className?: string;
  onSelectDay: (isoDate: string) => void;
  onSelectWeek: (weekStart: string) => void;
};
