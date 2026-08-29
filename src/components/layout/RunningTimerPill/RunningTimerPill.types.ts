import type { RunningTimerSnapshot } from "../RunningTimerProvider";

export type RunningTimerPillLabels = {
  /** Accessible name of the pill itself, which navigates to time tracking. */
  open: string;
  /** Accessible name of the stop button. */
  stop: string;
  /** Announced alongside the elapsed time so the pill reads as more than a number. */
  running: string;
  /** Accessible name of the error note's dismiss button. */
  dismissError: string;
};

export type RunningTimerPillProps = {
  /**
   * `null` while nothing is running. The component still renders in that case if `error` is set —
   * a timer discarded at the daily limit reports an error *and* disappears, and the reason has to
   * outlive the pill that raised it.
   */
  timer: RunningTimerSnapshot | null;
  /**
   * The live reading, from `useElapsedLabel`. Passed in rather than derived here so the component
   * is a pure function of its props — a clock inside it would tick a visual baseline out from
   * under the screenshot.
   */
  elapsedLabel: string;
  labels: RunningTimerPillLabels;
  /**
   * `compact` drops the project name, `comfortable` always shows it, and `responsive` (the default)
   * hides it below `md` so one pill serves both the mobile and the desktop header.
   */
  density?: "compact" | "comfortable" | "responsive";
  /** Disables the stop button only — the pill still navigates. */
  disabled?: boolean;
  error?: string | null;
  className?: string;
  onOpen?: () => void;
  onStop?: () => void;
  onDismissError?: () => void;
};
