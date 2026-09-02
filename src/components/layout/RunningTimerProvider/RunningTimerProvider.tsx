"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";

import type {
  RunningTimerContextValue,
  RunningTimerProviderProps,
} from "./RunningTimerProvider.types";

const emptyContext: RunningTimerContextValue = {
  timer: null,
  isStopping: false,
  error: null,
  dismissError: () => {},
};

const RunningTimerContext = createContext<RunningTimerContextValue>(emptyContext);

/**
 * Makes the running timer available to the app shell on every route.
 *
 * It is mounted in the root layout, which is the only place in this app that survives a client-side
 * navigation — every page renders its own `AppShell`, so anything held inside the shell is thrown
 * away and re-created on each navigation. Sitting above that boundary is what lets the header pill
 * keep ticking from `/time` to `/admin/projects` without a refetch or a flicker.
 *
 * There is no client-side state for the timer itself: the value is whatever the last server render
 * produced. `router.refresh()` re-renders the root layout along with the rest of the current route,
 * and every start and stop already calls it, so the pill stays truthful without a store to keep in
 * sync. The deliberate gap is a second tab — a timer started elsewhere shows up here on the next
 * hard load or refresh, and stopping one that is already stopped surfaces the localized
 * "no timer is running" message rather than doing damage.
 */
export function RunningTimerProvider({ timer, stopAction, children }: RunningTimerProviderProps) {
  const router = useRouter();
  const [isStopping, startStoppingTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dismissError = useCallback(() => setError(null), []);

  const stopTimer = useCallback(() => {
    startStoppingTransition(async () => {
      const result = await stopAction();

      setError(result.status === "error" ? result.message : null);

      /*
        Refreshed on the error path too, and that is not belt-and-braces. Stopping a timer that
        would push the day past 24 hours discards the time and deletes the row, then reports itself
        as an error — returning early there would leave the header showing a timer that no longer
        exists. The message survives the refresh because it lives in this provider rather than in
        the pill it was raised from.
      */
      router.refresh();
    });
  }, [router, stopAction]);

  const value = useMemo<RunningTimerContextValue>(
    () => ({ timer, isStopping, error, stopTimer, dismissError }),
    [dismissError, error, isStopping, stopTimer, timer],
  );

  return <RunningTimerContext.Provider value={value}>{children}</RunningTimerContext.Provider>;
}

/**
 * Falls back to an empty timer rather than throwing when no provider is mounted: `AppShell` is
 * rendered bare by its tests and every one of its stories, and none of them should have to stand up
 * a provider to render a header with no timer in it.
 */
export function useRunningTimer(): RunningTimerContextValue {
  return useContext(RunningTimerContext);
}
