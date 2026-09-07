export type QuickEntryComposerProject = {
  projectId: string;
  name: string;
  color: string;
};

export type QuickEntryComposerValue = {
  projectId: string;
  /** Whatever the member typed — `2h30`, `3.5`, `3:30`. Parsed on submit, never while typing. */
  durationText: string;
  description: string;
};

export type QuickEntryComposerLabels = {
  /** `Add to Mon, Aug 31`. */
  title: string;
  project: string;
  duration: string;
  durationPlaceholder: string;
  description: string;
  /** `What did you do?` */
  descriptionPlaceholder: string;
  /** The `More options →` action that opens the full dialog with the fields carried over. */
  more: string;
  /** The `Interval instead` action — the full dialog in interval mode. */
  interval: string;
  add: string;
  /** `Enter adds`, beside the submit key chip. */
  submitHint: string;
  /** Validation copy. */
  invalidDuration: string;
  descriptionRequired: string;
  noProject: string;
};

export type QuickEntryComposerProps = {
  /** Recent first, then the rest of the assigned projects. The caller decides the order. */
  projects: QuickEntryComposerProject[];
  value: QuickEntryComposerValue;
  labels: QuickEntryComposerLabels;
  /** The action is in flight. */
  pending?: boolean;
  /** A rejected save, already worded. Kept above the fields so the input is not lost. */
  error?: string | null;
  /** Which field takes focus on mount. The duration on desktop, where the project is usually right. */
  autoFocus?: "duration" | "description" | null;
  /** Each change moves focus to the duration field — how `N` reaches a composer that is already open. */
  focusToken?: number;
  /** A quiet trailing line, for the draft status. */
  footnote?: string | null;
  className?: string;
  onValueChange: (value: QuickEntryComposerValue) => void;
  /** Called with a valid value only: the composer validates before reporting. */
  onSubmit: (value: QuickEntryComposerValue & { durationMinutes: number }) => void;
  onMoreOptions: () => void;
  onInterval?: () => void;
};
