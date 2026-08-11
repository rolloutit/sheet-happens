"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useId, useState } from "react";

import {
  compareDateValues,
  isMonthValue,
  monthValueToDateValue,
  todayDateValue,
} from "@/src/lib/date-values";
import { formatMonthLabel, formatMonthName } from "@/src/lib/formatting";
import { cn } from "@/src/lib/utils";
import { Button } from "../Button";
import { useFormReset } from "../Combobox";
import { Popover, PopoverContent, PopoverTrigger } from "../Popover";
import { controlTriggerClassName } from "../controlSurface";
import type { MonthPickerProps } from "./MonthPicker.types";

const monthsInYear = 12;

function monthValue(year: number, monthIndex: number) {
  return `${String(year).padStart(4, "0")}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function yearOf(value: string | undefined, fallback: number) {
  return value && isMonthValue(value) ? Number.parseInt(value.slice(0, 4), 10) : fallback;
}

/**
 * A calendar month, as a `YYYY-MM` string.
 *
 * Hand-rolled rather than built on `Calendar`: react-day-picker has no month-selection mode,
 * and its `captionLayout="dropdown"` month picker is a native `<select>` — the control this
 * change exists to remove.
 *
 * **The emitted value is `YYYY-MM`, never `YYYY-MM-01`.** `normalizeMonthInput` in
 * `src/server/timesheets/admin-review.ts` matches `/^\d{4}-\d{2}$/` and turns anything else
 * into an empty string, which drops the timesheet month filter with no error and no visible
 * signal — an admin would simply see every month at once.
 */
export function MonthPicker({
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
}: MonthPickerProps) {
  const generatedId = useId();
  const triggerId = id ?? `month-picker-${generatedId}`;
  const currentMonth = todayDateValue().slice(0, 7);
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");

  const currentValue = value ?? internalValue;
  const [year, setYear] = useState(() =>
    yearOf(currentValue || undefined, Number.parseInt(currentMonth.slice(0, 4), 10)),
  );

  useFormReset(trigger, () => setInternalValue(defaultValue ?? ""));

  function commit(next: string | undefined) {
    if (value === undefined) setInternalValue(next ?? "");
    onValueChange?.(next);
  }

  function isOutOfBounds(month: string) {
    if (min && compareDateValues(month, min) < 0) return true;
    if (max && compareDateValues(month, max) > 0) return true;
    return false;
  }

  return (
    <div className={cn("relative", className)} {...props}>
      <Popover
        open={open}
        modal={modal}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          // Reopen on the chosen year rather than wherever the user last browsed.
          if (nextOpen) {
            setYear(
              yearOf(currentValue || undefined, Number.parseInt(currentMonth.slice(0, 4), 10)),
            );
          }
        }}
      >
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
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className={cn("truncate", !currentValue && "text-muted-foreground")}>
              {currentValue
                ? formatMonthLabel(monthValueToDateValue(currentValue), locale)
                : (placeholder ?? label)}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className={cn("w-72 p-3", contentClassName)}>
          <div className="mb-3 flex items-center justify-between">
            <YearStepButton
              label={labels?.previousYear ?? "Previous year"}
              onClick={() => setYear((current) => current - 1)}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </YearStepButton>
            <span aria-live="polite" className="font-ui text-sm font-semibold text-foreground">
              {year}
            </span>
            <YearStepButton
              label={labels?.nextYear ?? "Next year"}
              onClick={() => setYear((current) => current + 1)}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </YearStepButton>
          </div>

          <div
            role="grid"
            aria-label={labels?.monthGrid ?? "Select month"}
            className="grid grid-cols-3 gap-1"
          >
            {Array.from({ length: monthsInYear }, (_, index) => {
              const month = monthValue(year, index);
              const isSelected = month === currentValue;
              const outOfBounds = isOutOfBounds(month);

              return (
                <button
                  key={month}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-current={month === currentMonth ? "date" : undefined}
                  disabled={outOfBounds}
                  onClick={() => {
                    commit(month);
                    setOpen(false);
                  }}
                  className={cn(
                    "rounded-[var(--radius-md)] px-2 py-2 font-ui text-sm capitalize transition hover:bg-secondary disabled:pointer-events-none disabled:opacity-30",
                    month === currentMonth && "border border-primary/35 text-accent",
                    isSelected && "bg-primary text-primary-foreground hover:bg-primary",
                  )}
                >
                  {formatMonthName(monthValueToDateValue(month), locale)}
                </button>
              );
            })}
          </div>

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
              disabled={isOutOfBounds(currentMonth)}
              onClick={() => {
                commit(currentMonth);
                setOpen(false);
              }}
            >
              {labels?.thisMonth ?? "This month"}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {name ? <input type="hidden" name={name} form={form} value={currentValue} readOnly /> : null}
    </div>
  );
}

function YearStepButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex size-8 items-center justify-center rounded-[var(--radius-pill)] text-muted-foreground transition hover:bg-secondary hover:text-foreground"
    >
      {children}
    </button>
  );
}
