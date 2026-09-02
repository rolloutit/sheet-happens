"use client";

import { useSyncExternalStore } from "react";

import { formatElapsed } from "./elapsed";

/**
 * The live "1:23:45" label for a running timer.
 *
 * The clock is a `useSyncExternalStore` over a single 1 s interval rather than
 * `useState` + `useEffect`: the snapshot is whole seconds, so React bails out of re-rendering
 * whenever the interval fires inside the same second, and every consumer on the page shares one
 * timer.
 *
 * The server snapshot is `null` on purpose. `Date.now()` differs between the server render and
 * hydration, so returning a real time there is a guaranteed mismatch; `"0:00"` renders identically
 * on both sides and is replaced on the first client tick.
 */
export function useElapsedLabel(startedAt: string | null) {
  const nowSeconds = useClientClock();

  if (!startedAt || nowSeconds === null) return "0:00";

  return formatElapsed(nowSeconds * 1000 - Date.parse(startedAt));
}

function useClientClock() {
  return useSyncExternalStore(subscribeToClock, getClockSnapshot, getServerClockSnapshot);
}

function subscribeToClock(onStoreChange: () => void) {
  const timerId = window.setInterval(onStoreChange, 1000);
  return () => window.clearInterval(timerId);
}

function getClockSnapshot() {
  return Math.floor(Date.now() / 1000);
}

function getServerClockSnapshot() {
  return null;
}
