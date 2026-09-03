"use client";

import { useCallback, useSyncExternalStore } from "react";

import { replaceSearchParams, useHistoryParam } from "@/src/lib/use-history-param";

import {
  DAY_PARAM,
  defaultZoomLevel,
  isZoomLevel,
  resolveSelectedDayIso,
  ZOOM_PARAM,
  zoomStorageKey,
  type ZoomLevel,
} from "./zoom";

export type TimeZoom = {
  level: ZoomLevel;
  selectedDayIso: string;
  setLevel: (level: ZoomLevel) => void;
  setSelectedDayIso: (isoDate: string) => void;
  /** One user action, so one history write: the day and the level land together. */
  zoomToDay: (isoDate: string) => void;
};

/**
 * The axis state, which lives in the URL rather than in React.
 *
 * That is what makes a level survive a reload and a link carry one. Any component under `/time`
 * can call this: both readings resolve from the same `useSearchParams`, so there is no second
 * source of truth to keep in step.
 */
export function useTimeZoom(week: {
  days: readonly { isoDate: string }[];
  todayIso: string;
}): TimeZoom {
  const [zoomParam, setZoomParam] = useHistoryParam(ZOOM_PARAM);
  const [dayParam, setDayParam] = useHistoryParam(DAY_PARAM);
  const rememberedLevel = useRememberedLevel();

  const level = isZoomLevel(zoomParam) ? zoomParam : (rememberedLevel ?? defaultZoomLevel);
  const selectedDayIso = resolveSelectedDayIso(dayParam, week.days, week.todayIso);

  const setLevel = useCallback(
    (next: ZoomLevel) => {
      rememberLevel(next);
      setZoomParam(next);
    },
    [setZoomParam],
  );

  const setSelectedDayIso = useCallback(
    (isoDate: string) => {
      setDayParam(isoDate);
    },
    [setDayParam],
  );

  const zoomToDay = useCallback((isoDate: string) => {
    rememberLevel("day");
    replaceSearchParams({ [DAY_PARAM]: isoDate, [ZOOM_PARAM]: "day" });
  }, []);

  return { level, selectedDayIso, setLevel, setSelectedDayIso, zoomToDay };
}

/**
 * The last level this browser was left on, which applies only when the URL names none.
 *
 * Read through `useSyncExternalStore` rather than in an effect: the server snapshot is `null`, so
 * the markup React sends and the markup it hydrates agree, and the stored level arrives on the
 * first client render instead of a second one. An explicit `?zoom=` never reaches here, so a
 * shared link always opens on the level it names.
 */
function useRememberedLevel() {
  return useSyncExternalStore(subscribeToRememberedLevel, readRememberedLevel, () => null);
}

const rememberedLevelListeners = new Set<() => void>();

function subscribeToRememberedLevel(onStoreChange: () => void) {
  rememberedLevelListeners.add(onStoreChange);
  // Another tab writing the preference counts as a change too.
  window.addEventListener("storage", onStoreChange);

  return () => {
    rememberedLevelListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

/** Storage is unavailable in a locked-down browser and full in a Safari private window. */
function readRememberedLevel(): ZoomLevel | null {
  try {
    const stored = window.localStorage.getItem(zoomStorageKey);
    return isZoomLevel(stored) ? stored : null;
  } catch {
    return null;
  }
}

function rememberLevel(level: ZoomLevel) {
  try {
    window.localStorage.setItem(zoomStorageKey, level);
  } catch {
    // A remembered preference is a convenience; losing it is not worth an error path.
  }

  for (const listener of rememberedLevelListeners) listener();
}
