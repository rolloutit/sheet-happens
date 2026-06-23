"use client";

import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useMemo, useState } from "react";

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

function sameDay(a?: Date, b?: Date) {
  return Boolean(
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate(),
  );
}

function formatDate(date?: Date) {
  if (!date) return "";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
    date,
  );
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
  disabledDate,
  clearable = true,
  className,
  ...props
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(startOfMonth(value ?? new Date()));
  const days = useMemo(() => getCalendarDays(month), [month]);
  const today = new Date();

  return (
    <div className={className} {...props}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="soft" className="w-full justify-start" aria-label={label}>
            <CalendarDays className="size-4" aria-hidden="true" />
            <span className={cn(!value && "text-muted-foreground")}>
              {value ? formatDate(value) : placeholder}
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
              {new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(month)}
            </div>
            <IconMonthButton
              label="Next month"
              onClick={() => setMonth((current) => addMonths(current, 1))}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </IconMonthButton>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekDays.map((day) => (
              <div
                key={day}
                className="py-1 font-ui text-[11px] font-semibold text-muted-foreground"
              >
                {day}
              </div>
            ))}
            {days.map((date) => {
              const disabled = disabledDate?.(date) ?? false;
              const selected = sameDay(date, value);
              const inMonth = date.getMonth() === month.getMonth();
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onValueChange?.(date);
                    setOpen(false);
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
