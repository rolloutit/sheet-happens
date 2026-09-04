"use client";

import { AlertTriangle, Clock3, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";

import { formatHoursWithUnit } from "@/src/lib/formatting";
import {
  entryCardMotion,
  entryEnterTransition,
  entryLayoutId,
  exitTransition,
  levelTransition,
} from "@/src/lib/motion";
import { cn } from "@/src/lib/utils";
import type { DayAgendaAdminNotice, DayAgendaProps } from "./DayAgenda.types";

/**
 * L1 of the `/time` resolution axis: one day, every entry, full detail.
 *
 * Lifted out of the screen file unchanged, so the day reads exactly as it did before the axis
 * existed. Two things it deliberately does not render: the day strip and the day total, which are
 * persistent chrome above every level and must keep their DOM element as the level changes.
 */
export function DayAgenda({
  isoDate,
  dayState,
  totalMinutes,
  capacityMinutes,
  entries,
  locale,
  durationDisplayFormat,
  labels,
  disabled = false,
  animateEntries = false,
  className,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
}: DayAgendaProps) {
  // A duration-only entry has no time to sort by, so it sorts after every timed one.
  const sortedEntries = [...entries].sort((a, b) =>
    (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99"),
  );

  return (
    <div className={cn("grid gap-4", className)}>
      {dayState === "future" ? <DayWarning text={labels.futureDay} /> : null}
      {totalMinutes > capacityMinutes ? <DayWarning text={labels.overCapacity} /> : null}

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
        {sortedEntries.length ? (
          <AnimatePresence initial={animateEntries}>
            {sortedEntries.map((entry, index) => (
              /* The other half of the `entry-<id>` pairing: this row and the L2 card are the same
                 entry seen at two resolutions, so one visibly becomes the other rather than the
                 lists crossfading. `layout="position"` for the same reason as the week columns —
                 a row is much wider than a card, and a scaling parent would stretch the duration
                 and the times inside it. */
              <m.div
                key={entry.id}
                layoutId={entryLayoutId(entry.id)}
                layout="position"
                initial={entryCardMotion.initial}
                animate={entryCardMotion.animate}
                exit={{ ...entryCardMotion.exit, transition: exitTransition }}
                transition={{ ...entryEnterTransition(index), layout: levelTransition }}
                className={cn(
                  "grid gap-3 border-b border-border p-4 last:border-b-0 sm:grid-cols-[5.5rem_1fr_auto]",
                  entry.warnings.length && "bg-warning-soft",
                )}
              >
                <div className="font-ui text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  {entry.startTime && entry.endTime ? (
                    <>
                      <span className="block text-foreground">{entry.startTime}</span>
                      <span className="block">{entry.endTime}</span>
                    </>
                  ) : (
                    <span className="italic">{labels.durationMode}</span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{entry.description}</p>
                    <span className="rounded-[var(--radius-pill)] bg-secondary px-2 py-0.5 font-ui text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      {entry.sourceLabel}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: entry.projectColor }}
                        aria-hidden="true"
                      />
                      {entry.projectName}
                    </span>
                    <span>·</span>
                    <span className="font-semibold text-foreground">
                      {formatHoursWithUnit(entry.durationMinutes, locale, durationDisplayFormat)}
                    </span>
                  </div>
                  {entry.adminNotice ? <AdminNotice notice={entry.adminNotice} /> : null}
                  {entry.warnings.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {entry.warnings.map((warning) => (
                        <span
                          key={warning}
                          className="inline-flex items-center gap-1 text-xs font-medium text-warning"
                        >
                          <AlertTriangle className="size-3.5" aria-hidden="true" />
                          {warning}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-1 sm:justify-end">
                  <button
                    type="button"
                    disabled={entry.locked || disabled}
                    className="grid size-9 place-items-center rounded-[var(--radius-sm)] text-muted-foreground transition hover:bg-secondary hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={labels.editEntry(entry)}
                    onClick={() => onEditEntry(entry)}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={entry.locked || disabled}
                    className="grid size-9 place-items-center rounded-[var(--radius-sm)] text-muted-foreground transition hover:bg-destructive-soft hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={labels.deleteEntry(entry)}
                    onClick={() => onDeleteEntry(entry)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </m.div>
            ))}
          </AnimatePresence>
        ) : (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
              <Clock3 className="size-6" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-base font-semibold">{labels.emptyTitle}</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              {labels.emptyDescription}
            </p>
          </div>
        )}
      </div>

      <div>
        <button
          type="button"
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-accent/45 bg-card px-4 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onAddEntry(isoDate)}
        >
          <Plus className="size-4" aria-hidden="true" />
          {labels.addEntry}
        </button>
      </div>
    </div>
  );
}

function DayWarning({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {text}
    </div>
  );
}

function AdminNotice({ notice }: { notice: DayAgendaAdminNotice }) {
  return (
    <div className="mt-2 flex items-start gap-2 rounded-[var(--radius-sm)] border border-accent-line bg-accent-soft px-2.5 py-2 text-xs leading-relaxed">
      <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden="true" />
      <span>
        <span className="font-semibold text-foreground">{notice.changedBy}</span>{" "}
        <span className="text-muted-foreground">{notice.reason}</span>
      </span>
    </div>
  );
}
