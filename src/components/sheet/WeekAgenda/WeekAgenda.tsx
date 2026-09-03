import { AlertTriangle, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";

import { formatHoursWithUnit, type DurationDisplayFormat } from "@/src/lib/formatting";
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
          <section
            key={day.isoDate}
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
                  {day.entries.map((entry) => (
                    <li key={entry.id}>
                      <EntryCard
                        entry={entry}
                        locale={locale}
                        durationDisplayFormat={durationDisplayFormat}
                        labels={labels}
                        disabled={disabled}
                        onEditEntry={onEditEntry}
                        onDeleteEntry={onDeleteEntry}
                      />
                    </li>
                  ))}
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
          </section>
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

      <p className="line-clamp-2 text-xs leading-snug text-foreground" title={entry.description}>
        {entry.description}
      </p>

      <div className="flex items-center justify-between gap-1">
        <span className="min-w-0 truncate text-xs font-semibold text-foreground">
          {formatHoursWithUnit(entry.durationMinutes, locale, durationDisplayFormat)}
          {entry.startTime && entry.endTime ? (
            <span className="ml-1 font-normal text-muted-foreground">
              {entry.startTime}–{entry.endTime}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center">
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
