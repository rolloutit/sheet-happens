"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * Writes search params with the native History API instead of `router.push`.
 *
 * Next syncs `pushState` / `replaceState` into `useSearchParams` without re-running the Server
 * Component, and the pages that keep view state in the URL are `force-dynamic` — so a `router.push`
 * would re-issue the page's database queries for data the client already holds. `replaceState`
 * rather than `pushState` on purpose: Back should mean "the previous page", not "the previous view
 * state", and every view state written this way has a visible control that changes it back.
 *
 * `null` deletes a param. Several params in one call land in a single history write, which matters
 * when two of them describe one user action — zooming into a day sets the level and the day
 * together, and neither half is a state the user asked for on its own.
 */
export function replaceSearchParams(updates: Record<string, string | null>) {
  const params = new URLSearchParams(window.location.search);

  for (const [name, value] of Object.entries(updates)) {
    if (value === null) params.delete(name);
    else params.set(name, value);
  }

  const query = params.toString();

  window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
}

/** One search param as read/write state. `null` means the param is absent. */
export function useHistoryParam(name: string) {
  const searchParams = useSearchParams();
  const value = searchParams.get(name);

  const setValue = useCallback(
    (next: string | null) => {
      replaceSearchParams({ [name]: next });
    },
    [name],
  );

  return [value, setValue] as const;
}
