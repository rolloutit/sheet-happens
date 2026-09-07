"use client";

import { AlertTriangle, ChevronDown, Clock3, Copy, Plus, ShieldCheck } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";

import { formatHoursWithUnit } from "@/src/lib/formatting";
import {
  entryCardMotion,
  entryEnterTransition,
  entryLayoutId,
  exitTransition,
  levelTransition,
  springRing,
} from "@/src/lib/motion";
import { cn } from "@/src/lib/utils";
import { EntryCard, RunningEntryCard } from "../EntryCard";
import type { DayAgendaAdminNotice, DayAgendaProps } from "./DayAgenda.types";

/**
 * The Day scope: one day, every entry, full detail, and a rail that makes it a real zoom-in
 * rather than a narrow week (§4.3 of `docs/time-view-redesign.md`).
 *
 * The list on the left is the same cards the Week scope shows, at the comfortable density —
 * descriptions wrap, the meta line has room — and the selected day's cards carry the same
 * `entryLayoutId`, so zooming in grows each card into its row. The rail on the right is what the
 * Week cannot show: a target ring against the 8h soft target, the day's per-project split, and the
 * quick composer already open, so the most common Day task — add what I just did — is one field
 * away.
 *
 * The ring is amber only together with the `⚠ over 8 h` label; colour never speaks alone. Below
 * `lg` the rail stacks under the list as a collapsible, and the composer is not here at all: on a
 * phone it is the bottom sheet the FAB opens.
 *
 * Two things this deliberately does not render: the ribbon and the day total, which are the
 * shell's, above the content.
 */
export function DayAgenda({
  isoDate,
  dayState,
  totalMinutes,
  capacityMinutes,
  entries,
  split,
  locale,
  durationDisplayFormat,
  labels,
  disabled = false,
  locked = false,
  animateEntries = false,
  runningTimer = null,
  highlight = null,
  canContinue = true,
  canCopyPreviousDay = false,
  composer,
  className,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
  onContinueEntry,
  onCopyPreviousDay,
  onStopTimer,
}: DayAgendaProps) {
  // A duration-only entry has no time to sort by, so it sorts after every timed one.
  const sortedEntries = [...entries].sort((a, b) =>
    (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99"),
  );
  const format = (minutes: number) => formatHoursWithUnit(minutes, locale, durationDisplayFormat);
  const over = totalMinutes > capacityMinutes;
  const showTimer = Boolean(runningTimer && dayState === "today");
  const empty = sortedEntries.length === 0 && !showTimer;

  const rail = (
    <>
      <div className="flex items-center gap-4">
        <TargetRing
          minutes={totalMinutes}
          capacityMinutes={capacityMinutes}
          over={over}
          label={format(totalMinutes)}
        />
        <div className="grid gap-0.5">
          <span className="font-ui text-xs text-muted-foreground">{labels.target}</span>
          {over ? (
            <span className="inline-flex items-center gap-1 font-ui text-xs font-semibold text-warning">
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              {labels.over}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-1.5">
        <h3 className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {labels.split}
        </h3>
        {split.length ? (
          <ul className="grid gap-1">
            {split.map((item) => (
              <li key={item.projectId} className="flex items-center gap-2 text-sm">
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="min-w-0 flex-1 truncate text-foreground">{item.name}</span>
                <span className="shrink-0 font-ui text-xs font-semibold tabular-nums text-muted-foreground">
                  {format(item.minutes)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">{labels.noSplit}</p>
        )}
      </div>

      {composer ? (
        <div className="grid gap-2 border-t border-border pt-4">
          <h3 className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {labels.quickAdd}
          </h3>
          {composer}
        </div>
      ) : null}
    </>
  );

  return (
    <div className={cn("grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start", className)}>
      <div className="grid gap-3">
        {dayState === "future" ? <DayWarning text={labels.futureDay} /> : null}
        {over ? <DayWarning text={labels.overCapacity} /> : null}

        <div
          className={cn(
            "grid gap-2 rounded-[var(--radius-lg)] border border-border bg-card p-2",
            dayState === "future" && "opacity-70",
          )}
        >
          {showTimer && runningTimer ? (
            <RunningEntryCard
              projectName={runningTimer.projectName}
              projectColor={runningTimer.projectColor}
              description={runningTimer.description}
              elapsedLabel={runningTimer.elapsedLabel}
              density="comfortable"
              labels={labels.timer}
              disabled={disabled}
              onStop={onStopTimer}
            />
          ) : null}

          {sortedEntries.length ? (
            <ul className="grid gap-2">
              <AnimatePresence initial={animateEntries}>
                {sortedEntries.map((entry, index) => (
                  /* The other half of the `entry-<id>` pairing: this row and the Week card are the
                     same entry seen at two resolutions, so one visibly becomes the other rather than
                     the lists crossfading. `layout="position"` for the same reason as the headers —
                     a row is much wider than a card, and a scaling parent would stretch the
                     duration and the times inside it. */
                  <m.li
                    key={entry.id}
                    layoutId={entryLayoutId(entry.id)}
                    layout="position"
                    initial={entryCardMotion.initial}
                    animate={entryCardMotion.animate}
                    exit={{ ...entryCardMotion.exit, transition: exitTransition }}
                    transition={{ ...entryEnterTransition(index), layout: levelTransition }}
                    className="min-w-0"
                  >
                    <EntryCard
                      entry={entry}
                      durationLabel={format(entry.durationMinutes)}
                      density="comfortable"
                      labels={labels.card}
                      disabled={disabled}
                      highlightToken={highlight?.id === entry.id ? highlight.token : null}
                      canContinue={canContinue}
                      onEdit={() => onEditEntry(entry)}
                      onDelete={() => onDeleteEntry(entry)}
                      onContinue={onContinueEntry ? () => onContinueEntry(entry) : undefined}
                    >
                      {entry.adminNotice ? <AdminNotice notice={entry.adminNotice} /> : null}
                    </EntryCard>
                  </m.li>
                ))}
              </AnimatePresence>
            </ul>
          ) : empty ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
                <Clock3 className="size-6" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-base font-semibold">{labels.emptyTitle}</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                {labels.emptyDescription}
              </p>
              {canCopyPreviousDay && onCopyPreviousDay && !locked ? (
                <button
                  type="button"
                  disabled={disabled}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 font-ui text-xs font-semibold text-muted-foreground transition-colors duration-[var(--duration-micro)] hover:text-accent disabled:opacity-50"
                  onClick={() => onCopyPreviousDay(isoDate)}
                >
                  <Copy className="size-3.5" aria-hidden="true" />
                  {labels.copyYesterday}
                </button>
              ) : null}
            </div>
          ) : null}

          {locked ? null : (
            <button
              type="button"
              disabled={disabled}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-accent/45 font-ui text-xs font-semibold text-accent transition-colors duration-[var(--duration-micro)] hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => onAddEntry(isoDate)}
            >
              <Plus className="size-4" aria-hidden="true" />
              {labels.addEntry}
            </button>
          )}
        </div>
      </div>

      {/* The rail enters last on a zoom-in — 80ms after the transform, so the shared moves read
          before new information arrives (§7.2). */}
      <m.aside
        aria-label={labels.glance}
        initial={animateEntries ? { opacity: 0, y: 8 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.08 }}
        className="hidden gap-4 rounded-[var(--radius-lg)] border border-border bg-card p-4 lg:grid"
      >
        {rail}
      </m.aside>
      <details className="group/glance rounded-[var(--radius-lg)] border border-border bg-card lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-ui text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
          {labels.glance}
          <ChevronDown
            aria-hidden="true"
            className="size-4 text-muted-foreground transition-transform duration-[var(--duration-micro)] group-open/glance:rotate-180"
          />
        </summary>
        <div className="grid gap-4 border-t border-border p-4">{rail}</div>
      </details>
    </div>
  );
}

/**
 * The day against its target, as a ring. `pathLength` animates the arc on `--spring-ring`;
 * `initial={false}` keeps it from drawing from zero when the page opens. The figure in the middle
 * is text, exact, and never tweens.
 */
function TargetRing({
  minutes,
  capacityMinutes,
  over,
  label,
}: {
  minutes: number;
  capacityMinutes: number;
  over: boolean;
  label: string;
}) {
  const ratio = Math.min(1, Math.max(0, minutes / capacityMinutes));

  return (
    <div className="relative grid size-24 shrink-0 place-items-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r="15.5" className="stroke-secondary" strokeWidth="3" fill="none" />
        <m.circle
          cx="18"
          cy="18"
          r="15.5"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          className={over ? "stroke-warning" : "stroke-accent"}
          initial={false}
          animate={{ pathLength: ratio }}
          transition={springRing}
        />
      </svg>
      <span
        className={cn(
          "relative font-ui text-base font-semibold tabular-nums",
          over ? "text-warning" : "text-foreground",
        )}
      >
        {label}
      </span>
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
    <div className="mt-1 flex items-start gap-2 rounded-[var(--radius-sm)] border border-accent-line bg-accent-soft px-2.5 py-2 text-xs leading-relaxed">
      <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden="true" />
      <span>
        <span className="font-semibold text-foreground">{notice.changedBy}</span>{" "}
        <span className="text-muted-foreground">{notice.reason}</span>
      </span>
    </div>
  );
}
