import type { DurationDisplayFormat } from "@/src/lib/formatting";

export type WeekAgendaDayState = "normal" | "today" | "future";

export type WeekAgendaEntry = {
  id: string;
  projectName: string;
  projectColor: string;
  description: string;
  durationMinutes: number;
  /** `HH:mm`, or `null` for a duration-only entry. Both ends are set together or not at all. */
  startTime: string | null;
  endTime: string | null;
  locked: boolean;
  /** Already-translated sentences, shown compactly on the card and in full on hover. */
  warnings: string[];
  adminModified: boolean;
};

export type WeekAgendaDay = {
  isoDate: string;
  /** The day's own name — `Monday`. Also names the column's region. */
  label: string;
  shortLabel: string;
  dayNumber: string;
  state: WeekAgendaDayState;
  locked: boolean;
  totalMinutes: number;
  entries: WeekAgendaEntry[];
};

export type WeekAgendaLabels = {
  /** The day header once its panel is open: pressing it again zooms into that day. */
  openDay: (day: WeekAgendaDay) => string;
  /** The same header while its panel is collapsed, which only happens on mobile. */
  expandDay: (day: WeekAgendaDay) => string;
  columnEmpty: string;
  addEntry: (day: WeekAgendaDay) => string;
  editEntry: (entry: WeekAgendaEntry) => string;
  deleteEntry: (entry: WeekAgendaEntry) => string;
  adminModified: string;
};

export type WeekAgendaProps = {
  days: WeekAgendaDay[];
  /** The expanded day on mobile, and the marked column on desktop. */
  selectedDayIso: string;
  locale: string;
  durationDisplayFormat: DurationDisplayFormat;
  labels: WeekAgendaLabels;
  /** A pending mutation, which disables every affordance that would start another. */
  disabled?: boolean;
  className?: string;
  onSelectDay: (isoDate: string) => void;
  onZoomToDay: (isoDate: string) => void;
  onAddEntry: (isoDate: string) => void;
  onEditEntry: (entry: WeekAgendaEntry) => void;
  onDeleteEntry: (entry: WeekAgendaEntry) => void;
};
