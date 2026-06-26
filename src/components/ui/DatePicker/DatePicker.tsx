"use client";

import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "@/src/lib/utils";
import { Button } from "../Button";
import { Popover, PopoverContent, PopoverTrigger } from "../Popover";
import type { DatePickerProps } from "./DatePicker.types";

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function addMonthsPreservingDay(date: Date, amount: number) {
  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth() + amount;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  return new Date(targetYear, targetMonth, Math.min(date.getDate(), lastDay));
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + amount);
  return next;
}

function startOfWeek(date: Date) {
  const mondayOffset = (date.getDay() + 6) % 7;
  return addDays(date, -mondayOffset);
}

function endOfWeek(date: Date) {
  return addDays(startOfWeek(date), 6);
}

function sameDay(a?: Date, b?: Date) {
  return Boolean(
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate(),
  );
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date: Date | undefined, locale: string) {
  if (!date) return "";
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getCalendarDays(month: Date) {
  const first = startOfMonth(month);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function DatePicker({
  value,
  onValueChange,
  label,
  placeholder = "Select date",
  locale = "en",
  disabled,
  disabledDate,
  clearable = true,
  className,
  id,
  "aria-describedby": ariaDescribedBy,
  ...props
}: DatePickerProps) {
  const generatedId = useId();
  const triggerId = id ?? `date-picker-${generatedId}-trigger`;
  const gridId = `date-picker-${generatedId}-grid`;
  const dayRefs = useRef(new Map<string, HTMLButtonElement>());
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(startOfMonth(value ?? new Date()));
  const [pendingFocusKey, setPendingFocusKey] = useState<string>();
  const days = useMemo(() => getCalendarDays(month), [month]);
  const today = new Date();

  useEffect(() => {
    if (!pendingFocusKey) return;
    const frame = window.requestAnimationFrame(() => {
      const target = dayRefs.current.get(pendingFocusKey);
      target?.focus();
      if (target) setPendingFocusKey(undefined);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [days, pendingFocusKey]);

  function isDateDisabled(date: Date) {
    return disabledDate?.(date) ?? false;
  }

  function findFocusableDate(date: Date, direction: 1 | -1) {
    if (!isDateDisabled(date)) return date;

    let next = date;
    for (let attempt = 0; attempt < 366; attempt += 1) {
      next = addDays(next, direction);
      if (!isDateDisabled(next)) return next;
    }

    return date;
  }

  function focusDate(date: Date, direction: 1 | -1 = 1) {
    const next = findFocusableDate(date, direction);
    setMonth(startOfMonth(next));
    setPendingFocusKey(toDateKey(next));
  }

  function moveFocus(date: Date, amount: number) {
    focusDate(addDays(date, amount), amount < 0 ? -1 : 1);
  }

  function selectDate(date: Date) {
    if (isDateDisabled(date)) return;
    onValueChange?.(date);
    setOpen(false);
  }

  return (
    <div className={className} {...props}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={triggerId}
            type="button"
            variant="soft"
            className="w-full justify-start"
            aria-label={label}
            aria-describedby={ariaDescribedBy}
            aria-expanded={open}
            aria-controls={gridId}
            disabled={disabled}
          >
            <CalendarDays className="size-4" aria-hidden="true" />
            <span className={cn(!value && "text-muted-foreground")}>
              {value ? formatDate(value, locale) : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80">
          <div className="mb-4 flex items-center justify-between">
            <IconMonthButton
              label="Previous month"
              onClick={() => setMonth((current) => addMonths(current, -1))}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </IconMonthButton>
            <div className="font-ui text-sm font-semibold">
              {new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(month)}
            </div>
            <IconMonthButton
              label="Next month"
              onClick={() => setMonth((current) => addMonths(current, 1))}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </IconMonthButton>
          </div>
          <div
            id={gridId}
            role="grid"
            aria-label={label}
            className="grid grid-cols-7 gap-1 text-center"
          >
            {weekDays.map((day) => (
              <div
                key={day}
                role="columnheader"
                className="py-1 font-ui text-[11px] font-semibold text-muted-foreground"
              >
                {day}
              </div>
            ))}
            {days.map((date) => {
              const disabled = isDateDisabled(date);
              const selected = sameDay(date, value);
              const inMonth = date.getMonth() === month.getMonth();
              return (
                <button
                  key={date.toISOString()}
                  ref={(node) => {
                    if (node) dayRefs.current.set(toDateKey(date), node);
                    else dayRefs.current.delete(toDateKey(date));
                  }}
                  type="button"
                  role="gridcell"
                  aria-label={new Intl.DateTimeFormat(locale, {
                    dateStyle: "full",
                  }).format(date)}
                  aria-selected={selected}
                  aria-current={sameDay(date, today) ? "date" : undefined}
                  disabled={disabled}
                  onClick={() => {
                    selectDate(date);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowRight") {
                      event.preventDefault();
                      moveFocus(date, 1);
                    }
                    if (event.key === "ArrowLeft") {
                      event.preventDefault();
                      moveFocus(date, -1);
                    }
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      moveFocus(date, 7);
                    }
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      moveFocus(date, -7);
                    }
                    if (event.key === "Home") {
                      event.preventDefault();
                      focusDate(startOfWeek(date), 1);
                    }
                    if (event.key === "End") {
                      event.preventDefault();
                      focusDate(endOfWeek(date), -1);
                    }
                    if (event.key === "PageDown") {
                      event.preventDefault();
                      focusDate(addMonthsPreservingDay(date, event.shiftKey ? 12 : 1), 1);
                    }
                    if (event.key === "PageUp") {
                      event.preventDefault();
                      focusDate(addMonthsPreservingDay(date, event.shiftKey ? -12 : -1), -1);
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setOpen(false);
                      window.requestAnimationFrame(() =>
                        document.getElementById(triggerId)?.focus(),
                      );
                    }
                  }}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-[var(--radius-md)] font-ui text-sm transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30",
                    !inMonth && "text-muted-foreground/50",
                    sameDay(date, today) && "border border-primary/35 text-accent",
                    selected && "bg-primary text-primary-foreground hover:bg-primary",
                  )}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex justify-between gap-2">
            {clearable ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onValueChange?.(undefined)}
              >
                Clear
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="button"
              variant="soft"
              size="sm"
              onClick={() => {
                onValueChange?.(today);
                setMonth(startOfMonth(today));
                setOpen(false);
              }}
            >
              Today
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function IconMonthButton({
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
      className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
    >
      {children}
    </button>
  );
}
