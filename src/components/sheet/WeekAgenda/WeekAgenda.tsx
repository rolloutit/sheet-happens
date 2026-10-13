"use client";

import { CalendarRange, Copy, Plus } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";

import { formatHoursWithUnit } from "@/src/lib/formatting";
import {
  dayLayoutId,
  entryCardMotion,
  entryEnterTransition,
  entryLayoutId,
  exitTransition,
  levelTransition,
} from "@/src/lib/motion";
import { cn } from "@/src/lib/utils";
import { Button } from "../../ui/Button";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/Popover";
import { DayColumnHeader } from "../DayColumnHeader";
import { EntryCard, RunningEntryCard } from "../EntryCard";
import type { WeekAgendaDay, WeekAgendaProps } from "./WeekAgenda.types";
import { weekAgendaColumnVariants } from "./WeekAgenda.variants";

/**
 * The Week scope's Agenda lens: seven days at once, one compact card per entry — the hub of
 * `/time` (§4.1 of `docs/time-view-redesign.md`).
 *
 * The seven column headers **are** the day chips: weekday, day number, total, capacity bar. The
 * strip that used to sit above them said all of it a second time, so it left the desktop Week
 * scope; the headers carry its `dayLayoutId` instead, and pressing one opens the day. Each header
 * is a `DayColumnHeader`, the same component the Grid lens heads its columns with, so a re-lens
 * leaves the headers exactly where they are and only the bodies change underneath.
 *
 * One tree serves both shapes, because the entry cards are the expensive part and rendering them
 * twice to switch layouts is what makes a dense week feel slow. `layout` decides which header a day
 * gets and whether its body is always open:
 *
 * - `columns` is the desktop. Every panel is open, the headers stick to the top of the page as it
 *   scrolls, and a header press zooms into that day.
 * - `accordion` is the phone. Only the selected day's panel is open, a header press on a collapsed
 *   day opens it, and the expanded header carries "open day" as its own action.
 *
 * Actions live where they are needed (§5.7): an empty column offers "Copy yesterday" when yesterday
 * has anything, an empty week offers "Add entry" and "Duplicate last week" once, in the middle, and
 * the `+` at the foot of a column opens the quick composer anchored to it rather than the modal.
 */
export function WeekAgenda({
  days,
  selectedDayIso,
  capacityMinutes,
  layout,
  locale,
  durationDisplayFormat,
  labels,
  disabled = false,
  animateEntries = false,
  runningTimer = null,
  highlight = null,
  canContinue = true,
  canDuplicatePreviousWeek = false,
  composerDayIso = null,
  renderComposer,
  footnote,
  className,
  onSelectDay,
  onOpenDay,
  onAddEntry,
  onComposerOpenChange,
  onEditEntry,
  onDeleteEntry,
  onContinueEntry,
  onCopyPreviousDay,
  onDuplicatePreviousWeek,
  onStopTimer,
}: WeekAgendaProps) {
  const columns = layout === "columns";
  const weekEmpty = days.every((day) => day.entries.length === 0) && !runningTimer;
  /* The working week gets the room: when both weekend days are empty they narrow, so five columns
     share what seven would otherwise split evenly. */
  const weekendEmpty = days
    .slice(5)
    .every((day) => day.entries.length === 0 && !(runningTimer && day.state === "today"));
  const format = (minutes: number) => formatHoursWithUnit(minutes, locale, durationDisplayFormat);

  return (
    <div className={cn("grid gap-3", className)}>
      <div
        className={cn(
          "grid gap-2",
          columns &&
            (weekendEmpty
              ? "lg:grid-cols-[repeat(5,minmax(0,1fr))_repeat(2,minmax(7.5rem,0.6fr))]"
              : "lg:grid-cols-7"),
        )}
      >
        {days.map((day) => {
          const expanded = columns || day.isoDate === selectedDayIso;
          const showTimer = Boolean(runningTimer && day.state === "today");
          const empty = day.entries.length === 0 && !showTimer;
          const composerOpen = composerDayIso === day.isoDate;

          return (
            <section
              key={day.isoDate}
              aria-label={day.label}
              className={weekAgendaColumnVariants({ state: day.state, locked: day.locked })}
            >
              <h2 className={cn(columns && "lg:sticky lg:top-0 lg:z-10")}>
                <DayColumnHeader
                  day={day}
                  variant={columns ? "column" : "row"}
                  capacityMinutes={capacityMinutes}
                  totalLabel={format(day.totalMinutes)}
                  label={columns || expanded ? labels.openDay(day) : labels.expandDay(day)}
                  labels={{
                    capacity: labels.capacity(day),
                    over: labels.over,
                    locked: labels.locked,
                    onLeave: labels.onLeave,
                    today: labels.today,
                  }}
                  expanded={columns ? undefined : expanded}
                  layoutId={dayLayoutId(day.isoDate)}
                  onPress={() =>
                    columns || expanded ? onOpenDay(day.isoDate) : onSelectDay(day.isoDate)
                  }
                />
              </h2>

              <div
                className={cn(
                  "flex flex-1 flex-col gap-2 p-2",
                  !expanded && "hidden",
                  /* Recessed, never faded: ancestor opacity would composite these cards'
                     text below 4.5:1. See `DayColumnHeader.variants.ts`. */
                  day.state === "future" && "bg-muted/45",
                )}
              >
                {showTimer && runningTimer ? (
                  <RunningEntryCard
                    projectName={runningTimer.projectName}
                    projectColor={runningTimer.projectColor}
                    description={runningTimer.description}
                    elapsedLabel={runningTimer.elapsedLabel}
                    labels={labels.timer}
                    disabled={disabled}
                    onStop={onStopTimer}
                  />
                ) : null}

                {day.entries.length ? (
                  <ul className="grid gap-2">
                    <AnimatePresence initial={animateEntries}>
                      {day.entries.map((entry, index) => (
                        <m.li
                          key={entry.id}
                          /* Only the selected day's entries take a shared id. They are the ones
                             that also exist in the Day scope, so they are the only ones with
                             anything to morph into; a card in another column would pay for a
                             measure pass and buy nothing. */
                          layoutId={
                            day.isoDate === selectedDayIso ? entryLayoutId(entry.id) : undefined
                          }
                          layout="position"
                          initial={entryCardMotion.initial}
                          animate={entryCardMotion.animate}
                          exit={{ ...entryCardMotion.exit, transition: exitTransition }}
                          transition={{ ...entryEnterTransition(index), layout: levelTransition }}
                          /* `min-w-0`, or a column is as wide as its widest card wants to be: a
                             grid item's automatic minimum is its min-content width. */
                          className="min-w-0"
                        >
                          <EntryCard
                            entry={entry}
                            durationLabel={format(entry.durationMinutes)}
                            density="compact"
                            labels={labels.card}
                            disabled={disabled}
                            highlightToken={highlight?.id === entry.id ? highlight.token : null}
                            canContinue={canContinue}
                            onEdit={onEditEntry}
                            onDelete={onDeleteEntry}
                            onContinue={onContinueEntry}
                          />
                        </m.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                ) : empty && !weekEmpty ? (
                  /* `grid-cols-1` is `minmax(0,1fr)`, and that zero is the point: an implicit
                     `auto` track takes the widest child's min-content width, so a single
                     unbreakable label sized the track past the column and `justify-items-center`
                     then centred the paragraph inside *that*, pushing both out of the card. An
                     empty weekend column is 7.5rem wide — narrower than "Copy yesterday" on one
                     line in either locale — so the label has to be allowed to wrap. */
                  <div className="grid grid-cols-1 justify-items-center gap-1 px-1 py-3 text-center">
                    <p className="text-xs text-muted-foreground">{labels.columnEmpty}</p>
                    {day.canCopyPreviousDay && onCopyPreviousDay && !day.locked && !day.onLeave ? (
                      <button
                        type="button"
                        disabled={disabled}
                        className="inline-flex max-w-full items-center gap-1 text-balance rounded-[var(--radius-sm)] px-1.5 py-0.5 font-ui text-[11px] font-semibold text-muted-foreground transition-colors duration-[var(--duration-micro)] hover:text-accent disabled:opacity-50"
                        onClick={() => onCopyPreviousDay(day.isoDate)}
                      >
                        <Copy className="size-3 shrink-0" aria-hidden="true" />
                        {labels.copyYesterday}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {/* Hidden, not disabled, on a locked or leave day (§5.10): there is nothing a member
                    can do there, and a disabled control invites a click that explains nothing. */}
                {day.locked || day.onLeave ? null : (
                  <Popover
                    open={composerOpen}
                    onOpenChange={(open) => onComposerOpenChange?.(day.isoDate, open)}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        disabled={disabled}
                        aria-label={labels.addEntry(day)}
                        className="mt-auto inline-flex h-8 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-dashed border-accent/45 px-2 font-ui text-xs font-semibold text-accent transition-colors duration-[var(--duration-micro)] hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => onAddEntry(day.isoDate)}
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                      </button>
                    </PopoverTrigger>
                    {renderComposer && composerOpen ? (
                      <PopoverContent
                        align="center"
                        collisionPadding={16}
                        className="w-[min(26rem,calc(100vw-2rem))]"
                        onOpenAutoFocus={(event) => {
                          // The composer autofocuses its own first field.
                          event.preventDefault();
                        }}
                      >
                        {renderComposer(day)}
                      </PopoverContent>
                    ) : null}
                  </Popover>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {weekEmpty ? (
        <div className="grid justify-items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-border bg-card/60 px-6 py-10 text-center">
          <div className="grid size-11 place-items-center rounded-full bg-secondary text-muted-foreground">
            <CalendarRange className="size-5" aria-hidden="true" />
          </div>
          <div className="grid gap-1">
            <h3 className="text-base font-semibold text-foreground">{labels.emptyWeekTitle}</h3>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              {labels.emptyWeekDescription}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="cta"
              size="sm"
              icon={Plus}
              disabled={disabled || days.every((day) => day.locked || day.onLeave)}
              onClick={() => onAddEntry(selectedDayIso)}
            >
              {labels.addEntryPlain}
            </Button>
            {onDuplicatePreviousWeek ? (
              <Button
                type="button"
                variant="soft"
                size="sm"
                icon={Copy}
                disabled={disabled || !canDuplicatePreviousWeek}
                onClick={onDuplicatePreviousWeek}
              >
                {labels.duplicateLastWeek}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {footnote ? <div className="px-1 text-sm text-muted-foreground">{footnote}</div> : null}
    </div>
  );
}

export type { WeekAgendaDay };
