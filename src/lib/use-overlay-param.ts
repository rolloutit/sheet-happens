"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * Drives an overlay (drawer, dialog) from a search param instead of local state.
 *
 * Three things fall out of putting the open state in the URL: the overlay survives a
 * refresh, it can be linked to ("open this and add the project"), and a trigger button
 * in a page header can open a drawer rendered somewhere else on the page without either
 * component knowing about the other.
 *
 * The param is written with the native History API rather than `router.push`. Next syncs
 * `pushState` / `replaceState` into `useSearchParams` without re-running the Server
 * Component, and these pages are `force-dynamic` — opening a drawer must not re-issue the
 * page's database queries. `replaceState` rather than `pushState` on purpose: a drawer
 * that swallows the browser Back button strands people whenever the state desyncs, and
 * Escape, the close button, and the scrim already dismiss it.
 */
export function useOverlayParam(name: string, value = "1") {
  const searchParams = useSearchParams();
  const open = searchParams.get(name) === value;

  const setOpen = useCallback(
    (next: boolean) => {
      const params = new URLSearchParams(window.location.search);

      if (next) params.set(name, value);
      else params.delete(name);

      const query = params.toString();

      window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
    },
    [name, value],
  );

  return [open, setOpen] as const;
}
