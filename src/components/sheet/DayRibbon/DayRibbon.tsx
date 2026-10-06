"use client";

import * as m from "motion/react-m";
import { useEffect, useRef } from "react";

import { dayLayoutId, RIBBON_THUMB_LAYOUT_ID, springThumb } from "@/src/lib/motion";
import { cn } from "@/src/lib/utils";
import { DayColumnHeader } from "../DayColumnHeader";
import type { DayRibbonProps } from "./DayRibbon.types";

/**
 * The week as seven chips: the Day scope's context for a single day and its navigator between
 * days, and on a phone the day picker at every scope (§5.4 of `docs/time-view-redesign.md`).
 *
 * This used to be persistent chrome above every level. It left the desktop Week scope because
 * there the seven column headers already say everything a chip says — weekday, day number, total,
 * capacity — so a strip above them said it all twice. Because it now mounts only where the
 * headers are not, its chips **can** carry `dayLayoutId`, and that is what makes the Week ⇄ Day
 * container transform possible: each header shrinks into its chip and grows back out.
 *
 * The selected chip is a travelling thumb rather than a lit chip, the same treatment as the scope
 * control, so stepping between days inside a week reads as the selection moving. Crossing a week
 * boundary is the caller's navigation and slides the whole ribbon as one block.
 */
export function DayRibbon({
  days,
  selectedDayIso,
  capacityMinutes,
  orientation = "horizontal",
  formatMinutes,
  labels,
  disabled = false,
  className,
  onSelectDay,
}: DayRibbonProps) {
  const chipRefs = useRef(new Map<string, HTMLElement>());

  /* On a phone the chips can overflow; the selected one snaps to centre so the day you are on is
     never the one scrolled out of view. `block: "nearest"` keeps the page itself from jumping. */
  useEffect(() => {
    const chip = chipRefs.current.get(selectedDayIso);
    const list = chip?.parentElement;

    if (!chip || !list || list.scrollWidth <= list.clientWidth) return;
    if (typeof chip.scrollIntoView !== "function") return;

    chip.scrollIntoView({ inline: "center", block: "nearest" });
  }, [selectedDayIso]);

  return (
    <div
      role="group"
      aria-label={labels.group}
      /* `min-w-0` and `max-w-full` are what make `overflow-x-auto` engage: a flex or grid child's
         default `min-width: auto` would otherwise refuse to shrink below the seven chips and grow
         the whole page sideways instead of scrolling the ribbon. */
      className={cn(
        "min-w-0 max-w-full",
        orientation === "horizontal"
          ? "flex snap-x snap-mandatory gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] lg:grid lg:grid-cols-7 lg:overflow-visible lg:pb-0"
          : "grid gap-1.5",
        className,
      )}
    >
      {days.map((day) => {
        const selected = day.isoDate === selectedDayIso;

        return (
          <div
            key={day.isoDate}
            ref={(node) => {
              if (node) chipRefs.current.set(day.isoDate, node);
              else chipRefs.current.delete(day.isoDate);
            }}
            className={cn(orientation === "horizontal" && "min-w-[4.25rem] flex-1 lg:min-w-0")}
          >
            <DayColumnHeader
              day={day}
              variant={orientation === "horizontal" ? "chip" : "row"}
              capacityMinutes={capacityMinutes}
              totalLabel={formatMinutes(day.totalMinutes)}
              label={labels.selectDay(day)}
              labels={{
                capacity: labels.capacity(day),
                over: labels.over,
                locked: labels.locked,
                today: labels.today,
              }}
              pressed={selected}
              layoutId={dayLayoutId(day.isoDate)}
              disabled={disabled}
              className="h-full"
              thumb={
                selected ? (
                  <m.span
                    layoutId={RIBBON_THUMB_LAYOUT_ID}
                    aria-hidden="true"
                    initial={false}
                    transition={springThumb}
                    className="absolute inset-0 -z-[1] rounded-[inherit] bg-accent-soft"
                  />
                ) : null
              }
              onPress={() => onSelectDay(day.isoDate)}
            />
          </div>
        );
      })}
    </div>
  );
}
