"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a CSS media query currently matches, as a value React can render against.
 *
 * For the cases where a `hidden lg:block` class is not enough because JavaScript also has to know
 * which of two responsive renderings is the live one. The `/time` grid is the motivating case: its
 * day headers exist only on desktop, and a `display: none` copy of them still measures — as a box
 * of zeros — to anything that walks the DOM.
 *
 * Read through `useSyncExternalStore` so the server snapshot is a plain `false`: the markup React
 * sends and the markup it hydrates agree, and the real answer arrives on the render after
 * hydration rather than as a mismatch inside it. Nothing may depend on this being right during the
 * first paint.
 */
export type UseMediaQueryOptions = {
  /**
   * What the server render and the hydrating render assume, before the real answer arrives on the
   * render right after hydration. Defaults to `false`. `/time` passes `true` for its desktop query
   * so the server sends the desktop chrome — the primary form factor, and the one whose markup an
   * e2e assertion may read before hydration has finished — and a phone corrects itself before its
   * first paint through `useSyncExternalStore`'s synchronous re-render.
   */
  serverSnapshot?: boolean;
};

export function useMediaQuery(query: string, options: UseMediaQueryOptions = {}): boolean {
  const { serverSnapshot = false } = options;
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = window.matchMedia(query);

      list.addEventListener("change", onStoreChange);
      return () => list.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverSnapshot,
  );
}
