import type { ReactNode } from "react";

import type { DurationDisplayFormat } from "@/src/lib/formatting";
import type { DayColumnHeaderDay, DayColumnHeaderDayState } from "../DayColumnHeader";
import type {
  EntryCardEntry,
  EntryCardLabels,
  EntryHighlight,
  RunningEntryCardLabels,
} from "../EntryCard";

export type WeekAgendaDayState = DayColumnHeaderDayState;

export type WeekAgendaEntry = EntryCardEntry;

export type WeekAgendaDay = DayColumnHeaderDay & {
  entries: WeekAgendaEntry[];
  /** Whether the day before holds entries, which is when an empty column offers "Copy yesterday". */
  canCopyPreviousDay?: boolean;
};

/** The running timer, for the live card at the top of today's column. */
export type WeekAgendaRunningTimer = {
  projectName: string;
  projectColor: string;
  description: string;
  elapsedLabel: string;
};

/** Seven columns on a desktop, an accordion on a phone. Decided by the caller, from the viewport. */
export type WeekAgendaLayout = "columns" | "accordion";

export type WeekAgendaLabels = {
  /** The column header — `Open Monday, Aug 31`. Pressing it zooms into the day. */
  openDay: (day: WeekAgendaDay) => string;
  /** The accordion header while its panel is collapsed — `Show Monday`. */
  expandDay: (day: WeekAgendaDay) => string;
  /** `8.5 h of 8 h`. */
  capacity: (day: WeekAgendaDay) => string;
  /** `over 8 h`. */
  over: string;
  locked: string;
  onLeave: string;
  today: string;
  columnEmpty: string;
  copyYesterday: string;
  addEntry: (day: WeekAgendaDay) => string;
  emptyWeekTitle: string;
  emptyWeekDescription: string;
  /** The empty week's two buttons. */
  addEntryPlain: string;
  duplicateLastWeek: string;
  card: EntryCardLabels;
  timer: RunningEntryCardLabels;
};

export type WeekAgendaProps = {
  days: WeekAgendaDay[];
  /** The expanded day in the accordion. Not marked in the columns: a header there opens the day. */
  selectedDayIso: string;
  capacityMinutes: number;
  layout: WeekAgendaLayout;
  locale: string;
  durationDisplayFormat: DurationDisplayFormat;
  labels: WeekAgendaLabels;
  /** A pending mutation, which disables every affordance that would start another. */
  disabled?: boolean;
  /**
   * Whether entry cards animate in when they mount, staggered and capped.
   *
   * Off by default, which is what a scope arriving on the page's first paint wants and what keeps
   * Storybook, jsdom and the visual baselines showing the settled state rather than a frame of a
   * transition. `/time` turns it on once the first paint is behind it.
   */
  animateEntries?: boolean;
  runningTimer?: WeekAgendaRunningTimer | null;
  /** The card that was just saved, which runs the pulse once. */
  highlight?: EntryHighlight | null;
  /** Whether cards offer Continue — off while a timer is already running. */
  canContinue?: boolean;
  canDuplicatePreviousWeek?: boolean;
  /** Which column's quick composer is open, anchored to its `+`. */
  composerDayIso?: string | null;
  renderComposer?: (day: WeekAgendaDay) => ReactNode;
  /** The hybrid handoff, as a quiet footnote under the columns. */
  footnote?: ReactNode;
  className?: string;
  onSelectDay: (isoDate: string) => void;
  onOpenDay: (isoDate: string) => void;
  onAddEntry: (isoDate: string) => void;
  onComposerOpenChange?: (isoDate: string, open: boolean) => void;
  onEditEntry: (entry: WeekAgendaEntry) => void;
  onDeleteEntry: (entry: WeekAgendaEntry) => void;
  onContinueEntry?: (entry: WeekAgendaEntry) => void;
  onCopyPreviousDay?: (isoDate: string) => void;
  onDuplicatePreviousWeek?: () => void;
  onStopTimer?: () => void;
};
