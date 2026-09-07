export type EntryCardDensity = "compact" | "comfortable";

/** An entry as a card shows it: resolved, formatted, and with nothing left to look up. */
export type EntryCardEntry = {
  id: string;
  projectName: string;
  projectColor: string;
  description: string;
  durationMinutes: number;
  /** `HH:mm`, or `null` for a duration-only entry. Both ends are set together or not at all. */
  startTime: string | null;
  endTime: string | null;
  /** Created by a timer — carries the `▷` glyph before its duration. */
  timed: boolean;
  locked: boolean;
  adminModified: boolean;
  /** Already-translated sentences, shown as a glyph on the card and in full on hover. */
  warnings: string[];
};

export type EntryCardLabels = {
  edit: (entry: EntryCardEntry) => string;
  delete: (entry: EntryCardEntry) => string;
  /** `Continue <description>` — start a timer with this project and description. */
  continue: (entry: EntryCardEntry) => string;
  adminModified: string;
  timed: string;
  locked: string;
};

/**
 * Which card runs the saved pulse. `token` changes on every new highlight so the same card can
 * pulse twice in a row — the overlay that carries the animation is keyed by it.
 */
export type EntryHighlight = {
  id: string;
  token: number;
};

export type EntryCardProps = {
  entry: EntryCardEntry;
  /** The duration, already formatted — `4.25 h`. */
  durationLabel: string;
  /** `compact` is the Week column card, `comfortable` the Day row. */
  density?: EntryCardDensity;
  labels: EntryCardLabels;
  /** A pending mutation, which disables every affordance that would start another. */
  disabled?: boolean;
  /** Runs the one-shot saved pulse. A new token re-runs it; `null` shows nothing. */
  highlightToken?: number | null;
  /** Whether the Continue action is offered at all — off when a timer is already running. */
  canContinue?: boolean;
  className?: string;
  /** Extra content under the meta line — the admin correction notice in the Day scope. */
  children?: React.ReactNode;
  onEdit: (entry: EntryCardEntry) => void;
  onDelete: (entry: EntryCardEntry) => void;
  onContinue?: (entry: EntryCardEntry) => void;
};

export type RunningEntryCardLabels = {
  /** `Running now`. */
  live: string;
  stop: string;
};

export type RunningEntryCardProps = {
  projectName: string;
  projectColor: string;
  description: string;
  /** The live reading, from `useElapsedLabel` — passed in so the card never ticks on its own. */
  elapsedLabel: string;
  density?: EntryCardDensity;
  labels: RunningEntryCardLabels;
  disabled?: boolean;
  className?: string;
  onStop?: () => void;
};
