"use client";

import { useCallback, useSyncExternalStore } from "react";

import { replaceSearchParams, useHistoryParam } from "@/src/lib/use-history-param";

import {
  clampScope,
  DAY_PARAM,
  defaultLens,
  defaultScope,
  isTimeScope,
  isWeekLens,
  LEGACY_ZOOM_PARAM,
  LENS_PARAM,
  lensStorageKey,
  mapLegacyZoom,
  phoneDefaultScope,
  resolveSelectedDayIso,
  SCOPE_PARAM,
  scopeStorageKey,
  timeScopes,
  type TimeScope,
  type WeekLens,
} from "./zoom";

export type TimeView = {
  scope: TimeScope;
  lens: WeekLens;
  selectedDayIso: string;
  setScope: (scope: TimeScope) => void;
  setLens: (lens: WeekLens) => void;
  setSelectedDayIso: (isoDate: string) => void;
  /** One user action, so one history write: the day and the scope land together. */
  zoomToDay: (isoDate: string) => void;
  /** `G` from Day or Month: the week scope and a lens in one write. */
  openWeek: (lens: WeekLens) => void;
};

/**
 * The view state, which lives in the URL rather than in React (§10).
 *
 * That is what makes a scope survive a reload and a link carry one. Any component under `/time`
 * can call this: both readings resolve from the same `useSearchParams`, so there is no second
 * source of truth to keep in step.
 *
 * Reading order for the scope: `?scope=`, then an old `?zoom=` link mapped through
 * `mapLegacyZoom`, then the remembered preference, then the form-factor default — Week on a
 * desktop, Day on a phone. The lens reads the same way with its own param and its own memory.
 *
 * `stops` is the member's own scope list (`resolveScopeStops`), and the scope is clamped to it on
 * every read. A declared-only member therefore lands on the month even when the URL or the
 * remembered preference names a scope they do not have — and because the clamp is on the read, the
 * scope that was forced on them is never written back as a preference.
 */
export function useTimeView(
  week: {
    days: readonly { isoDate: string }[];
    todayIso: string;
  },
  stops: readonly TimeScope[] = timeScopes,
): TimeView {
  const [scopeParam] = useHistoryParam(SCOPE_PARAM);
  const [lensParam] = useHistoryParam(LENS_PARAM);
  const [legacyZoomParam] = useHistoryParam(LEGACY_ZOOM_PARAM);
  const [dayParam, setDayParam] = useHistoryParam(DAY_PARAM);
  const rememberedScope = useRemembered(scopeStorageKey, isTimeScope);
  const rememberedLens = useRemembered(lensStorageKey, isWeekLens);
  const phone = usePhone();

  const legacy = mapLegacyZoom(legacyZoomParam);
  const scope = clampScope(
    isTimeScope(scopeParam)
      ? scopeParam
      : (legacy?.scope ?? rememberedScope ?? (phone ? phoneDefaultScope : defaultScope)),
    stops,
  );
  const lens: WeekLens = isWeekLens(lensParam)
    ? lensParam
    : (legacy?.lens ?? rememberedLens ?? defaultLens);
  const selectedDayIso = resolveSelectedDayIso(dayParam, week.days, week.todayIso);

  const setScope = useCallback((next: TimeScope) => {
    remember(scopeStorageKey, next);
    // The legacy param goes the moment the new one is written, so the URL says one thing.
    replaceSearchParams({ [SCOPE_PARAM]: next, [LEGACY_ZOOM_PARAM]: null });
  }, []);

  const setLens = useCallback((next: WeekLens) => {
    remember(lensStorageKey, next);
    replaceSearchParams({ [LENS_PARAM]: next, [LEGACY_ZOOM_PARAM]: null });
  }, []);

  const setSelectedDayIso = useCallback(
    (isoDate: string) => {
      setDayParam(isoDate);
    },
    [setDayParam],
  );

  const zoomToDay = useCallback((isoDate: string) => {
    remember(scopeStorageKey, "day");
    replaceSearchParams({
      [DAY_PARAM]: isoDate,
      [SCOPE_PARAM]: "day",
      [LEGACY_ZOOM_PARAM]: null,
    });
  }, []);

  const openWeek = useCallback((nextLens: WeekLens) => {
    remember(scopeStorageKey, "week");
    remember(lensStorageKey, nextLens);
    replaceSearchParams({
      [SCOPE_PARAM]: "week",
      [LENS_PARAM]: nextLens,
      [LEGACY_ZOOM_PARAM]: null,
    });
  }, []);

  return { scope, lens, selectedDayIso, setScope, setLens, setSelectedDayIso, zoomToDay, openWeek };
}

/**
 * The last value this browser was left on, which applies only when the URL names none.
 *
 * Read through `useSyncExternalStore` rather than in an effect: the server snapshot is `null`, so
 * the markup React sends and the markup it hydrates agree, and the stored value arrives on the
 * first client render instead of a second one. An explicit `?scope=` never reaches here, so a
 * shared link always opens on the scope it names.
 */
function useRemembered<T extends string>(key: string, isValid: (value: unknown) => value is T) {
  const read = useCallback(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return isValid(stored) ? stored : null;
    } catch {
      // Storage is unavailable in a locked-down browser and full in a Safari private window.
      return null;
    }
  }, [isValid, key]);

  return useSyncExternalStore(subscribeToRemembered, read, () => null);
}

const rememberedListeners = new Set<() => void>();

function subscribeToRemembered(onStoreChange: () => void) {
  rememberedListeners.add(onStoreChange);
  // Another tab writing the preference counts as a change too.
  window.addEventListener("storage", onStoreChange);

  return () => {
    rememberedListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function remember(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // A remembered preference is a convenience; losing it is not worth an error path.
  }

  for (const listener of rememberedListeners) listener();
}

/**
 * Whether this is a phone-sized viewport, or `null` while the answer is not yet known.
 *
 * The three-state shape is the point: the server snapshot is `null`, which the caller reads as
 * "desktop default", so the markup React sends and hydrates is the Week scope everywhere. On a
 * phone the store then answers `true` on the render right after hydration — before anything is
 * painted — and the Day scope takes over without a visible flip. A two-state `false` server
 * snapshot would do the same on desktop but the other way round on a phone, which is the form
 * factor the default exists for.
 */
const PHONE_QUERY = "(max-width: 63.999rem)";

function usePhone(): boolean | null {
  return useSyncExternalStore(
    subscribeToPhone,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => null,
  );
}

function subscribeToPhone(onStoreChange: () => void) {
  const list = window.matchMedia(PHONE_QUERY);

  list.addEventListener("change", onStoreChange);
  return () => list.removeEventListener("change", onStoreChange);
}
