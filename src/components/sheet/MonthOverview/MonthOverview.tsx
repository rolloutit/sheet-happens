"use client";

import { CalendarRange, ChevronRight } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";

import { formatHoursWithUnit } from "@/src/lib/formatting";
import {
  entryCardMotion,
  entryEnterTransition,
  exitTransition,
  levelTransition,
  projectLayoutId,
} from "@/src/lib/motion";
import { cn } from "@/src/lib/utils";
import type { MonthOverviewProps } from "./MonthOverview.types";
import { monthOverviewRowVariants } from "./MonthOverview.variants";

/**
 * L4 of the `/time` resolution axis: one month, one row per project, no entries at all.
 *
 * The level a month is closed from. **Rows, not cards** — the job here is comparing figures down a
 * column and spotting the project with nothing against it, which cards make harder by pushing the
 * numbers apart. There is nothing finer to show than a per-project total, which is exactly why the
 * whole level fits in a payload that ships with the page (§11) and why a level change into it is a
 * layout animation rather than a fetch.
 *
 * Pressing a row is the L4 → L3 zoom: a pure level change onto the week the day strip is already
 * pointing at, not a filter on that project (§6). The row therefore reports which project was
 * pressed and lets the screen decide, the same way the day and week levels report intent.
 *
 * The month label, the month total and the previous/next month control are **not** here. They live
 * in the period row above the day strip, which is one element across all four levels — §7 item 3
 * wants a total that does not move or fade when the level changes, and the visible period buttons
 * have to mean the same thing as `[` and `]` do at that level. A second period control inside the
 * level could not honour either.
 *
 * The declared band, and the band headings a declared-only member drops, land with the declaration
 * write path.
 */
export function MonthOverview({
  projects,
  locale,
  durationDisplayFormat,
  labels,
  disabled = false,
  animateRows = false,
  className,
  onZoomToProject,
}: MonthOverviewProps) {
  return (
    <div className={cn("grid gap-4", className)}>
      <section className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
        <h2 className="border-b border-border bg-card/95 px-4 py-2.5 font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {labels.trackedHeading}
        </h2>

        {projects.length ? (
          <AnimatePresence initial={animateRows}>
            {projects.map((project, index) => (
              /* One participant per project, which is the whole of §7 item 6's `project-<id>` and
                 well inside §9's 30-participant budget: a member has a handful of assignments, not
                 seventy grid cells. `layout="position"` for the same reason the week columns use it
                 — a row is a wide box, and a size-animating parent would stretch the total inside
                 it for the length of the transition, which is the one thing a figure feeding a
                 timesheet must never appear to do. */
              <m.div
                key={project.projectId}
                layoutId={projectLayoutId(project.projectId)}
                layout="position"
                initial={entryCardMotion.initial}
                animate={entryCardMotion.animate}
                exit={{ ...entryCardMotion.exit, transition: exitTransition }}
                transition={{ ...entryEnterTransition(index), layout: levelTransition }}
              >
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={labels.zoomToProject(project)}
                  className={monthOverviewRowVariants({
                    state: project.minutes ? "logged" : "empty",
                  })}
                  onClick={() => onZoomToProject(project)}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: project.color }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {project.name}
                  </span>
                  {/* No tween on the way in or out: §9 keeps a figure that feeds a timesheet
                      revision exact, so the number swaps when the month does. */}
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatHoursWithUnit(project.minutes, locale, durationDisplayFormat)}
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </button>
              </m.div>
            ))}
          </AnimatePresence>
        ) : (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
              <CalendarRange className="size-6" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">{labels.emptyTitle}</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              {labels.emptyDescription}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
