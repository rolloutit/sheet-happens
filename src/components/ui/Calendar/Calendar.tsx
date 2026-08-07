"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { DayPicker, type ChevronProps, type Matcher } from "react-day-picker";

import { parseDateValue, startOfUtcMonth, toDateValue } from "@/src/lib/date-values";
import { formatDateLabel, formatMonthLabel, formatWeekdayLabel } from "@/src/lib/formatting";
import { cn } from "@/src/lib/utils";
import { calendarClassNames } from "./Calendar.classNames";
import type { CalendarProps } from "./Calendar.types";
import { useCalendarMonthCount } from "./useCalendarMonthCount";

function CalendarChevron({ orientation, className }: ChevronProps) {
  const Icon =
    orientation === "left"
      ? ChevronLeft
      : orientation === "right"
        ? ChevronRight
        : orientation === "up"
          ? ChevronUp
          : ChevronDown;

  return <Icon className={cn("size-4", className)} aria-hidden="true" />;
}

/**
 * The month grid behind every date picker.
 *
 * Runs in `timeZone="UTC"`, which is what makes it interoperate with the rest of the app:
 * calendar dates here are `YYYY-MM-DD` strings and UTC-midnight `Date`s, and a picker doing
 * local-time arithmetic would land a day off for anyone not sitting on the meridian. The
 * public API never exposes a `Date` at all — strings go in and strings come out, converted
 * at this boundary. react-day-picker hands `onSelect` a `TZDate`; it must not escape.
 *
 * Every visible string is produced by `src/lib/formatting`, not by react-day-picker's own
 * date-fns locales. That keeps `Intl` the single formatting authority the way CLAUDE.md
 * requires, keeps the calendar's dates spelled the same as the tables around it, and avoids
 * shipping locale chunks for a second date library.
 */
export function Calendar({
  locale,
  min,
  max,
  disabledDates,
  numberOfMonths = 1,
  labels,
  className,
  autoFocus,
  ...props
}: CalendarProps) {
  const months = useCalendarMonthCount(numberOfMonths);
  const minDate = min ? parseDateValue(min) : undefined;
  const maxDate = max ? parseDateValue(max) : undefined;

  /**
   * Out-of-range days are disabled rather than hidden. A rate period clamped to the
   * previous period reads far better as greyed-out days than as holes in the grid.
   */
  const disabled: Matcher[] = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
    ...(disabledDates ? [(date: Date) => disabledDates(toDateValue(date))] : []),
  ];

  const shared = {
    timeZone: "UTC",
    weekStartsOn: 1,
    // Never "dropdown": that renders native <select> elements for month and year.
    captionLayout: "label",
    numberOfMonths: months,
    autoFocus,
    disabled,
    startMonth: minDate ? startOfUtcMonth(minDate) : undefined,
    endMonth: maxDate ? startOfUtcMonth(maxDate) : undefined,
    className: cn(className),
    classNames: calendarClassNames,
    components: { Chevron: CalendarChevron },
    formatters: {
      formatCaption: (month: Date) => formatMonthLabel(toDateValue(month), locale),
      formatWeekdayName: (weekday: Date) => formatWeekdayLabel(toDateValue(weekday), locale),
      formatDay: (day: Date) => String(day.getUTCDate()),
    },
    labels: {
      labelPrevious: () => labels?.previousMonth ?? "Previous month",
      labelNext: () => labels?.nextMonth ?? "Next month",
      labelGrid: () => labels?.monthGrid ?? "Calendar",
      labelDayButton: (day: Date) => formatDateLabel(toDateValue(day), locale, { style: "full" }),
    },
  } as const;

  if (props.mode === "range") {
    const { value, onValueChange } = props;
    const from = value?.from ? parseDateValue(value.from) : undefined;
    const to = value?.to ? parseDateValue(value.to) : undefined;

    return (
      <DayPicker
        {...shared}
        mode="range"
        selected={from ? { from, to } : undefined}
        defaultMonth={from ?? minDate}
        onSelect={(range, triggerDate) => {
          /**
           * Restart rather than extend once a range is complete.
           *
           * react-day-picker's default stretches the nearer end to whatever was clicked, so
           * someone holding Jun 10-18 who wants Jun 22-26 clicks 22 and gets 10-22, clicks
           * 26 and gets 10-26 — they can never reach the range they wanted without finding
           * the clear button first. Treating the click as a new start is what people mean.
           */
          if (from && to && triggerDate) {
            onValueChange?.({ from: toDateValue(triggerDate), to: undefined });
            return;
          }

          onValueChange?.({
            from: range?.from ? toDateValue(range.from) : undefined,
            to: range?.to ? toDateValue(range.to) : undefined,
          });
        }}
      />
    );
  }

  const selected = props.value ? parseDateValue(props.value) : undefined;

  return (
    <DayPicker
      {...shared}
      mode="single"
      selected={selected}
      defaultMonth={selected ?? minDate}
      onSelect={(day) => props.onValueChange?.(day ? toDateValue(day) : undefined)}
    />
  );
}
