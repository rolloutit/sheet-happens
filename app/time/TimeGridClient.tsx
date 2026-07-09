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
  Pencil,
  Play,
  PlayCircle,
  Plus,
  RotateCcw,
  Square,
  Trash2,
  X,
} from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";

import { parseDurationToMinutes } from "@/src/lib/duration";
import { cn } from "@/src/lib/utils";
import type {
  TimeGridAssignedProject,
  TimeGridDay,
  TimeGridEntry,
  TimeGridWeek,
} from "@/src/server/time-tracking";

import {
  clearTimeEntryDraftAction,
  copyPreviousDayEntriesAction,
  createTimeEntryAction,
  deleteTimeEntryAction,
  duplicatePreviousWeekAction,
  markInactiveProjectWeekAction,
  saveTimeEntryDraftAction,
  startRunningTimerAction,
  stopRunningTimerAction,
  unmarkInactiveProjectWeekAction,
  updateTimeEntryAction,
} from "./actions";
import {
  TIME_ENTRY_FORM_DRAFT_KEY,
  type TimeEntryTimingMode,
  type TimeTrackingActionState,
} from "./actions.types";

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
      timingMode?: TimeEntryTimingMode;
      durationText?: string;
      startTime?: string | null;
      endTime?: string | null;
      prefill?: boolean;
      draftKey?: string;
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
  const [view, setView] = useState<"grid" | "day">("grid");
  const [selectedDayIso, setSelectedDayIso] = useState(() =>
    week.todayIso >= week.weekStart && week.todayIso <= week.weekEnd
      ? week.todayIso
      : week.weekStart,
  );
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
  const projectsById = useMemo(
    () => new Map(projectRows.map((project) => [project.projectId, project])),
    [projectRows],
  );
  const dailyTotals = week.days.map((day) =>
    projectRows.reduce((sum, project) => {
      if (inactiveProjectIds.has(project.projectId)) return sum;
      return sum + getCellEntries(entriesByCell, project.projectId, day.isoDate).totalMinutes;
    }, 0),
  );
  const weekTotal = dailyTotals.reduce((sum, minutes) => sum + minutes, 0);
  const selectedDay =
    week.days.find((day) => day.isoDate === selectedDayIso) ?? week.days[0] ?? null;
  const selectedDayEntries = selectedDay ? (entriesByDay.get(selectedDay.isoDate) ?? []) : [];
  const targetDate = selectedDay?.isoDate ?? week.weekStart;
  const recentProjects = week.recentProjects.filter((project) =>
    projectsById.has(project.projectId),
  );

  function navigateToWeek(weekStart: string) {
    router.push(`/time?week=${weekStart}` as Route);
  }

  function refreshWithResult(result: TimeTrackingActionState) {
    setNotice(
      result.status === "success"
        ? { tone: "success", message: result.message }
        : {
            tone: "error",
            message: result.message,
          },
    );

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
      setNotice({ tone: "error", message: "Use time like 3.5, 3:30, 3h 20m, or 200m." });
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

  function restoreEntryDraft() {
    const draft = week.entryDraft;
    const fallbackProject = projectRows[0];
    if (!draft || !fallbackProject) return;

    const projectId = projectsById.has(draft.payload.projectId)
      ? draft.payload.projectId
      : fallbackProject.projectId;
    const durationMinutes = parseDurationToMinutes(draft.payload.durationText) ?? 60;

    setEntryModal({
      mode: "create",
      source: draft.payload.source,
      projectId,
      localDate: draft.payload.localDate,
      durationMinutes,
      durationText: draft.payload.durationText,
      description: draft.payload.description,
      timingMode: draft.payload.timingMode,
      startTime: draft.payload.startTime,
      endTime: draft.payload.endTime,
      prefill: draft.payload.prefill,
      draftKey: draft.draftKey,
    });
  }

  function discardEntryDraft() {
    const draft = week.entryDraft;
    if (!draft) return;

    runAction(() => clearTimeEntryDraftAction({ draftKey: draft.draftKey }));
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
            className={cn(
              "inline-flex items-center gap-2 rounded-[var(--radius-pill)] px-4 py-2 text-sm font-semibold transition",
              view === "grid"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setView("grid")}
          >
            <Grid3X3 className="size-4" aria-hidden="true" />
            Weekly grid
          </button>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-2 rounded-[var(--radius-pill)] px-4 py-2 text-sm font-semibold transition",
              view === "day"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setView("day")}
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
              localDate:
                view === "day" && selectedDay
                  ? selectedDay.isoDate
                  : week.todayIso >= week.weekStart && week.todayIso <= week.weekEnd
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
          disabled={isPending || !selectedDay || selectedDay.locked}
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-50"
          title={
            selectedDay ? `Copy entries from the day before ${selectedDay.isoDate}.` : undefined
          }
          onClick={() => runAction(() => copyPreviousDayEntriesAction({ targetDate }))}
        >
          <Copy className="size-4" aria-hidden="true" />
          Same as yesterday
        </button>
        <button
          type="button"
          disabled={isPending || weekHasLockedPeriod}
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-50"
          title="Copy entries from the previous week into this week."
          onClick={() =>
            runAction(() => duplicatePreviousWeekAction({ weekStartDate: week.weekStart }))
          }
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
        {recentProjects.length ? (
          <>
            <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Recent
            </span>
            {recentProjects.slice(0, 3).map((project) => (
              <button
                key={project.projectId}
                type="button"
                className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:border-accent/35 hover:bg-accent/10"
                onClick={() =>
                  setEntryModal({
                    mode: "create",
                    source: "FORM",
                    projectId: project.projectId,
                    localDate: targetDate,
                    durationMinutes: 60,
                  })
                }
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: project.color }}
                  aria-hidden="true"
                />
                {project.name}
              </button>
            ))}
          </>
        ) : null}
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
            <span className="font-semibold">Locked period.</span> Some days in this week belong to a
            submitted timesheet and are read-only.
          </div>
        </div>
      ) : null}

      {week.entryDraft && !entryModal && projectRows.length ? (
        <DraftRestoreBanner
          updatedAt={week.entryDraft.updatedAt}
          onDiscard={discardEntryDraft}
          onRestore={restoreEntryDraft}
        />
      ) : null}

      {projectRows.length ? (
        view === "day" && selectedDay ? (
          <DayView
            day={selectedDay}
            days={week.days}
            dailyTotalMinutes={dailyTotals[week.days.indexOf(selectedDay)] ?? 0}
            entries={selectedDayEntries}
            entriesByDay={entriesByDay}
            isPending={isPending}
            projects={projectRows}
            projectsById={projectsById}
            recentProjects={recentProjects}
            runningTimer={week.runningTimer}
            onAddEntry={(localDate) => {
              const project = projectRows[0];
              if (!project) return;

              setEntryModal({
                mode: "create",
                source: "FORM",
                projectId: project.projectId,
                localDate,
                durationMinutes: 60,
              });
            }}
            onDeleteEntry={(entry) =>
              runAction(() => deleteTimeEntryAction({ timeEntryId: entry.id }))
            }
            onEditEntry={(entry) => setEntryModal({ mode: "edit", entry })}
            onSelectDay={setSelectedDayIso}
            onStartTimer={(projectId, description) =>
              runAction(() => startRunningTimerAction({ projectId, description }))
            }
            onStopTimer={() => runAction(stopRunningTimerAction)}
          />
        ) : (
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
                        sum +
                        getCellEntries(entriesByCell, project.projectId, day.isoDate).totalMinutes,
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
                                  setBreakdown({
                                    projectId: project.projectId,
                                    localDate: day.isoDate,
                                  })
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
                          over
                            ? "text-warning"
                            : total
                              ? "text-foreground"
                              : "text-muted-foreground",
                        )}
                      >
                        {formatMinutesAsHours(total) || "0"}
                        {over ? (
                          <WarningTip
                            text={`That is ${formatMinutesAsHours(total)}h in one day.`}
                          />
                        ) : null}
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
                            const cell = getCellEntries(
                              entriesByCell,
                              project.projectId,
                              day.isoDate,
                            );
                            return (
                              <button
                                key={day.isoDate}
                                type="button"
                                disabled={
                                  day.locked || !isProjectAssignableOnDate(project, day.isoDate)
                                }
                                className={cn(
                                  "rounded-[var(--radius-sm)] border border-border bg-background px-1 py-2 text-sm font-semibold disabled:opacity-35",
                                  cell.totalMinutes > 0 &&
                                    "border-accent/35 bg-accent/12 text-accent",
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
              Type time like 3.5, 3:30, 3h 20m, or 200m. Empty cells open the entry form because
              descriptions are required.
            </div>
          </>
        )
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

function GridHeaderCell({
  label,
  noRightBorder = false,
}: {
  label: string;
  noRightBorder?: boolean;
}) {
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

function DraftRestoreBanner({
  updatedAt,
  onDiscard,
  onRestore,
}: {
  updatedAt: string;
  onDiscard: () => void;
  onRestore: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-card text-accent">
          <Info className="size-4" aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold">Unsaved time entry draft</p>
          <p className="text-muted-foreground">Last saved {formatDraftTimestamp(updatedAt)}.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-card px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          onClick={onDiscard}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Discard
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-[color-mix(in_srgb,var(--accent)_88%,black)]"
          onClick={onRestore}
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Restore draft
        </button>
      </div>
    </div>
  );
}

type DayViewProps = {
  day: TimeGridDay;
  days: TimeGridDay[];
  dailyTotalMinutes: number;
  entries: TimeGridEntry[];
  entriesByDay: Map<string, TimeGridEntry[]>;
  isPending: boolean;
  projects: TimeGridAssignedProject[];
  projectsById: Map<string, TimeGridAssignedProject>;
  recentProjects: TimeGridAssignedProject[];
  runningTimer: TimeGridWeek["runningTimer"];
  onAddEntry: (localDate: string) => void;
  onDeleteEntry: (entry: TimeGridEntry) => void;
  onEditEntry: (entry: TimeGridEntry) => void;
  onSelectDay: (localDate: string) => void;
  onStartTimer: (projectId: string, description: string) => void;
  onStopTimer: () => void;
};

function DayView({
  day,
  days,
  dailyTotalMinutes,
  entries,
  entriesByDay,
  isPending,
  projects,
  projectsById,
  recentProjects,
  runningTimer,
  onAddEntry,
  onDeleteEntry,
  onEditEntry,
  onSelectDay,
  onStartTimer,
  onStopTimer,
}: DayViewProps) {
  const sortedEntries = [...entries].sort((a, b) => {
    const aTime = a.startTime ?? "99:99";
    const bTime = b.startTime ?? "99:99";
    return aTime.localeCompare(bTime);
  });

  return (
    <div className="grid gap-4">
      <TimerComposer
        disabled={isPending || !projects.length}
        projects={projects}
        recentProjects={recentProjects}
        runningTimer={runningTimer}
        onStart={onStartTimer}
        onStop={onStopTimer}
      />

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="grid grid-cols-7 gap-1.5 sm:w-auto">
          {days.map((option) => (
            <button
              key={option.isoDate}
              type="button"
              className={cn(
                "rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 text-center transition hover:border-accent/45 hover:bg-accent/10",
                option.isoDate === day.isoDate && "border-accent bg-accent/12 text-accent",
                option.state === "future" && "opacity-65",
              )}
              onClick={() => onSelectDay(option.isoDate)}
            >
              <span className="block font-ui text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                {option.shortLabel}
              </span>
              <span className="block text-base font-semibold">{option.dayNumber}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 sm:justify-end">
          <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Day total
          </span>
          <span
            className={cn(
              "text-[26px] font-semibold",
              dailyTotalMinutes > 1440 ? "text-warning" : "text-foreground",
            )}
          >
            {formatMinutesAsHours(dailyTotalMinutes) || "0"}
            <span className="ml-1 text-[15px] text-muted-foreground">h</span>
          </span>
        </div>
      </div>

      {day.state === "future" ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-warning/30 bg-warning/12 px-4 py-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          This is a future date. Entries are allowed, but they stay flagged.
        </div>
      ) : null}

      {dailyTotalMinutes > 1440 ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-warning/30 bg-warning/12 px-4 py-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          The selected day has more than 24 logged hours.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
        {sortedEntries.length ? (
          sortedEntries.map((entry) => {
            const project = projectsById.get(entry.projectId);
            const warnings = getEntryWarnings(entry, entriesByDay.get(entry.localDate) ?? []);

            if (day.state === "future") warnings.push("Future date");

            return (
              <div
                key={entry.id}
                className={cn(
                  "grid gap-3 border-b border-border p-4 last:border-b-0 sm:grid-cols-[5.5rem_1fr_auto]",
                  warnings.length && "bg-warning/5",
                )}
              >
                <div className="font-ui text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  {entry.startTime && entry.endTime ? (
                    <>
                      <span className="block text-foreground">{entry.startTime}</span>
                      <span className="block">{entry.endTime}</span>
                    </>
                  ) : (
                    <span className="italic">Duration</span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{entry.description}</p>
                    <span className="rounded-[var(--radius-pill)] bg-secondary px-2 py-0.5 font-ui text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      {entry.source.toLowerCase()}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: project?.color ?? "var(--muted-foreground)" }}
                        aria-hidden="true"
                      />
                      {project?.name ?? "Archived project"}
                    </span>
                    <span>·</span>
                    <span className="font-semibold text-foreground">
                      {formatMinutesAsHours(entry.durationMinutes)}h
                    </span>
                  </div>
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

                <div className="flex items-center gap-1 sm:justify-end">
                  <button
                    type="button"
                    disabled={entry.locked || isPending}
                    className="grid size-9 place-items-center rounded-[var(--radius-sm)] text-muted-foreground transition hover:bg-secondary hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Edit entry"
                    onClick={() => onEditEntry(entry)}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={entry.locked || isPending}
                    className="grid size-9 place-items-center rounded-[var(--radius-sm)] text-muted-foreground transition hover:bg-destructive/12 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Delete entry"
                    onClick={() => onDeleteEntry(entry)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
              <Clock3 className="size-6" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-base font-semibold">No entries on this day</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              Start a timer or add an entry for the selected project and day.
            </p>
          </div>
        )}
      </div>

      <div>
        <button
          type="button"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-accent/45 bg-card px-4 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onAddEntry(day.isoDate)}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add entry
        </button>
      </div>
    </div>
  );
}

function TimerComposer({
  disabled,
  projects,
  recentProjects,
  runningTimer,
  onStart,
  onStop,
}: {
  disabled: boolean;
  projects: TimeGridAssignedProject[];
  recentProjects: TimeGridAssignedProject[];
  runningTimer: TimeGridWeek["runningTimer"];
  onStart: (projectId: string, description: string) => void;
  onStop: () => void;
}) {
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.projectId ?? "");
  const selectedProjectId = projectId || (projects[0]?.projectId ?? "");
  const elapsed = useElapsedLabel(runningTimer?.startedAt ?? null);
  const ready = Boolean(selectedProjectId && description.trim());

  if (runningTimer) {
    return (
      <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-accent/35 bg-accent/12 p-4 sm:flex-row sm:items-center">
        <span className="relative flex size-3 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-45" />
          <span className="relative inline-flex size-3 rounded-full bg-accent" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {runningTimer.description || "Tracked with timer"}
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: runningTimer.projectColor }}
              aria-hidden="true"
            />
            {runningTimer.projectName}
          </p>
        </div>
        <span className="text-2xl font-semibold text-accent">{elapsed}</span>
        <button
          type="button"
          disabled={disabled}
          className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground transition hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onStop}
        >
          <Square className="size-3.5 fill-current" aria-hidden="true" />
          Stop
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-4">
      <div className="grid gap-3 lg:grid-cols-[auto_1fr_16rem_auto] lg:items-center">
        <PlayCircle className="hidden size-5 text-muted-foreground lg:block" aria-hidden="true" />
        <input
          value={description}
          placeholder="What are you working on?"
          className={inputClassName(false)}
          onChange={(event) => setDescription(event.target.value)}
        />
        <select
          value={selectedProjectId}
          className={inputClassName(false)}
          onChange={(event) => setProjectId(event.target.value)}
        >
          {projects.map((project) => (
            <option key={project.projectId} value={project.projectId}>
              {project.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={disabled || !ready}
          className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-gradient-to-br from-primary to-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => {
            onStart(selectedProjectId, description);
            setDescription("");
          }}
        >
          <Play className="size-4 fill-current" aria-hidden="true" />
          Start
        </button>
      </div>

      {recentProjects.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Recent
          </span>
          {recentProjects.slice(0, 4).map((project) => (
            <button
              key={project.projectId}
              type="button"
              className={cn(
                "inline-flex items-center gap-2 rounded-[var(--radius-pill)] border px-3 py-1.5 text-sm font-medium transition",
                selectedProjectId === project.projectId
                  ? "border-accent bg-accent/12 text-accent"
                  : "border-border bg-background text-foreground hover:border-accent/35 hover:bg-accent/10",
              )}
              onClick={() => setProjectId(project.projectId)}
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: project.color }}
                aria-hidden="true"
              />
              {project.name}
            </button>
          ))}
        </div>
      ) : null}
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
  const initialTimingMode: TimeEntryTimingMode =
    state.mode === "edit" && state.entry.startTime && state.entry.endTime
      ? "INTERVAL"
      : state.mode === "create" && state.timingMode
        ? state.timingMode
        : "DURATION";
  const initialDurationText =
    state.mode === "create" && state.durationText
      ? state.durationText
      : formatMinutesAsHours(initialDuration) || "1";
  const [projectId, setProjectId] = useState(initialProjectId);
  const [localDate, setLocalDate] = useState(initialLocalDate);
  const [timingMode, setTimingMode] = useState<TimeEntryTimingMode>(initialTimingMode);
  const [durationText, setDurationText] = useState(initialDurationText);
  const [startTime, setStartTime] = useState(
    state.mode === "edit" ? (state.entry.startTime ?? "09:00") : (state.startTime ?? "09:00"),
  );
  const [endTime, setEndTime] = useState(
    state.mode === "edit" ? (state.entry.endTime ?? "10:00") : (state.endTime ?? "10:00"),
  );
  const [description, setDescription] = useState(
    state.mode === "edit" ? state.entry.description : (state.description ?? ""),
  );
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [fieldErrors, setFieldErrors] = useState<TimeTrackingActionState["fieldErrors"]>();
  const project = projects.find((item) => item.projectId === projectId) ?? projects[0];
  const parsedMinutes = parseDurationToMinutes(durationText);
  const intervalMinutes = calculateIntervalMinutes(startTime, endTime);
  const createDraftKey =
    state.mode === "create" ? (state.draftKey ?? TIME_ENTRY_FORM_DRAFT_KEY) : null;
  const createDraftSource = state.mode === "create" ? state.source : null;
  const createDraftPrefill = state.mode === "create" ? state.prefill : undefined;
  const ready = Boolean(
    projectId &&
    localDate &&
    description.trim() &&
    (timingMode === "INTERVAL" ? intervalMinutes > 0 : parsedMinutes && parsedMinutes > 0),
  );

  useEffect(() => {
    if (!createDraftKey || !createDraftSource || !description.trim()) return;

    let cancelled = false;
    const timerId = window.setTimeout(() => {
      void saveTimeEntryDraftAction({
        draftKey: createDraftKey,
        payload: {
          kind: "time-entry-form",
          version: 1,
          source: createDraftSource,
          projectId,
          localDate,
          timingMode,
          durationText,
          startTime,
          endTime,
          description,
          prefill: createDraftPrefill,
        },
      }).then((result) => {
        if (cancelled) return;
        setDraftStatus(result.status === "success" ? "saved" : "error");
      });
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [
    createDraftKey,
    createDraftPrefill,
    createDraftSource,
    description,
    durationText,
    endTime,
    localDate,
    projectId,
    startTime,
    timingMode,
  ]);

  function markDraftDirty(nextDescription = description) {
    if (!createDraftKey) return;
    setDraftStatus(nextDescription.trim() ? "saving" : "idle");
  }

  function saveCurrentDraft() {
    if (!createDraftKey || !createDraftSource || !description.trim()) return;

    void saveTimeEntryDraftAction({
      draftKey: createDraftKey,
      payload: {
        kind: "time-entry-form",
        version: 1,
        source: createDraftSource,
        projectId,
        localDate,
        timingMode,
        durationText,
        startTime,
        endTime,
        description,
        prefill: createDraftPrefill,
      },
    });
  }

  function closeModal() {
    saveCurrentDraft();
    onClose();
  }

  const dialogRef = useModalFocusTrap<HTMLDivElement>(closeModal);

  function submit() {
    const durationMinutes = parseDurationToMinutes(durationText);

    if (timingMode === "DURATION" && (!durationMinutes || durationMinutes <= 0)) {
      setFieldErrors({ durationMinutes: "Duration must be greater than zero." });
      return;
    }

    if (timingMode === "INTERVAL" && intervalMinutes <= 0) {
      setFieldErrors({ endTime: "End time must be after start time." });
      return;
    }

    startTransition(async () => {
      const durationPayloadMinutes = durationMinutes ?? 0;
      const timingPayload =
        timingMode === "INTERVAL"
          ? {
              timingMode,
              startTime,
              endTime,
            }
          : {
              timingMode,
              durationMinutes: durationPayloadMinutes,
              startTime: null,
              endTime: null,
            };
      const result =
        state.mode === "edit"
          ? await updateTimeEntryAction({
              timeEntryId: state.entry.id,
              projectId,
              localDate,
              description,
              ...timingPayload,
            })
          : await createTimeEntryAction({
              projectId,
              localDate,
              description,
              source: state.source,
              ...timingPayload,
            });

      setFieldErrors(result.fieldErrors);

      if (result.status === "success" && createDraftKey) {
        await clearTimeEntryDraftAction({ draftKey: createDraftKey });
      }

      onDone(result);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={closeModal}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="time-entry-dialog-title"
        tabIndex={-1}
        className="max-h-[92vh] w-full max-w-[540px] overflow-y-auto rounded-[var(--radius-xl)] border border-border bg-card shadow-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <h2 id="time-entry-dialog-title" className="text-xl font-semibold">
            {state.mode === "edit" ? "Edit time entry" : "New time entry"}
          </h2>
          <button
            type="button"
            className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            onClick={closeModal}
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
              onChange={(event) => {
                setDescription(event.target.value);
                markDraftDirty(event.target.value);
              }}
            />
          </Field>

          <Field label="Project" required error={fieldErrors?.projectId}>
            <select
              value={projectId}
              className={inputClassName(Boolean(fieldErrors?.projectId))}
              onChange={(event) => {
                setProjectId(event.target.value);
                markDraftDirty();
              }}
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
                onChange={(event) => {
                  setLocalDate(event.target.value);
                  markDraftDirty();
                }}
              />
            </Field>
            <Field label="Mode" required>
              <div className="inline-flex rounded-[var(--radius-pill)] border border-border bg-secondary p-1">
                <button
                  type="button"
                  className={cn(
                    "rounded-[var(--radius-pill)] px-3 py-2 text-sm font-semibold transition",
                    timingMode === "DURATION"
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground",
                  )}
                  onClick={() => {
                    setTimingMode("DURATION");
                    markDraftDirty();
                  }}
                >
                  Duration
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-[var(--radius-pill)] px-3 py-2 text-sm font-semibold transition",
                    timingMode === "INTERVAL"
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground",
                  )}
                  onClick={() => {
                    setTimingMode("INTERVAL");
                    markDraftDirty();
                  }}
                >
                  Interval
                </button>
              </div>
            </Field>
          </div>

          {timingMode === "DURATION" ? (
            <Field label="Duration" required error={fieldErrors?.durationMinutes}>
              <input
                inputMode="decimal"
                value={durationText}
                placeholder="3h 20m"
                className={inputClassName(Boolean(fieldErrors?.durationMinutes))}
                onChange={(event) => {
                  setDurationText(event.target.value);
                  markDraftDirty();
                }}
              />
            </Field>
          ) : (
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label="Start" required error={fieldErrors?.startTime}>
                <input
                  type="time"
                  value={startTime}
                  className={inputClassName(Boolean(fieldErrors?.startTime))}
                  onChange={(event) => {
                    setStartTime(event.target.value);
                    markDraftDirty();
                  }}
                />
              </Field>
              <Field label="End" required error={fieldErrors?.endTime}>
                <input
                  type="time"
                  value={endTime}
                  className={inputClassName(Boolean(fieldErrors?.endTime))}
                  onChange={(event) => {
                    setEndTime(event.target.value);
                    markDraftDirty();
                  }}
                />
              </Field>
              <div className="pb-2 text-xl font-semibold text-accent">
                {formatMinutesAsHours(intervalMinutes)}h
              </div>
            </div>
          )}

          {timingMode === "DURATION" && parsedMinutes && parsedMinutes > 1440 ? (
            <div className="flex items-center gap-2 text-sm text-warning">
              <AlertTriangle className="size-4" aria-hidden="true" />
              That is more than 24h. This is a warning, not a blocker.
            </div>
          ) : null}

          {timingMode === "INTERVAL" && intervalMinutes >= 480 ? (
            <div className="flex items-center gap-2 text-sm text-warning">
              <AlertTriangle className="size-4" aria-hidden="true" />
              This is a long continuous session. This is a warning, not a blocker.
            </div>
          ) : null}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="size-4" aria-hidden="true" />
            Project and description are required. Future dates and long days save with warnings.
          </div>

          {createDraftKey && description.trim() && draftStatus !== "idle" ? (
            <div
              className={cn(
                "font-ui text-[11px] font-semibold uppercase tracking-[0.08em]",
                draftStatus === "error" ? "text-destructive" : "text-muted-foreground",
              )}
              aria-live="polite"
            >
              {draftStatus === "saving"
                ? "Saving draft..."
                : draftStatus === "saved"
                  ? "Draft saved"
                  : "Draft not saved"}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            className="rounded-[var(--radius-md)] border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
            onClick={closeModal}
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
            <div className="py-8 text-center text-sm text-muted-foreground">No entries yet.</div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="size-4" aria-hidden="true" />A description is required per entry.
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

function calculateIntervalMinutes(startTime: string, endTime: string) {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);

  if (start === null || end === null) return 0;

  const minutes = end > start ? end - start : end + 1440 - start;
  return minutes > 0 ? minutes : 0;
}

function parseTimeToMinutes(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;

  const [hourValue, minuteValue] = value.split(":");
  const hour = Number.parseInt(hourValue ?? "", 10);
  const minute = Number.parseInt(minuteValue ?? "", 10);

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 + minute;
}

function useModalFocusTrap<T extends HTMLElement>(onClose: () => void) {
  const containerRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const container = containerRef.current;
    const focusableElements = getFocusableElements(container);

    (focusableElements[0] ?? container)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  return containerRef;
}

function getFocusableElements(container: HTMLElement | null) {
  if (!container) return [];

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "[tabindex]:not([tabindex='-1'])",
      ].join(","),
    ),
  ).filter((element) => element.offsetParent !== null);
}

function useElapsedLabel(startedAt: string | null) {
  const nowSeconds = useClientClock();

  if (!startedAt || nowSeconds === null) return "0:00";

  return formatElapsed(Math.max(0, nowSeconds * 1000 - Date.parse(startedAt)));
}

function useClientClock() {
  return useSyncExternalStore(subscribeToClock, getClockSnapshot, getServerClockSnapshot);
}

function subscribeToClock(onStoreChange: () => void) {
  const timerId = window.setInterval(onStoreChange, 1000);
  return () => window.clearInterval(timerId);
}

function getClockSnapshot() {
  return Math.floor(Date.now() / 1000);
}

function getServerClockSnapshot() {
  return null;
}

function formatElapsed(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatDraftTimestamp(value: string) {
  return value.replace("T", " ").slice(0, 16);
}

function formatMinutesAsHours(minutes: number) {
  if (!minutes) return "";
  return Number((minutes / 60).toFixed(2)).toString();
}
