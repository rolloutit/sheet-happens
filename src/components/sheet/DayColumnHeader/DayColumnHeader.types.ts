import type { ReactNode } from "react";

export type DayColumnHeaderDayState = "normal" | "today" | "future";

/** A day as every header of it needs it: the Week column, the Day ribbon chip, the mobile row. */
export type DayColumnHeaderDay = {
  isoDate: string;
  /** The day's own name — `Monday`. */
  label: string;
  /** `Mon`. */
  shortLabel: string;
  /** `31`. */
  dayNumber: string;
  state: DayColumnHeaderDayState;
  locked: boolean;
  /** A full-day leave covers the day, so nothing can be logged on it. */
  onLeave: boolean;
  totalMinutes: number;
};

/**
 * `column` heads a Week column, `chip` is a Day-ribbon stop, `row` is the mobile accordion's
 * collapsed day. Same facts, three densities — the `layoutId` they share is what lets one visibly
 * become another when the scope changes.
 */
export type DayColumnHeaderVariant = "column" | "chip" | "row";

export type DayColumnHeaderLabels = {
  /** `8.5 h of 8 h` — the capacity bar's figures, since the bar itself is decoration. */
  capacity: string;
  /** Shown beside the total when the day is over its target. */
  over?: string;
  locked?: string;
  onLeave?: string;
  today?: string;
};

export type DayColumnHeaderProps = {
  day: DayColumnHeaderDay;
  variant?: DayColumnHeaderVariant;
  /** The daily target the bar fills against. */
  capacityMinutes: number;
  /** The day's total, already formatted. */
  totalLabel: string;
  /** The button's accessible name — `Open Monday, Aug 31` or `Select Monday`. */
  label: string;
  labels: DayColumnHeaderLabels;
  /** Mirrored to `aria-pressed`. For ribbon chips, which are a selection, not a navigation. */
  pressed?: boolean;
  /** Mirrored to `aria-expanded`. For the accordion row, which opens a panel. */
  expanded?: boolean;
  /** Shared identity across scopes — `dayLayoutId(day.isoDate)`. */
  layoutId?: string;
  /** Rendered behind the content; the ribbon's travelling thumb. */
  thumb?: ReactNode;
  disabled?: boolean;
  className?: string;
  onPress?: () => void;
};

export type CapacityBarProps = {
  minutes: number;
  capacityMinutes: number;
  className?: string;
};
