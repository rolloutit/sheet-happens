"use client";

import { AlertTriangle, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";

import { formatHoursWithUnit, type DurationDisplayFormat } from "@/src/lib/formatting";
import {
  dayLayoutId,
  entryCardMotion,
  entryEnterTransition,
  entryLayoutId,
  exitTransition,
  levelTransition,
} from "@/src/lib/motion";
import { cn } from "@/src/lib/utils";
import type { WeekAgendaEntry, WeekAgendaProps } from "./WeekAgenda.types";
import { weekAgendaColumnVariants, weekAgendaHeaderVariants } from "./WeekAgenda.variants";

/**
 * L2 of the `/time` resolution axis: seven days at once, one compact card per entry.
 *
 * The level that answers "what did I do this week?", which neither the day list nor the grid can —
 * the day is too narrow and the grid has already aggregated the descriptions away.
 *
 * One tree serves both shapes, because the entry cards are the expensive part and rendering them
 * twice to switch layouts is what makes a dense week feel slow. What differs is the header and what
 * the panel does when its day is not the selected one:
 *
 * - Desktop is seven columns. Every panel is open, the headers stick to the top of the page as it
 *   scrolls, and a header click zooms into that day.
 * - Mobile is an accordion. Only the selected day's panel is open, a header click on a collapsed
 *   day opens it, and a second click on the open one zooms in. Seven columns on a phone would be
 *   seven unreadable slivers; focus-plus-context is the honest degradation.
 *
 * The columns are not independently scrollable on purpose: comparing Tuesday against Thursday is
 * the point of the level, and it stops working the moment each column holds its own scroll offset.
 */
export function WeekAgenda({
  days,
  selectedDayIso,
  locale,
  durationDisplayFormat,
  labels,
  disabled = false,
  animateEntries = false,
  className,
  onSelectDay,
  onZoomToDay,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
}: WeekAgendaProps) {
  return (
    // Columns stretch to the tallest of the week so the add affordances line up along one edge and
    // the seven read as one surface rather than seven cards of arbitrary height.
    <div className={cn("grid gap-2 lg:grid-cols-7", className)}>
      {days.map((day) => {
        const expanded = day.isoDate === selectedDayIso;
        const total = formatHoursWithUnit(day.totalMinutes, locale, durationDisplayFormat);

        return (
          /* `layout="position"`, not plain `layout`: a column becoming a grid column header is a
             large size change, and a size-animating parent scales everything inside it — the day
             number, the total, the card text — for the length of the transition. Position-only
             snaps the box and animates where it sits, which is what carries the meaning anyway and
             is also what keeps §9's "numbers never tween" true of a figure that happens to sit in a
             box that is moving. One participant per day, seven per transition. */
          <m.section
            key={day.isoDate}
            layout="position"
            layoutId={dayLayoutId(day.isoDate)}
            transition={levelTransition}
            aria-label={day.label}
            className={weekAgendaColumnVariants({ state: day.state, selected: expanded })}
          >
            <h2 className="hidden lg:sticky lg:top-0 lg:z-10 lg:block">
              <button
                type="button"
                aria-label={labels.openDay(day)}
                className={weekAgendaHeaderVariants({ state: day.state })}
                onClick={() => onZoomToDay(day.isoDate)}
              >
                <span className="min-w-0">
                  <span className="block font-ui text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    {day.shortLabel}
                  </span>
                  <span className="block text-base font-semibold">{day.dayNumber}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                  {total}
                </span>
              </button>
            </h2>

            <h2 className="lg:hidden">
              <button
                type="button"
                aria-expanded={expanded}
                aria-label={expanded ? labels.openDay(day) : labels.expandDay(day)}
                className={weekAgendaHeaderVariants({ state: day.state })}
                onClick={() => (expanded ? onZoomToDay(day.isoDate) : onSelectDay(day.isoDate))}
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    {day.shortLabel}
                  </span>
                  <span className="text-base font-semibold">{day.dayNumber}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-muted-foreground">
                  {total}
                </span>
              </button>
            </h2>

            <div className={cn("flex flex-1 flex-col gap-2 p-2", !expanded && "hidden lg:flex")}>
              {day.entries.length ? (
                <ul className="grid gap-2">
                  <AnimatePresence initial={animateEntries}>
                    {day.entries.map((entry, index) => (
                      <m.li
                        key={entry.id}
                        /* Only the selected day's entries take a shared id. They are the ones that
                           also exist at L1, so they are the only ones with anything to morph into;
                           a card in another column would pay for a measure pass and buy nothing. */
                        layoutId={expanded ? entryLayoutId(entry.id) : undefined}
                        layout="position"
                        initial={entryCardMotion.initial}
                        animate={entryCardMotion.animate}
                        exit={{ ...entryCardMotion.exit, transition: exitTransition }}
                        transition={{ ...entryEnterTransition(index), layout: levelTransition }}
                        /* `min-w-0`, or a column is as wide as its widest card wants to be. A grid
                           item's automatic minimum is its min-content width, so the list's single
                           `auto` track grows past the column instead of clamping to it — and since
                           the columns are `minmax(0, 1fr)` tracks that cannot grow, the cards
                           simply hang out over the next day. Seven columns of that is the level
                           looking like it has come apart. */
                        className="min-w-0"
                      >
                        <EntryCard
                          entry={entry}
                          locale={locale}
                          durationDisplayFormat={durationDisplayFormat}
                          labels={labels}
                          disabled={disabled}
                          onEditEntry={onEditEntry}
                          onDeleteEntry={onDeleteEntry}
                        />
                      </m.li>
                    ))}
                  </AnimatePresence>
                </ul>
              ) : (
                <p className="px-1 py-3 text-center text-xs text-muted-foreground">
                  {labels.columnEmpty}
                </p>
              )}

              <button
                type="button"
                disabled={disabled || day.locked}
                aria-label={labels.addEntry(day)}
                className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-dashed border-accent/45 px-2 py-2 text-xs font-semibold text-accent transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => onAddEntry(day.isoDate)}
              >
                <Plus className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </m.section>
        );
      })}
    </div>
  );
}

function EntryCard({
  entry,
  locale,
  durationDisplayFormat,
  labels,
  disabled,
  onEditEntry,
  onDeleteEntry,
}: {
  entry: WeekAgendaEntry;
  locale: string;
  durationDisplayFormat: DurationDisplayFormat;
  labels: WeekAgendaProps["labels"];
  disabled: boolean;
  onEditEntry: (entry: WeekAgendaEntry) => void;
  onDeleteEntry: (entry: WeekAgendaEntry) => void;
}) {
  const warningText = entry.warnings.join(" ");

  return (
    <div
      className={cn(
        "grid gap-1 rounded-[var(--radius-md)] border border-border bg-background p-2",
        entry.warnings.length && "border-warning/40 bg-warning-soft",
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: entry.projectColor }}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate font-ui text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
          {entry.projectName}
        </span>
        {entry.adminModified ? (
          <ShieldCheck
            role="img"
            aria-label={labels.adminModified}
            className="size-3.5 shrink-0 text-accent"
          />
        ) : null}
        {entry.warnings.length ? (
          <AlertTriangle
            role="img"
            aria-label={warningText}
            className="size-3.5 shrink-0 text-warning"
          />
        ) : null}
      </div>

      {/* `min-w-0 break-words`: a single long token in a description is a min-content width the
          card would otherwise have to honour, and a column has none to spare. */}
      <p
        className="line-clamp-2 min-w-0 break-words text-xs leading-snug text-foreground"
        title={entry.description}
      >
        {entry.description}
      </p>

      {/* The figure, the times and the two 28px actions do not share one line in a column this
          narrow — seven of them across a laptop leaves ~120px here — so the time range is the part
          that gives way and wraps under the duration. It is the only one of the three that can:
          the figure is what the level is read for, and the actions are click targets whose position
          must not depend on how wide the week happens to be. Wide columns still fit all three on
          one line, which is why this is a wrap and not a second row. */}
      <div className="flex min-w-0 items-center gap-1">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-1 text-xs font-semibold text-foreground">
          <span className="shrink-0">
            {formatHoursWithUnit(entry.durationMinutes, locale, durationDisplayFormat)}
          </span>
          {entry.startTime && entry.endTime ? (
            <span className="min-w-0 truncate font-normal text-muted-foreground">
              {entry.startTime}–{entry.endTime}
            </span>
          ) : null}
        </span>
        <span className="ml-auto flex shrink-0 items-center">
          <button
            type="button"
            disabled={entry.locked || disabled}
            className="grid size-7 place-items-center rounded-[var(--radius-sm)] text-muted-foreground transition hover:bg-secondary hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={labels.editEntry(entry)}
            onClick={() => onEditEntry(entry)}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={entry.locked || disabled}
            className="grid size-7 place-items-center rounded-[var(--radius-sm)] text-muted-foreground transition hover:bg-destructive-soft hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={labels.deleteEntry(entry)}
            onClick={() => onDeleteEntry(entry)}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        </span>
      </div>
    </div>
  );
}
