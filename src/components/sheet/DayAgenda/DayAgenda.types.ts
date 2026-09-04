import type { DurationDisplayFormat } from "@/src/lib/formatting";

export type DayAgendaDayState = "normal" | "today" | "future";

export type DayAgendaEntry = {
  id: string;
  projectName: string;
  projectColor: string;
  description: string;
  durationMinutes: number;
  /** `HH:mm`, or `null` for a duration-only entry. Both ends are set together or not at all. */
  startTime: string | null;
  endTime: string | null;
  /** How the entry was created, already translated — `Grid`, `Form`, `Timer`. */
  sourceLabel: string;
  locked: boolean;
  /** Already-translated sentences. An entry with any warning tints its row. */
  warnings: string[];
  adminNotice: DayAgendaAdminNotice | null;
};

export type DayAgendaAdminNotice = {
  changedBy: string;
  reason: string;
};

export type DayAgendaLabels = {
  durationMode: string;
  futureDay: string;
  overCapacity: string;
  emptyTitle: string;
  emptyDescription: string;
  addEntry: string;
  editEntry: (entry: DayAgendaEntry) => string;
  deleteEntry: (entry: DayAgendaEntry) => string;
};

export type DayAgendaProps = {
  isoDate: string;
  dayState: DayAgendaDayState;
  totalMinutes: number;
  /** The daily target the `overCapacity` warning is measured against. */
  capacityMinutes: number;
  entries: DayAgendaEntry[];
  locale: string;
  durationDisplayFormat: DurationDisplayFormat;
  labels: DayAgendaLabels;
  /** A pending mutation, which disables every affordance that would start another. */
  disabled?: boolean;
  /**
   * Whether entry rows animate in when they mount, staggered and capped. Off by default — see the
   * same prop on `WeekAgenda` for why the page's first paint must not animate.
   */
  animateEntries?: boolean;
  className?: string;
  onAddEntry: (isoDate: string) => void;
  onEditEntry: (entry: DayAgendaEntry) => void;
  onDeleteEntry: (entry: DayAgendaEntry) => void;
};
