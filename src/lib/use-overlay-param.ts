"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { replaceSearchParams } from "./use-history-param";

/**
 * Drives an overlay (drawer, dialog) from a search param instead of local state.
 *
 * Three things fall out of putting the open state in the URL: the overlay survives a
 * refresh, it can be linked to ("open this and add the project"), and a trigger button
 * in a page header can open a drawer rendered somewhere else on the page without either
 * component knowing about the other.
 *
 * The param is written through `replaceSearchParams`, which is the one History-API writer
 * this app uses — see `use-history-param.ts` for why these pages must not `router.push`.
 * `replaceState` rather than `pushState` matters twice over here: a drawer that swallows the
 * browser Back button strands people whenever the state desyncs, and Escape, the close button,
 * and the scrim already dismiss it.
 */
export function useOverlayParam(name: string, value = "1") {
  const searchParams = useSearchParams();
  const open = searchParams.get(name) === value;

  const setOpen = useCallback(
    (next: boolean) => {
      replaceSearchParams({ [name]: next ? value : null });
    },
    [name, value],
  );

  return [open, setOpen] as const;
}
