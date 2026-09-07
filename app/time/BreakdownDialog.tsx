"use client";

import { AlertTriangle, Info, Plus, Trash2, X } from "lucide-react";

import { cn } from "@/src/lib/utils";
import type {
  TimeGridAssignedProject,
  TimeGridDay,
  TimeGridEntry,
} from "@/src/server/time-tracking";

import { AdminModificationNotice, useModalFocusTrap } from "./EntryModal";
import { getEntryWarnings, type TimeTrackingTranslator } from "./time-entry-helpers";
import { useDurationFormatting } from "./use-duration-formatting";

/** The per-cell breakdown the Grid lens opens for a cell holding more than one entry. */
type BreakdownDialogProps = {
  day: TimeGridDay;
  project: TimeGridAssignedProject;
  entries: TimeGridEntry[];
  entriesByDay: Map<string, TimeGridEntry[]>;
  onAdd: () => void;
  onClose: () => void;
  onDelete: (entry: TimeGridEntry) => void;
  onEdit: (entry: TimeGridEntry) => void;
  t: TimeTrackingTranslator;
};

export function BreakdownDialog({
  day,
  project,
  entries,
  entriesByDay,
  onAdd,
  onClose,
  onDelete,
  onEdit,
  t,
}: BreakdownDialogProps) {
  const { formatMinutesWithUnit } = useDurationFormatting();
  const total = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const dialogRef = useModalFocusTrap<HTMLDivElement>(onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="time-entry-breakdown-title"
        tabIndex={-1}
        className="max-h-[88vh] w-full max-w-[520px] overflow-y-auto rounded-[var(--radius-xl)] border border-border bg-card shadow-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <div className="flex items-center gap-2 font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: project.color }}
                aria-hidden="true"
              />
              {project.name} · {day.shortLabel} {day.dayNumber}
            </div>
            <h2 id="time-entry-breakdown-title" className="mt-1 text-lg font-semibold">
              {t("breakdown.entries")} · {formatMinutesWithUnit(total)}
            </h2>
          </div>
          <button
            type="button"
            className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            onClick={onClose}
            aria-label={t("actions.close")}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-3 p-5">
          {entries.length ? (
            entries.map((entry) => {
              const warnings = getEntryWarnings(entry, entriesByDay.get(entry.localDate) ?? [], t);
              return (
                <div
                  key={entry.id}
                  className={cn(
                    "flex items-start gap-3 rounded-[var(--radius-md)] border bg-secondary p-3",
                    warnings.length ? "border-warning/35" : "border-border",
                  )}
                >
                  <div className="w-20 shrink-0 text-center">
                    <div className="text-lg font-semibold">
                      {formatMinutesWithUnit(entry.durationMinutes)}
                    </div>
                    <div className="font-ui text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      {entry.startedAt ? t("source.timed") : t("source.hours")}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {entry.description || t("labels.noDescription")}
                    </p>
                    {entry.adminModification ? (
                      <AdminModificationNotice
                        modification={entry.adminModification}
                        compact
                        t={t}
                      />
                    ) : null}
                    {warnings.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {warnings.map((warning) => (
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
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="rounded-[var(--radius-sm)] px-2 py-1 text-xs font-semibold text-accent hover:bg-card"
                      onClick={() => onEdit(entry)}
                    >
                      {t("actions.edit")}
                    </button>
                    <button
                      type="button"
                      disabled={entry.locked}
                      className="grid size-8 place-items-center rounded-[var(--radius-sm)] text-muted-foreground hover:bg-destructive-soft hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => onDelete(entry)}
                      aria-label={t("actions.deleteEntry")}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t("breakdown.noEntries")}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="size-4" aria-hidden="true" />
            {t("breakdown.descriptionRequired")}
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-accent/45 px-3 py-2 text-sm font-semibold text-accent hover:bg-accent-soft"
            onClick={onAdd}
          >
            <Plus className="size-4" aria-hidden="true" />
            {t("actions.addEntry")}
          </button>
        </div>
      </div>
    </div>
  );
}
