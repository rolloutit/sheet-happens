"use client";

import {
  AlertTriangle,
  CalendarX,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Grid3X3,
  Info,
  Layers,
  List,
  MessageSquare,
  Moon,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";

import { cn } from "@/src/lib/utils";
import type {
  TimeGridAssignedProject,
  TimeGridDay,
  TimeGridEntry,
  TimeGridWeek,
} from "@/src/server/time-tracking";

import {
  createTimeEntryAction,
  deleteTimeEntryAction,
  markInactiveProjectWeekAction,
  unmarkInactiveProjectWeekAction,
  updateTimeEntryAction,
} from "./actions";
import type { TimeTrackingActionState } from "./actions.types";

type Notice = {
  tone: "success" | "error";
  message: string;
} | null;

type EntryModalState =
  | {
      mode: "create";
      source: "GRID" | "FORM";
      projectId: string;
      localDate: string;
      durationMinutes: number;
      description?: string;
      prefill?: boolean;
    }
  | {
      mode: "edit";
      entry: TimeGridEntry;
    }
  | null;

type BreakdownState = {
  projectId: string;
  localDate: string;
} | null;

type TimeGridClientProps = {
  week: TimeGridWeek;
};

export function TimeGridClient({ week }: TimeGridClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<Notice>(null);
  const [entryModal, setEntryModal] = useState<EntryModalState>(null);
  const [breakdown, setBreakdown] = useState<BreakdownState>(null);

  const inactiveProjectIds = useMemo(
    () => new Set(week.inactiveWeeks.map((inactiveWeek) => inactiveWeek.projectId)),
    [week.inactiveWeeks],
  );
  const entriesByCell = useMemo(() => groupEntriesByCell(week.entries), [week.entries]);
  const entriesByDay = useMemo(() => groupEntriesByDay(week.entries), [week.entries]);
  const weekHasLockedPeriod = week.lockedMonthStarts.length > 0;

  const projectRows = week.projects;
  const dailyTotals = week.days.map((day) =>
    projectRows.reduce((sum, project) => {
      if (inactiveProjectIds.has(project.projectId)) return sum;
      return sum + getCellEntries(entriesByCell, project.projectId, day.isoDate).totalMinutes;
    }, 0),
  );
  const weekTotal = dailyTotals.reduce((sum, minutes) => sum + minutes, 0);

  function navigateToWeek(weekStart: string) {
    router.push(`/time?week=${weekStart}` as Route);
  }

  function refreshWithResult(result: TimeTrackingActionState) {
    setNotice(result.status === "success" ? { tone: "success", message: result.message } : {
      tone: "error",
      message: result.message,
    });

    if (result.status === "success") {
      router.refresh();
    }
  }

  function runAction(action: () => Promise<TimeTrackingActionState>) {
    startTransition(async () => {
      refreshWithResult(await action());
    });
  }

  function handleCellCommit(project: TimeGridAssignedProject, day: TimeGridDay, rawValue: string) {
    const parsedMinutes = parseDurationToMinutes(rawValue);
    const cell = getCellEntries(entriesByCell, project.projectId, day.isoDate);

    if (parsedMinutes === null) {
      setNotice({ tone: "error", message: "Use hours like 3.5 or 3:30." });
      return;
    }

    if (parsedMinutes <= 0) {
      if (cell.entries.length === 1 && !cell.entries[0].locked) {
        runAction(() => deleteTimeEntryAction({ timeEntryId: cell.entries[0].id }));
      }
      return;
    }

    if (cell.entries.length === 0) {
      setEntryModal({
        mode: "create",
        source: "GRID",
        projectId: project.projectId,
        localDate: day.isoDate,
        durationMinutes: parsedMinutes,
        prefill: true,
      });
      return;
    }

    const entry = cell.entries[0];

    if (cell.entries.length === 1 && isSimpleDurationEntry(entry) && !entry.locked) {
      runAction(() =>
        updateTimeEntryAction({
          timeEntryId: entry.id,
          durationMinutes: parsedMinutes,
        }),
      );
      return;
    }

    setBreakdown({ projectId: project.projectId, localDate: day.isoDate });
  }

  function toggleInactive(project: TimeGridAssignedProject, inactive: boolean) {
    runAction(() =>
      inactive
        ? unmarkInactiveProjectWeekAction({
            projectId: project.projectId,
            weekStartDate: week.weekStart,
          })
        : markInactiveProjectWeekAction({
            projectId: project.projectId,
            weekStartDate: week.weekStart,
          }),
    );
  }

  const breakdownProject = breakdown
    ? projectRows.find((project) => project.projectId === breakdown.projectId)
    : undefined;
  const breakdownDay = breakdown
    ? week.days.find((day) => day.isoDate === breakdown.localDate)
    : undefined;
  const breakdownEntries =
    breakdown && breakdownProject
      ? getCellEntries(entriesByCell, breakdown.projectId, breakdown.localDate).entries
      : [];

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-[var(--radius-pill)] border border-border bg-secondary p-1">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
          >
            <Grid3X3 className="size-4" aria-hidden="true" />
            Weekly grid
          </button>
          <button
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-[var(--radius-pill)] px-4 py-2 text-sm font-semibold text-muted-foreground opacity-70"
            title="Day view is part of the design and comes after the weekly grid slice."
          >
            <List className="size-4" aria-hidden="true" />
            Day
          </button>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-cta px-4 py-2.5 text-sm font-semibold text-cta-foreground shadow-soft transition hover:bg-[color-mix(in_srgb,var(--cta)_88%,white)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!projectRows.length || isPending}
          onClick={() => {
            const project = projectRows[0];
            if (!project) return;

            setEntryModal({
              mode: "create",
              source: "FORM",
              projectId: project.projectId,
              localDate: week.todayIso >= week.weekStart && week.todayIso <= week.weekEnd
                ? week.todayIso
                : week.weekStart,
              durationMinutes: 60,
            });
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          New entry
        </button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-border bg-card p-1">
            <button
              type="button"
              className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              aria-label="Previous week"
              onClick={() => navigateToWeek(week.previousWeek)}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <span className="px-3 text-sm font-medium text-foreground">{week.weekLabel}</span>
            <button
              type="button"
              className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              aria-label="Next week"
              onClick={() => navigateToWeek(week.nextWeek)}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>

          {week.weekStart === week.thisWeek ? (
            <span className="rounded-[var(--radius-pill)] bg-accent/15 px-3 py-1.5 font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">
              This week
            </span>
          ) : (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary"
              onClick={() => navigateToWeek(week.thisWeek)}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              This week
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 lg:justify-end">
          <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Week total
          </span>
          <span className="text-[26px] font-semibold text-foreground">
            {formatMinutesAsHours(weekTotal)}
            <span className="ml-1 text-[15px] text-muted-foreground">h</span>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground opacity-60"
          title="Copy actions will be wired when draft/prefill behavior is expanded."
        >
          <Copy className="size-4" aria-hidden="true" />
          Same as yesterday
        </button>
        <button
          type="button"
          disabled
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground opacity-60"
          title="Copy actions will be wired when draft/prefill behavior is expanded."
        >
          <Copy className="size-4" aria-hidden="true" />
          Duplicate last week
        </button>
        <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Assigned
        </span>
        {projectRows.slice(0, 3).map((project) => (
          <span
            key={project.projectId}
            className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-card px-3 py-2 text-sm font-medium"
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: project.color }}
              aria-hidden="true"
            />
            {project.name}
          </span>
        ))}
      </div>

      {notice ? (
        <div
          className={cn(
            "flex items-center gap-2 rounded-[var(--radius-md)] border px-4 py-3 text-sm font-medium",
            notice.tone === "success"
              ? "border-success/35 bg-success/12 text-success"
              : "border-destructive/35 bg-destructive/12 text-destructive",
          )}
        >
          {notice.tone === "success" ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <AlertTriangle className="size-4" aria-hidden="true" />
          )}
          {notice.message}
        </div>
      ) : null}

      {weekHasLockedPeriod ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-warning/30 bg-warning/12 px-4 py-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <span className="font-semibold">Locked period.</span> Some days in this week belong to
            a submitted timesheet and are read-only.
          </div>
        </div>
      ) : null}

      {projectRows.length ? (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <div className="min-w-[900px] overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
              <div className="grid grid-cols-[minmax(190px,1.5fr)_repeat(7,minmax(54px,1fr))_92px]">
                <GridHeaderCell label="Projects" />
                {week.days.map((day) => (
                  <div
                    key={day.isoDate}
                    className={cn(
                      "border-b border-r border-border px-2 py-3 text-center",
                      day.state === "today" && "text-accent",
                      day.state === "future" && "opacity-55",
                    )}
                  >
                    <span className="block font-ui text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      {day.shortLabel}
                    </span>
                    <span className="mt-0.5 block text-[15px] font-medium">{day.dayNumber}</span>
                  </div>
                ))}
                <GridHeaderCell label="Total" noRightBorder />

                {projectRows.map((project) => {
                  const inactive = inactiveProjectIds.has(project.projectId);
                  const rowTotal = week.days.reduce(
                    (sum, day) =>
                      sum + getCellEntries(entriesByCell, project.projectId, day.isoDate).totalMinutes,
                    0,
                  );
                  const canToggleInactive = !weekHasLockedPeriod && rowTotal === 0;

                  return (
                    <div key={project.projectId} className="contents">
                      <div
                        className={cn(
                          "flex min-h-14 items-center gap-2 border-b border-r border-border px-3",
                          inactive && "opacity-65",
                        )}
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: project.color }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {project.name}
                        </span>
                        <button
                          type="button"
                          disabled={!canToggleInactive && !inactive}
                          title={
                            inactive
                              ? "Undo inactive week"
                              : canToggleInactive
                                ? "Mark as inactive week"
                                : "Remove entries first"
                          }
                          className="grid size-7 place-items-center rounded-[var(--radius-xs)] text-muted-foreground transition hover:bg-secondary hover:text-accent disabled:cursor-not-allowed disabled:opacity-35"
                          onClick={() => toggleInactive(project, inactive)}
                        >
                          <CalendarX className="size-4" aria-hidden="true" />
                        </button>
                      </div>

                      {inactive ? (
                        <InactiveProjectRow onUndo={() => toggleInactive(project, true)} />
                      ) : (
                        <>
                          {week.days.map((day, dayIndex) => (
                            <TimeGridCell
                              key={day.isoDate}
                              day={day}
                              dayTotalMinutes={dailyTotals[dayIndex] ?? 0}
                              entriesByDay={entriesByDay}
                              project={project}
                              cell={getCellEntries(entriesByCell, project.projectId, day.isoDate)}
                              disabled={
                                isPending ||
                                day.locked ||
                                !isProjectAssignableOnDate(project, day.isoDate)
                              }
                              onCommit={(rawValue) => handleCellCommit(project, day, rawValue)}
                              onOpenBreakdown={() =>
                                setBreakdown({ projectId: project.projectId, localDate: day.isoDate })
                              }
                            />
                          ))}
                          <div className="flex min-h-14 items-center justify-center border-b border-border text-base font-semibold">
                            {formatMinutesAsHours(rowTotal) || "0"}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}

                <div className="flex min-h-[52px] items-center border-r border-border bg-secondary px-3 font-ui text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Daily total
                </div>
                {week.days.map((day, dayIndex) => {
                  const total = dailyTotals[dayIndex] ?? 0;
                  const over = total > 1440;

                  return (
                    <div
                      key={day.isoDate}
                      className={cn(
                        "relative flex min-h-[52px] items-center justify-center gap-1 border-r border-border bg-secondary text-sm font-semibold",
                        day.state === "today" && "bg-accent/8",
                        over ? "text-warning" : total ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {formatMinutesAsHours(total) || "0"}
                      {over ? <WarningTip text={`That is ${formatMinutesAsHours(total)}h in one day.`} /> : null}
                    </div>
                  );
                })}
                <div className="flex min-h-[52px] items-center justify-center bg-secondary text-[17px] font-semibold text-accent">
                  {formatMinutesAsHours(weekTotal) || "0"}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:hidden">
            <div className="grid grid-cols-7 gap-1.5">
              {week.days.map((day) => (
                <div
                  key={day.isoDate}
                  className={cn(
                    "rounded-[var(--radius-md)] border border-border bg-card px-1 py-2 text-center",
                    day.state === "today" && "border-accent bg-accent/12 text-accent",
                  )}
                >
                  <span className="block font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                    {day.shortLabel}
                  </span>
                  <span className="block text-base font-semibold">{day.dayNumber}</span>
                  {day.state === "today" ? (
                    <span className="mx-auto mt-1 block size-1.5 rounded-full bg-accent" />
                  ) : (
                    <span className="mt-1 block h-1.5" />
                  )}
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
              {projectRows.map((project) => {
                const inactive = inactiveProjectIds.has(project.projectId);
                return (
                  <div key={project.projectId} className="border-b border-border last:border-b-0">
                    <div className="flex items-center gap-2 px-4 py-3">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: project.color }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {project.name}
                      </span>
                      {inactive ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-accent"
                          onClick={() => toggleInactive(project, true)}
                        >
                          Undo
                        </button>
                      ) : null}
                    </div>
                    {inactive ? (
                      <div className="px-4 pb-4 text-sm italic text-muted-foreground">
                        Inactive week
                      </div>
                    ) : (
                      <div className="grid grid-cols-7 gap-1 px-3 pb-3">
                        {week.days.map((day) => {
                          const cell = getCellEntries(entriesByCell, project.projectId, day.isoDate);
                          return (
                            <button
                              key={day.isoDate}
                              type="button"
                              disabled={day.locked || !isProjectAssignableOnDate(project, day.isoDate)}
                              className={cn(
                                "rounded-[var(--radius-sm)] border border-border bg-background px-1 py-2 text-sm font-semibold disabled:opacity-35",
                                cell.totalMinutes > 0 && "border-accent/35 bg-accent/12 text-accent",
                              )}
                              onClick={() => {
                                if (cell.entries.length === 0) {
                                  setEntryModal({
                                    mode: "create",
                                    source: "GRID",
                                    projectId: project.projectId,
                                    localDate: day.isoDate,
                                    durationMinutes: 60,
                                    prefill: true,
                                  });
                                } else {
                                  setBreakdown({
                                    projectId: project.projectId,
                                    localDate: day.isoDate,
                                  });
                                }
                              }}
                            >
                              {formatMinutesAsHours(cell.totalMinutes) || "0"}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="size-4" aria-hidden="true" />
            Type hours like 3.5 or 3:30. Entering hours in an empty cell opens the entry form
            because descriptions are required.
          </div>
        </>
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-border bg-card px-6 py-12 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
            <Clock3 className="size-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">No active assigned projects</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Time can be logged after an admin assigns you to an active project for this week.
          </p>
        </div>
      )}

      {entryModal ? (
        <EntryModal
          state={entryModal}
          week={week}
          projects={projectRows}
          onClose={() => setEntryModal(null)}
          onDone={(result) => {
            refreshWithResult(result);
            if (result.status === "success") setEntryModal(null);
          }}
        />
      ) : null}

      {breakdown && breakdownProject && breakdownDay ? (
        <BreakdownDialog
          day={breakdownDay}
          entries={breakdownEntries}
          entriesByDay={entriesByDay}
          project={breakdownProject}
          onAdd={() =>
            setEntryModal({
              mode: "create",
              source: "GRID",
              projectId: breakdownProject.projectId,
              localDate: breakdownDay.isoDate,
              durationMinutes: 60,
              prefill: true,
            })
          }
          onClose={() => setBreakdown(null)}
          onDelete={(entry) => runAction(() => deleteTimeEntryAction({ timeEntryId: entry.id }))}
          onEdit={(entry) => setEntryModal({ mode: "edit", entry })}
        />
      ) : null}
    </div>
  );
}

function GridHeaderCell({ label, noRightBorder = false }: { label: string; noRightBorder?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-h-[52px] items-center border-b border-border px-3 font-ui text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground",
        !noRightBorder && "border-r",
      )}
    >
      {label}
    </div>
  );
}

type TimeGridCellProps = {
  day: TimeGridDay;
  dayTotalMinutes: number;
  entriesByDay: Map<string, TimeGridEntry[]>;
  project: TimeGridAssignedProject;
  cell: CellEntries;
  disabled: boolean;
  onCommit: (rawValue: string) => void;
  onOpenBreakdown: () => void;
};

function TimeGridCell({
  day,
  dayTotalMinutes,
  entriesByDay,
  project,
  cell,
  disabled,
  onCommit,
  onOpenBreakdown,
}: TimeGridCellProps) {
  const simpleEntry =
    cell.entries.length === 1 && isSimpleDurationEntry(cell.entries[0]) ? cell.entries[0] : null;
  const canInlineEdit = !disabled && !cell.locked && (cell.entries.length === 0 || simpleEntry);
  const warningTexts = getCellWarnings({
    day,
    dayTotalMinutes,
    entriesByDay,
    cell,
  });

  if (!isProjectAssignableOnDate(project, day.isoDate)) {
    return (
      <div className="flex min-h-14 items-center justify-center border-b border-r border-border text-muted-foreground">
        ·
      </div>
    );
  }

  if (!canInlineEdit) {
    return (
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "relative flex min-h-14 items-center justify-center gap-1 border-b border-r border-border text-base font-semibold transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60",
          day.state === "today" && "bg-accent/8",
          warningTexts.length > 0 && "text-warning",
        )}
        onClick={onOpenBreakdown}
      >
        {formatMinutesAsHours(cell.totalMinutes) || "0"}
        {cell.entries.length > 1 ? (
          <span className="inline-flex items-center gap-0.5 text-muted-foreground">
            <Layers className="size-3" aria-hidden="true" />
            <span className="font-ui text-[10px] font-bold">{cell.entries.length}</span>
          </span>
        ) : cell.entries.some((entry) => entry.startedAt || entry.endedAt) ? (
          <Clock3 className="size-3 text-muted-foreground" aria-hidden="true" />
        ) : null}
        {warningTexts.length > 0 ? <WarningTip text={warningTexts.join(" ")} /> : null}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "relative min-h-14 border-b border-r border-border transition hover:bg-secondary",
        day.state === "today" && "bg-accent/8",
      )}
    >
      <input
        key={`${cell.totalMinutes}:${cell.entries.map((entry) => entry.updatedAt).join(":")}`}
        inputMode="decimal"
        defaultValue={formatMinutesAsHours(cell.totalMinutes)}
        placeholder="0"
        disabled={disabled}
        aria-label={`${project.name}, ${day.label}`}
        className={cn(
          "h-full min-h-14 w-full border-0 bg-transparent px-2 text-center text-base font-medium text-foreground outline-none focus:shadow-[inset_0_0_0_2px_var(--ring)] disabled:cursor-not-allowed disabled:text-muted-foreground",
          warningTexts.length > 0 && "text-warning",
        )}
        onBlur={(event) => onCommit(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      {cell.entries.length > 0 ? (
        <button
          type="button"
          className="absolute left-1.5 top-1.5 grid size-4 place-items-center text-muted-foreground hover:text-accent"
          title={cell.needsDescription ? "Description needed" : "Description saved"}
          onClick={onOpenBreakdown}
        >
          <MessageSquare className="size-3" aria-hidden="true" />
        </button>
      ) : null}
      {warningTexts.length > 0 ? <WarningTip text={warningTexts.join(" ")} /> : null}
    </div>
  );
}

function InactiveProjectRow({ onUndo }: { onUndo: () => void }) {
  return (
    <div className="col-span-8 flex min-h-14 items-center gap-3 border-b border-border bg-[repeating-linear-gradient(135deg,transparent,transparent_8px,var(--secondary)_8px,var(--secondary)_16px)] px-4">
      <Moon className="size-4 text-muted-foreground" aria-hidden="true" />
      <span className="text-sm font-semibold text-muted-foreground">Inactive week</span>
      <span className="text-xs text-muted-foreground">· No work on this project this week.</span>
      <button
        type="button"
        className="ml-auto text-sm font-semibold text-accent hover:underline"
        onClick={onUndo}
      >
        Undo
      </button>
    </div>
  );
}

type EntryModalProps = {
  state: NonNullable<EntryModalState>;
  week: TimeGridWeek;
  projects: TimeGridAssignedProject[];
  onClose: () => void;
  onDone: (result: TimeTrackingActionState) => void;
};

function EntryModal({ state, week, projects, onClose, onDone }: EntryModalProps) {
  const [isPending, startTransition] = useTransition();
  const initialProjectId = state.mode === "edit" ? state.entry.projectId : state.projectId;
  const initialLocalDate = state.mode === "edit" ? state.entry.localDate : state.localDate;
  const initialDuration =
    state.mode === "edit" ? state.entry.durationMinutes : state.durationMinutes;
  const [projectId, setProjectId] = useState(initialProjectId);
  const [localDate, setLocalDate] = useState(initialLocalDate);
  const [durationText, setDurationText] = useState(formatMinutesAsHours(initialDuration) || "1");
  const [description, setDescription] = useState(
    state.mode === "edit" ? state.entry.description : state.description ?? "",
  );
  const [fieldErrors, setFieldErrors] = useState<TimeTrackingActionState["fieldErrors"]>();
  const project = projects.find((item) => item.projectId === projectId) ?? projects[0];
  const parsedMinutes = parseDurationToMinutes(durationText);
  const ready = Boolean(projectId && localDate && description.trim() && parsedMinutes && parsedMinutes > 0);

  function submit() {
    const durationMinutes = parseDurationToMinutes(durationText);

    if (!durationMinutes || durationMinutes <= 0) {
      setFieldErrors({ durationMinutes: "Duration must be greater than zero." });
      return;
    }

    startTransition(async () => {
      const result =
        state.mode === "edit"
          ? await updateTimeEntryAction({
              timeEntryId: state.entry.id,
              projectId,
              localDate,
              durationMinutes,
              description,
            })
          : await createTimeEntryAction({
              projectId,
              localDate,
              durationMinutes,
              description,
              source: state.source,
            });

      setFieldErrors(result.fieldErrors);
      onDone(result);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-[540px] overflow-y-auto rounded-[var(--radius-xl)] border border-border bg-card shadow-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <h2 className="text-xl font-semibold">
            {state.mode === "edit" ? "Edit time entry" : "New time entry"}
          </h2>
          <button
            type="button"
            className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-5 px-6 py-6">
          {state.mode === "create" && state.prefill && project ? (
            <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-accent/35 bg-accent/12 p-3">
              <span className="grid size-9 place-items-center rounded-[var(--radius-sm)] bg-card text-accent">
                <Grid3X3 className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: project.color }}
                      aria-hidden="true"
                    />
                    {project.name}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{localDate}</span>
                  <span className="rounded-[var(--radius-pill)] border border-accent/35 bg-card px-2 py-0.5 font-ui text-[11px] font-bold text-accent">
                    {formatMinutesAsHours(state.durationMinutes)}h
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="size-3.5 text-accent" aria-hidden="true" />
                  Add a short description and save.
                </div>
              </div>
            </div>
          ) : null}

          <Field label="Description" required error={fieldErrors?.description}>
            <textarea
              rows={3}
              value={description}
              placeholder="What did you work on?"
              className={inputClassName(Boolean(fieldErrors?.description))}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>

          <Field label="Project" required error={fieldErrors?.projectId}>
            <select
              value={projectId}
              className={inputClassName(Boolean(fieldErrors?.projectId))}
              onChange={(event) => setProjectId(event.target.value)}
            >
              {projects.map((option) => (
                <option key={option.projectId} value={option.projectId}>
                  {option.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <Field label="Date" required error={fieldErrors?.localDate}>
              <input
                type="date"
                value={localDate}
                min={week.weekStart}
                max={week.weekEnd}
                className={inputClassName(Boolean(fieldErrors?.localDate))}
                onChange={(event) => setLocalDate(event.target.value)}
              />
            </Field>
            <Field label="Duration (hours)" required error={fieldErrors?.durationMinutes}>
              <input
                inputMode="decimal"
                value={durationText}
                className={inputClassName(Boolean(fieldErrors?.durationMinutes))}
                onChange={(event) => setDurationText(event.target.value)}
              />
            </Field>
          </div>

          {parsedMinutes && parsedMinutes > 1440 ? (
            <div className="flex items-center gap-2 text-sm text-warning">
              <AlertTriangle className="size-4" aria-hidden="true" />
              That is more than 24h. This is a warning, not a blocker.
            </div>
          ) : null}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="size-4" aria-hidden="true" />
            Project and description are required. Future dates and long days save with warnings.
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            className="rounded-[var(--radius-md)] border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!ready || isPending}
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-gradient-to-br from-primary to-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
            onClick={submit}
          >
            <Check className="size-4" aria-hidden="true" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

type BreakdownDialogProps = {
  day: TimeGridDay;
  project: TimeGridAssignedProject;
  entries: TimeGridEntry[];
  entriesByDay: Map<string, TimeGridEntry[]>;
  onAdd: () => void;
  onClose: () => void;
  onDelete: (entry: TimeGridEntry) => void;
  onEdit: (entry: TimeGridEntry) => void;
};

function BreakdownDialog({
  day,
  project,
  entries,
  entriesByDay,
  onAdd,
  onClose,
  onDelete,
  onEdit,
}: BreakdownDialogProps) {
  const total = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
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
            <h2 className="mt-1 text-lg font-semibold">
              Entries · {formatMinutesAsHours(total)}h
            </h2>
          </div>
          <button
            type="button"
            className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-3 p-5">
          {entries.length ? (
            entries.map((entry) => {
              const warnings = getEntryWarnings(entry, entriesByDay.get(entry.localDate) ?? []);
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
                      {formatMinutesAsHours(entry.durationMinutes)}h
                    </div>
                    <div className="font-ui text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      {entry.startedAt ? "Timed" : "Hours"}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{entry.description || "No description"}</p>
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
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={entry.locked}
                      className="grid size-8 place-items-center rounded-[var(--radius-sm)] text-muted-foreground hover:bg-destructive/12 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => onDelete(entry)}
                      aria-label="Delete entry"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No entries yet.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="size-4" aria-hidden="true" />
            A description is required per entry.
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-accent/45 px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/10"
            onClick={onAdd}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add entry
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label} {required ? <span className="text-destructive">*</span> : null}
      </span>
      {children}
      {error ? <span className="text-xs font-medium text-destructive">{error}</span> : null}
    </label>
  );
}

function inputClassName(error: boolean) {
  return cn(
    "w-full rounded-[var(--radius-md)] border bg-card px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent focus:shadow-[0_0_0_3px_rgb(55_227_222/0.14)]",
    error ? "border-destructive" : "border-border",
  );
}

function WarningTip({ text }: { text: string }) {
  return (
    <span className="absolute bottom-1 right-1 text-warning" title={text}>
      <AlertTriangle className="size-3.5" aria-hidden="true" />
    </span>
  );
}

type CellEntries = {
  entries: TimeGridEntry[];
  totalMinutes: number;
  locked: boolean;
  needsDescription: boolean;
};

function groupEntriesByCell(entries: TimeGridEntry[]) {
  const map = new Map<string, TimeGridEntry[]>();

  for (const entry of entries) {
    const key = cellKey(entry.projectId, entry.localDate);
    map.set(key, [...(map.get(key) ?? []), entry]);
  }

  return map;
}

function groupEntriesByDay(entries: TimeGridEntry[]) {
  const map = new Map<string, TimeGridEntry[]>();

  for (const entry of entries) {
    map.set(entry.localDate, [...(map.get(entry.localDate) ?? []), entry]);
  }

  return map;
}

function getCellEntries(
  map: Map<string, TimeGridEntry[]>,
  projectId: string,
  localDate: string,
): CellEntries {
  const entries = map.get(cellKey(projectId, localDate)) ?? [];

  return {
    entries,
    totalMinutes: entries.reduce((sum, entry) => sum + entry.durationMinutes, 0),
    locked: entries.some((entry) => entry.locked),
    needsDescription: entries.some((entry) => !entry.description.trim()),
  };
}

function cellKey(projectId: string, localDate: string) {
  return `${projectId}:${localDate}`;
}

function isSimpleDurationEntry(entry: TimeGridEntry | undefined): entry is TimeGridEntry {
  return Boolean(entry && !entry.startedAt && !entry.endedAt);
}

function isProjectAssignableOnDate(project: TimeGridAssignedProject, localDate: string) {
  if (localDate < project.validFrom) return false;
  if (project.validTo && localDate > project.validTo) return false;
  if (project.projectStartsOn && localDate < project.projectStartsOn) return false;
  if (project.projectEndsOn && localDate > project.projectEndsOn) return false;
  return true;
}

function getCellWarnings(input: {
  day: TimeGridDay;
  dayTotalMinutes: number;
  entriesByDay: Map<string, TimeGridEntry[]>;
  cell: CellEntries;
}) {
  const warnings: string[] = [];

  if (input.cell.needsDescription) warnings.push("Description needed.");
  if (input.day.state === "future" && input.cell.totalMinutes > 0) warnings.push("Future day.");
  if (input.dayTotalMinutes > 1440) warnings.push("Daily total is over 24h.");
  if (hasOverlaps(input.entriesByDay.get(input.day.isoDate) ?? [])) {
    warnings.push("Day has overlapping entries.");
  }

  return warnings;
}

function getEntryWarnings(entry: TimeGridEntry, dayEntries: TimeGridEntry[]) {
  const warnings: string[] = [];

  if (!entry.description.trim()) warnings.push("Description needed");
  if (entry.durationMinutes >= 480) warnings.push("Long continuous session");
  if (entryHasOverlap(entry, dayEntries)) warnings.push("Overlaps another entry");

  return warnings;
}

function hasOverlaps(entries: TimeGridEntry[]) {
  return entries.some((entry) => entryHasOverlap(entry, entries));
}

function entryHasOverlap(entry: TimeGridEntry, entries: TimeGridEntry[]) {
  if (!entry.startedAt || !entry.endedAt) return false;
  const start = Date.parse(entry.startedAt);
  const end = Date.parse(entry.endedAt);

  if (Number.isNaN(start) || Number.isNaN(end)) return false;

  return entries.some((other) => {
    if (other.id === entry.id || !other.startedAt || !other.endedAt) return false;
    const otherStart = Date.parse(other.startedAt);
    const otherEnd = Date.parse(other.endedAt);
    if (Number.isNaN(otherStart) || Number.isNaN(otherEnd)) return false;
    return start < otherEnd && otherStart < end;
  });
}

function parseDurationToMinutes(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return 0;

  if (normalized.includes(":")) {
    const [hoursValue, minutesValue] = normalized.split(":");
    const hours = Number.parseInt(hoursValue ?? "", 10);
    const minutes = Number.parseInt(minutesValue ?? "", 10);

    if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes < 0 || minutes >= 60) {
      return null;
    }

    return hours * 60 + minutes;
  }

  const hours = Number.parseFloat(normalized);

  if (Number.isNaN(hours) || hours < 0) return null;

  return Math.round(hours * 60);
}

function formatMinutesAsHours(minutes: number) {
  if (!minutes) return "";
  return Number((minutes / 60).toFixed(2)).toString();
}
