"use client";

import { CalendarRange } from "lucide-react";
import { useId, useState } from "react";

import { formatDateLabel, formatPeriodRange } from "@/src/lib/formatting";
import { cn } from "@/src/lib/utils";
import { Button } from "../Button";
import { Calendar } from "../Calendar";
import { useFormReset } from "../Combobox";
import { Popover, PopoverContent, PopoverTrigger } from "../Popover";
import { controlTriggerClassName } from "../controlSurface";
import type { DateRangePickerProps, DateRangeValue } from "./DateRangePicker.types";

const emptyRange: DateRangeValue = {};

/**
 * A start/end date pair, submitted as two hidden inputs.
 *
 * Replaces the two adjacent `<input type="date">` fields the app uses for every period:
 * rate validity, project timelines, assignment windows, audit and report filters. Keeping
 * the two `name`s configurable is what lets those call sites migrate without touching a
 * single Zod schema.
 *
 * The panel stays open after the first click so the second date can be picked in the same
 * gesture, which is why it does not close itself the way `DatePicker` does.
 */
export function DateRangePicker({
  value,
  defaultValue,
  onValueChange,
  names,
  form,
  label,
  placeholder,
  locale,
  min,
  max,
  disabledDates,
  numberOfMonths = 2,
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
}: DateRangePickerProps) {
  const generatedId = useId();
  const triggerId = id ?? `date-range-picker-${generatedId}`;
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState<DateRangeValue>(defaultValue ?? emptyRange);

  const currentValue = value ?? internalValue;

  useFormReset(trigger, () => setInternalValue(defaultValue ?? emptyRange));

  function commit(next: DateRangeValue) {
    if (value === undefined) setInternalValue(next);
    onValueChange?.(next);
  }

  const triggerLabel = currentValue.from
    ? currentValue.to
      ? formatPeriodRange(currentValue.from, currentValue.to, locale)
      : `${formatDateLabel(currentValue.from, locale)} - ${labels?.to ?? "End date"}`
    : (placeholder ?? label);

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
            data-invalid={invalid || undefined}
            disabled={disabled}
            className={cn(controlTriggerClassName, "justify-start gap-2", triggerClassName)}
          >
            <CalendarRange className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className={cn("truncate", !currentValue.from && "text-muted-foreground")}>
              {triggerLabel}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className={cn("w-auto p-3", contentClassName)}>
          <Calendar
            mode="range"
            locale={locale}
            value={currentValue}
            min={min}
            max={max}
            disabledDates={disabledDates}
            numberOfMonths={numberOfMonths}
            labels={labels}
            autoFocus
            onValueChange={commit}
          />
          <div className="mt-3 flex justify-between gap-2 border-t border-border pt-3">
            {clearable && !required ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => commit(emptyRange)}>
                {labels?.clear ?? "Clear"}
              </Button>
            ) : (
              <span />
            )}
            <Button type="button" variant="soft" size="sm" onClick={() => setOpen(false)}>
              {labels?.done ?? "Done"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {names ? (
        <>
          <input
            type="hidden"
            name={names.from}
            form={form}
            value={currentValue.from ?? ""}
            readOnly
          />
          <input type="hidden" name={names.to} form={form} value={currentValue.to ?? ""} readOnly />
        </>
      ) : null}
    </div>
  );
}
