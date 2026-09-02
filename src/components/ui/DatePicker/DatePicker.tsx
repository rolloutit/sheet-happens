"use client";

import { CalendarDays } from "lucide-react";
import { useId, useState } from "react";

import { clampDateValue, todayDateValue } from "@/src/lib/date-values";
import { formatDateLabel } from "@/src/lib/formatting";
import { cn } from "@/src/lib/utils";
import { Button } from "../Button";
import { Calendar } from "../Calendar";
import { useFormReset } from "../Combobox";
import { Popover, PopoverContent, PopoverTrigger } from "../Popover";
import { controlTriggerClassName } from "../controlSurface";
import type { DatePickerProps } from "./DatePicker.types";

/**
 * A single calendar date, as a `YYYY-MM-DD` string.
 *
 * The value is a string rather than a `Date` on purpose. Every form, URL param and Zod
 * schema in this app already speaks that format, and a `Date`-shaped API invites the
 * local-midnight bug that `src/lib/formatting/dates.ts` exists to document — construct
 * `new Date("2026-06-24")` in Budapest, read it back with local accessors, and it is the
 * 23rd. Conversion happens once, inside `Calendar`.
 */
export function DatePicker({
  value,
  defaultValue,
  onValueChange,
  name,
  form,
  label,
  placeholder,
  locale,
  min,
  max,
  disabledDates,
  labels,
  disabled,
  required,
  invalid,
  clearable = true,
  modal = true,
  className,
  triggerClassName,
  contentClassName,
  id,
  "aria-describedby": ariaDescribedBy,
  ...props
}: DatePickerProps) {
  const generatedId = useId();
  const triggerId = id ?? `date-picker-${generatedId}`;
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");

  const currentValue = value ?? internalValue;

  useFormReset(trigger, () => setInternalValue(defaultValue ?? ""));

  function commit(next: string | undefined) {
    if (value === undefined) setInternalValue(next ?? "");
    onValueChange?.(next);
  }

  return (
    <div className={cn("relative", className)} {...props}>
      <Popover open={open} modal={modal} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={setTrigger}
            id={triggerId}
            type="button"
            aria-label={label}
            aria-describedby={ariaDescribedBy}
            // ARIA has no aria-invalid for a plain button; Field carries the message.
            data-invalid={invalid || undefined}
            disabled={disabled}
            className={cn(controlTriggerClassName, "justify-start gap-2", triggerClassName)}
          >
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className={cn("truncate", !currentValue && "text-muted-foreground")}>
              {currentValue ? formatDateLabel(currentValue, locale) : (placeholder ?? label)}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className={cn("w-auto p-3", contentClassName)}>
          <Calendar
            locale={locale}
            value={currentValue || undefined}
            min={min}
            max={max}
            disabledDates={disabledDates}
            labels={labels}
            autoFocus
            onValueChange={(next) => {
              commit(next);
              setOpen(false);
            }}
          />
          <div className="mt-3 flex justify-between gap-2 border-t border-border pt-3">
            {clearable && !required ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  commit(undefined);
                  setOpen(false);
                }}
              >
                {labels?.clear ?? "Clear"}
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="button"
              variant="soft"
              size="sm"
              onClick={() => {
                // Clamped so "Today" can never place a value outside the allowed window.
                commit(clampDateValue(todayDateValue(), min, max));
                setOpen(false);
              }}
            >
              {labels?.today ?? "Today"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {name ? <input type="hidden" name={name} form={form} value={currentValue} readOnly /> : null}
    </div>
  );
}
