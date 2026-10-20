import type { ReactNode } from "react";

import type { DurationDisplayFormat } from "@/src/lib/formatting";
import type {
  EntryCardEntry,
  EntryCardLabels,
  EntryHighlight,
  RunningEntryCardLabels,
} from "../EntryCard";

export type DayAgendaDayState = "normal" | "today" | "future";

export type DayAgendaAdminNotice = {
  changedBy: string;
  reason: string;
};

export type DayAgendaEntry = EntryCardEntry & {
  adminNotice: DayAgendaAdminNotice | null;
};

/** One project's share of the day, for the rail. */
export type DayAgendaSplit = {
  projectId: string;
  name: string;
  color: string;
  minutes: number;
};

export type DayAgendaRunningTimer = {
  projectName: string;
  projectColor: string;
  description: string;
  elapsedLabel: string;
};

export type DayAgendaLabels = {
  futureDay: string;
  overCapacity: string;
  emptyTitle: string;
  emptyDescription: string;
  addEntry: string;
  copyYesterday: string;
  /** The rail's heading — `At a glance`. Also the collapsible's summary below `lg`. */
  glance: string;
  /** `of 8 h target`. */
  target: string;
  /** `over 8 h`, beside the ring when the day is past its target. */
  over: string;
  split: string;
  noSplit: string;
  quickAdd: string;
  card: EntryCardLabels;
  timer: RunningEntryCardLabels;
};

export type DayAgendaProps = {
  isoDate: string;
  dayState: DayAgendaDayState;
  totalMinutes: number;
  /** The daily target the ring and the `overCapacity` warning are measured against. */
  capacityMinutes: number;
  entries: DayAgendaEntry[];
  split: DayAgendaSplit[];
  locale: string;
  durationDisplayFormat: DurationDisplayFormat;
  labels: DayAgendaLabels;
  /** A pending mutation, which disables every affordance that would start another. */
  disabled?: boolean;
  /** Hides the add affordances: the day is locked by a timesheet or covered by a full-day leave. */
  locked?: boolean;
  /**
   * Whether entry rows animate in when they mount, staggered and capped. Off by default — see the
   * same prop on `WeekAgenda` for why the page's first paint must not animate.
   */
  animateEntries?: boolean;
  runningTimer?: DayAgendaRunningTimer | null;
  /** The card that was just saved, which runs the pulse once. */
  highlight?: EntryHighlight | null;
  canContinue?: boolean;
  canCopyPreviousDay?: boolean;
  /** The quick composer, rendered open in the rail. Omitted on a phone, where the FAB owns it. */
  composer?: ReactNode;
  className?: string;
  onAddEntry: (isoDate: string) => void;
  onEditEntry: (entry: DayAgendaEntry) => void;
  onDeleteEntry: (entry: DayAgendaEntry) => void;
  onContinueEntry?: (entry: DayAgendaEntry) => void;
  onCopyPreviousDay?: (isoDate: string) => void;
  onStopTimer?: () => void;
};
