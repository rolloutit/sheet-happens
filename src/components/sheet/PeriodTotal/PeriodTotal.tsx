"use client";

import { AlertTriangle, Check } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { useState } from "react";

import { settleVariants } from "@/src/lib/motion";
import { cn } from "@/src/lib/utils";
import type { PeriodTotalProps } from "./PeriodTotal.types";

/**
 * One number, one unit label, right-aligned in the period row (§5.5 of
 * `docs/time-view-redesign.md`): `36 h this week`, `8.5 h today`, `112 h this month`.
 *
 * The figure **settles**, it does not roll (§7.6). A figure that feeds a timesheet revision never
 * counts up — a rolling odometer reads as approximate — but a figure that changes with no motion
 * at all reads as a glitch. So the old value leaves upward, the new one enters from below if it went
 * up and from above if it went down, 180ms, digits always exact.
 *
 * Status is icon + words, and only then colour: `⚠ over 8 h` in amber, `✓ on target` in success.
 * The token rules forbid colour carrying a status alone, and this is where the old orange
 * `DAY TOTAL 8.5 h` broke them.
 */
export function PeriodTotal({
  figure,
  unit,
  caption,
  minutes,
  status = null,
  secondary = null,
  size = "lg",
  align = "end",
  className,
}: PeriodTotalProps) {
  /* Which way the figure moved, kept as state adjusted during render — React's recipe for a
     value derived from the previous prop — so the direction is known in the same render the new
     figure arrives in and nothing is read from a ref while rendering. */
  const [settled, setSettled] = useState<{ minutes: number; direction: 1 | -1 | 0 }>({
    minutes,
    direction: 0,
  });
  if (settled.minutes !== minutes) {
    setSettled({ minutes, direction: minutes > settled.minutes ? 1 : -1 });
  }
  const direction =
    settled.minutes === minutes ? settled.direction : minutes > settled.minutes ? 1 : -1;

  const StatusIcon = status?.tone === "warning" ? AlertTriangle : Check;

  return (
    <div
      className={cn(
        "flex flex-col gap-0.5",
        align === "end" ? "items-end text-right" : "items-start text-left",
        className,
      )}
    >
      <div className="relative flex items-baseline gap-1.5">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <m.span
            key={figure}
            custom={direction}
            variants={settleVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className={cn(
              "inline-block font-ui font-semibold tabular-nums text-foreground",
              size === "lg" ? "text-[26px] leading-none" : "text-lg leading-none",
            )}
          >
            {figure}
          </m.span>
        </AnimatePresence>
        {unit ? (
          <span
            className={cn(
              "font-ui font-semibold text-muted-foreground",
              size === "lg" ? "text-base" : "text-sm",
            )}
          >
            {unit}
          </span>
        ) : null}
        <span className="ml-1 font-ui text-xs font-medium text-muted-foreground">{caption}</span>
      </div>

      {status || secondary ? (
        <div className="relative flex items-center gap-2 font-ui text-xs">
          <AnimatePresence mode="popLayout" initial={false}>
            {status ? (
              <m.span
                key={`${status.tone}:${status.label}`}
                variants={settleVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className={cn(
                  "inline-flex items-center gap-1 font-semibold",
                  status.tone === "warning" && "text-warning",
                  status.tone === "success" && "text-success",
                  status.tone === "muted" && "text-muted-foreground",
                )}
              >
                <StatusIcon className="size-3.5" aria-hidden="true" />
                {status.label}
              </m.span>
            ) : null}
          </AnimatePresence>
          {secondary ? <span className="text-muted-foreground">{secondary}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
