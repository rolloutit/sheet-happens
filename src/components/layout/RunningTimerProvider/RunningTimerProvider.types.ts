import type { ReactNode } from "react";

/** What the header pill needs to draw a running timer. A trimmed `RunningTimerView`. */
export type RunningTimerSnapshot = {
  description: string;
  projectName: string;
  projectColor: string;
  startedAt: string;
  /** Where the pill navigates when clicked. Defaults to the time-tracking page. */
  href?: string;
};

export type RunningTimerStopResult = {
  status: "idle" | "success" | "error";
  message: string;
};

export type RunningTimerContextValue = {
  timer: RunningTimerSnapshot | null;
  isStopping: boolean;
  /** Set when the last stop attempt reported one. Outlives `timer` on purpose — see the provider. */
  error: string | null;
  /** Absent when no provider is mounted, which is what disables the pill's stop button. */
  stopTimer?: () => void;
  dismissError: () => void;
};

export type RunningTimerProviderProps = {
  /** Resolved server-side in the root layout. `null` when nothing is running, or nobody is signed in. */
  timer: RunningTimerSnapshot | null;
  stopAction: () => Promise<RunningTimerStopResult>;
  children: ReactNode;
};
