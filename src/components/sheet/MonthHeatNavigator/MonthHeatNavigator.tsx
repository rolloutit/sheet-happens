"use client";

import { ChevronRight, Lock } from "lucide-react";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useRef, type KeyboardEvent } from "react";

import { dayLayoutId, levelTransition, rowEnterTransition } from "@/src/lib/motion";
import { cn } from "@/src/lib/utils";
import { heatStep } from "./MonthHeatNavigator.model";
import type { HeatDay, MonthHeatNavigatorProps } from "./MonthHeatNavigator.types";
import { heatCellVariants } from "./MonthHeatNavigator.variants";

/**
 * A month of days, intensity by hours logged (§4.4 of `docs/time-view-redesign.md`).
 *
 * This is the one screen where "which days did I forget before I submit?" is answered at a glance,
 * which used to need a week-by-week scroll. It is also "the week you will return to": the selected
 * week's row is tinted, so zooming back in from the month is deterministic rather than a jump.
 *
 * Every cell is a button and the Month → Day zoom: click a day and it opens. Click a week number
 * and the week opens. The cells carry `dayLayoutId`, so the 28px cell grows into the ribbon chip
 * while the page scales in (§7.2) — the navigator and the ribbon are never mounted together.
 *
 * Grid semantics: `grid` → `row` → `rowheader` / `gridcell`, with the arrow keys moving focus
 * between cells. The arrows are otherwise unclaimed on `/time` precisely so that grids can have
 * them.
 */
export function MonthHeatNavigator({
  weeks,
  weekdayLabels,
  selectedWeekStart,
  selectedDayIso,
  capacityMinutes,
  locked = false,
  formatMinutes,
  labels,
  animate = false,
  disabled = false,
  className,
  onSelectDay,
  onSelectWeek,
}: MonthHeatNavigatorProps) {
  const reducedMotion = useReducedMotion();
  const gridRef = useRef<HTMLDivElement>(null);
  const stagger = animate && !reducedMotion;

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.getAttribute("role") !== "gridcell") return;

    const delta =
      event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowLeft"
          ? -1
          : event.key === "ArrowDown"
            ? 7
            : event.key === "ArrowUp"
              ? -7
              : 0;
    if (!delta) return;

    const cells = Array.from(
      gridRef.current?.querySelectorAll<HTMLElement>('[role="gridcell"]:not([disabled])') ?? [],
    );
    const index = cells.indexOf(target);
    const next = cells[index + delta];

    if (!next) return;

    event.preventDefault();
    next.focus();
  }

  return (
    <div className={cn("grid gap-3", className)}>
      <div
        ref={gridRef}
        role="grid"
        aria-label={labels.grid}
        aria-readonly="true"
        className="grid gap-y-1"
        onKeyDown={moveFocus}
      >
        <div
          role="row"
          className="grid grid-cols-[3.25rem_repeat(7,1.75rem)_1fr] items-center gap-x-1.5"
        >
          <span role="columnheader" aria-hidden="true" />
          {weekdayLabels.map((label, index) => (
            <span
              key={`${label}-${index}`}
              role="columnheader"
              className="text-center font-ui text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
            >
              {label}
            </span>
          ))}
          <span role="columnheader" aria-hidden="true" />
        </div>

        {weeks.map((week, rowIndex) => {
          const selected = week.weekStart === selectedWeekStart;

          return (
            <m.div
              key={week.weekStart}
              role="row"
              initial={stagger ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={rowEnterTransition(rowIndex)}
              className={cn(
                "grid grid-cols-[3.25rem_repeat(7,1.75rem)_1fr] items-center gap-x-1.5 rounded-[var(--radius-sm)] py-0.5",
                selected && "bg-secondary",
              )}
            >
              <div role="rowheader" className="pl-1">
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={labels.openWeek(week)}
                  className="group/week inline-flex items-center gap-0.5 rounded-[var(--radius-xs)] px-1 font-ui text-[11px] font-semibold text-muted-foreground transition-colors duration-[var(--duration-micro)] hover:bg-card hover:text-foreground disabled:cursor-default disabled:opacity-50"
                  onClick={() => onSelectWeek(week.weekStart)}
                >
                  {labels.weekRow(week)}
                  <ChevronRight
                    aria-hidden="true"
                    className="size-3 opacity-0 transition-opacity duration-[var(--duration-micro)] group-hover/week:opacity-100 group-focus-visible/week:opacity-100"
                  />
                </button>
              </div>

              {week.days.map((day) => (
                <HeatCell
                  key={day.isoDate}
                  day={day}
                  capacityMinutes={capacityMinutes}
                  selected={day.isoDate === selectedDayIso}
                  disabled={disabled || !day.inMonth}
                  labels={labels}
                  onSelect={onSelectDay}
                />
              ))}

              <span className="pr-1 text-right font-ui text-xs font-semibold tabular-nums text-muted-foreground">
                {week.totalMinutes ? formatMinutes(week.totalMinutes) : "—"}
              </span>
            </m.div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-ui text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="flex gap-0.5">
            {[1, 2, 3, 4].map((step) => (
              <span
                key={step}
                className={cn(
                  heatCellVariants({ step: step as 1 | 2 | 3 | 4 }),
                  "size-3 rounded-[3px]",
                )}
              />
            ))}
          </span>
          {labels.legendLogged}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-3 rounded-[3px] border border-border" />
          {labels.legendEmpty}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-3 rounded-[3px] border border-dashed border-border"
          />
          {labels.legendFuture}
        </span>
        {locked ? (
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-3" aria-hidden="true" />
            {labels.locked}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function HeatCell({
  day,
  capacityMinutes,
  selected,
  disabled,
  labels,
  onSelect,
}: {
  day: HeatDay;
  capacityMinutes: number;
  selected: boolean;
  disabled: boolean;
  labels: MonthHeatNavigatorProps["labels"];
  onSelect: (isoDate: string) => void;
}) {
  const step = heatStep(day.minutes, capacityMinutes);
  const name =
    day.minutes > 0
      ? labels.cell(day)
      : day.state === "future"
        ? labels.future(day)
        : labels.empty(day);

  if (!day.inMonth) {
    /* Outside the month: an inert placeholder so the rows stay seven wide. Not a button, because a
       cell you cannot press should not be in the tab order — but still named, so a screen reader
       walking the row hears which day the gap is rather than a silent cell. */
    return <span role="gridcell" aria-label={labels.outside(day)} className="size-7" />;
  }

  return (
    <m.button
      type="button"
      role="gridcell"
      layoutId={dayLayoutId(day.isoDate)}
      layout="position"
      transition={levelTransition}
      whileTap={disabled ? undefined : { scale: 0.94 }}
      aria-label={name}
      aria-selected={selected || undefined}
      aria-current={day.state === "today" ? "date" : undefined}
      title={day.minutes > 0 ? labels.detail(day) : undefined}
      disabled={disabled}
      className={heatCellVariants({
        step,
        state: day.state,
        workday: day.workday,
        selected,
      })}
      onClick={() => onSelect(day.isoDate)}
    >
      {day.dayNumber}
    </m.button>
  );
}
