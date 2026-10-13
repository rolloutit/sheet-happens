import type { DayColumnHeaderDay } from "../DayColumnHeader";

export type DayRibbonOrientation = "horizontal" | "vertical";

export type DayRibbonLabels = {
  /** The group's accessible name — `Days of this week`. */
  group: string;
  /** A chip's accessible name — `Select Monday`. */
  selectDay: (day: DayColumnHeaderDay) => string;
  /** `8.5 h of 8 h`. */
  capacity: (day: DayColumnHeaderDay) => string;
  /** The over-target label — `over 8 h`. */
  over: string;
  locked: string;
  onLeave: string;
  today: string;
};

export type DayRibbonProps = {
  days: DayColumnHeaderDay[];
  selectedDayIso: string;
  capacityMinutes: number;
  orientation?: DayRibbonOrientation;
  formatMinutes: (minutes: number) => string;
  labels: DayRibbonLabels;
  disabled?: boolean;
  className?: string;
  onSelectDay: (isoDate: string) => void;
};
