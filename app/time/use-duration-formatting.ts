"use client";

import { createContext, useCallback, useContext } from "react";
import { useLocale } from "next-intl";

import { formatDurationForInput } from "@/src/lib/duration";
import {
  formatHours as formatDurationHours,
  formatHoursWithUnit as formatDurationHoursWithUnit,
  type DurationDisplayFormat,
} from "@/src/lib/formatting";

/** The member's duration display preference, read by every figure on the page. */
export const DurationDisplayContext = createContext<DurationDisplayFormat>("DECIMAL_HOURS");

export function useDurationFormatting() {
  const locale = useLocale();
  const durationDisplayFormat = useContext(DurationDisplayContext);
  const formatMinutesAsHours = useCallback(
    (minutes: number) => formatDurationHours(minutes, locale, durationDisplayFormat),
    [durationDisplayFormat, locale],
  );
  const formatMinutesWithUnit = useCallback(
    (minutes: number) => formatDurationHoursWithUnit(minutes, locale, durationDisplayFormat),
    [durationDisplayFormat, locale],
  );
  const formatMinutesForInput = useCallback(
    (minutes: number) => formatDurationForInput(minutes, durationDisplayFormat),
    [durationDisplayFormat],
  );

  return {
    durationDisplayFormat,
    formatMinutesAsHours,
    formatMinutesForInput,
    formatMinutesWithUnit,
  };
}
