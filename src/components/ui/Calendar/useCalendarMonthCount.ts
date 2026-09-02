"use client";

import { useEffect, useState } from "react";

/** Below this width a two-month calendar overflows the popover. */
const twoMonthQuery = "(min-width: 40rem)";

/**
 * Narrows a multi-month calendar to a single month on small screens.
 *
 * Safe from hydration mismatch despite reading `matchMedia`: a calendar only ever mounts
 * inside an already-open popover, which is to say after hydration.
 */
export function useCalendarMonthCount(desired: number) {
  const [fits, setFits] = useState(true);

  useEffect(() => {
    if (desired <= 1) return;

    const query = window.matchMedia(twoMonthQuery);
    const sync = () => setFits(query.matches);

    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [desired]);

  return fits ? desired : 1;
}
