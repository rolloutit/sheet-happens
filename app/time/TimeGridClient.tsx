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
  MessageSquare,
  Moon,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  Square,
  Trash2,
  X,
} from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useLocale, useTranslations } from "next-intl";

import { DayAgenda, type DayAgendaEntry } from "@/src/components/sheet/DayAgenda";
import {
  WeekAgenda,
  type WeekAgendaDay,
  type WeekAgendaEntry,
} from "@/src/components/sheet/WeekAgenda";
import { Button } from "@/src/components/ui/Button";
import { Combobox } from "@/src/components/ui/Combobox";
import { DatePicker } from "@/src/components/ui/DatePicker";
import { focusChromeClassName } from "@/src/components/ui/focusRing";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import { TimeInput } from "@/src/components/ui/TimeInput";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/Dialog";
import { formatDurationForInput, parseDurationToMinutes } from "@/src/lib/duration";
import {
  formatHours as formatDurationHours,
  formatHoursWithUnit as formatDurationHoursWithUnit,
  type DurationDisplayFormat,
} from "@/src/lib/formatting";
import { DAILY_HARD_LIMIT_MINUTES, DAILY_SOFT_WARNING_MINUTES } from "@/src/lib/time-entry-limits";
import { usePickerLabels } from "@/src/i18n/picker-labels";
import { useElapsedLabel } from "@/src/lib/use-elapsed-label";
import { useOverlayParam } from "@/src/lib/use-overlay-param";
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
  stopRunningTimerAction,
  unmarkInactiveProjectWeekAction,
  updateTimeEntryAction,
} from "./actions";
import {
  TIME_ENTRY_FORM_DRAFT_KEY,
  type TimeEntryTimingMode,
  type TimeTrackingActionState,
} from "./actions.types";
import { TimerCreateDialog } from "./TimerCreateDialog";
import { TIME_OVERLAY_PARAM, TIMER_OVERLAY_VALUE } from "./time-overlays";
import { TimeZoomShell } from "./TimeZoomShell";
import { useTimeZoom } from "./use-time-zoom";
import { DAY_PARAM, ZOOM_PARAM, zoomLevels, type ZoomLevel } from "./zoom";

const GRID_ENTRY_IDLE_OPEN_DELAY_MS = 900;

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

type PendingQuickAction =
  | {
      type: "copyPreviousDay";
      sourceDate: string;
      targetDate: string;
    }
  | {
      type: "duplicatePreviousWeek";
      sourceWeekEnd: string;
      sourceWeekStart: string;
      targetWeekEnd: string;
      targetWeekStart: string;
    };

type TimeGridClientProps = {
  week: TimeGridWeek;
  durationDisplayFormat: DurationDisplayFormat;
};

type TimeTrackingTranslator = ReturnType<typeof useTranslations>;

const DurationDisplayContext = createContext<DurationDisplayFormat>("DECIMAL_HOURS");

export function TimeGridClient({ week, durationDisplayFormat }: TimeGridClientProps) {
  return (
    <DurationDisplayContext.Provider value={durationDisplayFormat}>
      <TimeGridContent week={week} />
    </DurationDisplayContext.Provider>
  );
}

function TimeGridContent({ week }: { week: TimeGridWeek }) {
  const router = useRouter();
  const t = useTranslations("TimeTracking");
  const locale = useLocale();
  const durationDisplayFormat = useContext(DurationDisplayContext);
  const { formatMinutesAsHours, formatMinutesWithUnit } = useDurationFormatting();
  const [isPending, startTransition] = useTransition();
  const { level, selectedDayIso, setLevel, setSelectedDayIso, zoomToDay } = useTimeZoom(week);
  const [notice, setNotice] = useState<Notice>(null);
  const [entryModal, setEntryModal] = useState<EntryModalState>(null);
  const [breakdown, setBreakdown] = useState<BreakdownState>(null);
  const [pendingQuickAction, setPendingQuickAction] = useState<PendingQuickAction | null>(null);
  const [, setTimerOpen] = useOverlayParam(TIME_OVERLAY_PARAM, TIMER_OVERLAY_VALUE);

  const inactiveProjectIds = useMemo(
    () => new Set(week.inactiveWeeks.map((inactiveWeek) => inactiveWeek.projectId)),
    [week.inactiveWeeks],
  );
  const entriesByCell = useMemo(() => groupEntriesByCell(week.entries), [week.entries]);
  const entriesByDay = useMemo(() => groupEntriesByDay(week.entries), [week.entries]);
  const weekHasLockedPeriod = week.lockedMonthStarts.length > 0;
  const adminModifiedEntryCount = week.entries.filter((entry) => entry.adminModification).length;

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
  const selectedDayTotalMinutes = selectedDay
    ? (dailyTotals[week.days.indexOf(selectedDay)] ?? 0)
    : 0;

  /**
   * The day and week levels are presentational: they take rows and report intent. Resolving the
   * project, the warnings and the admin note happens once, here, so both levels show the same
   * entry the same way and neither has to know what a `TimeGridEntry` is.
   */
  function describeEntry(entry: TimeGridEntry) {
    const project = projectsById.get(entry.projectId);

    return {
      id: entry.id,
      projectName: project?.name ?? t("labels.archivedProject"),
      projectColor: project?.color ?? "var(--muted-foreground)",
      description: entry.description,
      durationMinutes: entry.durationMinutes,
      startTime: entry.startTime,
      endTime: entry.endTime,
      locked: entry.locked,
      warnings: getEntryWarnings(entry, entriesByDay.get(entry.localDate) ?? [], t),
    };
  }

  const dayAgendaEntries: DayAgendaEntry[] = selectedDayEntries.map((entry) => {
    const described = describeEntry(entry);
    const { adminModification } = entry;

    return {
      ...described,
      sourceLabel: formatEntrySource(entry.source, t),
      warnings:
        selectedDay?.state === "future"
          ? [...described.warnings, t("warnings.futureDate")]
          : described.warnings,
      adminNotice: adminModification
        ? {
            changedBy: t("adminModification.changedBy", {
              name: adminModification.modifiedByName ?? t("adminModification.adminFallback"),
              date: formatAdminModifiedAt(adminModification, locale),
            }),
            reason: t("adminModification.reason", { reason: adminModification.reason }),
          }
        : null,
    };
  });

  const weekAgendaDays: WeekAgendaDay[] = week.days.map((day, dayIndex) => ({
    isoDate: day.isoDate,
    label: day.label,
    shortLabel: day.shortLabel,
    dayNumber: day.dayNumber,
    state: day.state,
    locked: day.locked,
    totalMinutes: dailyTotals[dayIndex] ?? 0,
    entries: (entriesByDay.get(day.isoDate) ?? []).map((entry): WeekAgendaEntry => ({
      ...describeEntry(entry),
      adminModified: Boolean(entry.adminModification),
    })),
  }));

  function addEntryOnDay(localDate: string) {
    const project = projectRows[0];
    if (!project) return;

    setEntryModal({
      mode: "create",
      source: "FORM",
      projectId: project.projectId,
      localDate,
      durationMinutes: 60,
    });
  }

  function editEntryById(entryId: string) {
    const entry = week.entries.find((candidate) => candidate.id === entryId);
    if (entry) setEntryModal({ mode: "edit", entry });
  }

  function deleteEntryById(entryId: string) {
    runAction(() => deleteTimeEntryAction({ timeEntryId: entryId }));
  }

  /**
   * Changing weeks is a real navigation — new data, new server queries — unlike changing level or
   * day, which the axis writes with `replaceState`. Both of those still have to survive it: the
   * level because losing it on every `]` is exactly the "constant clicking" the axis removes, and
   * the day because the same weekday in the next week is the only mapping that reads as continuous.
   */
  function navigateToWeek(weekStart: string, dayIso?: string) {
    const weekdayIndex = Math.max(
      0,
      week.days.findIndex((day) => day.isoDate === selectedDayIso),
    );
    const params = new URLSearchParams({
      week: weekStart,
      [ZOOM_PARAM]: level,
      [DAY_PARAM]: dayIso ?? shiftIsoDate(weekStart, weekdayIndex),
    });

    router.push(`/time?${params.toString()}` as Route);
  }

  function goToToday() {
    if (week.weekStart === week.thisWeek) {
      setSelectedDayIso(week.todayIso);
      return;
    }

    navigateToWeek(week.thisWeek, week.todayIso);
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

  function confirmQuickAction() {
    const action = pendingQuickAction;
    if (!action) return;

    setPendingQuickAction(null);

    if (action.type === "copyPreviousDay") {
      runAction(() => copyPreviousDayEntriesAction({ targetDate: action.targetDate }));
      return;
    }

    runAction(() => duplicatePreviousWeekAction({ weekStartDate: action.targetWeekStart }));
  }

  function handleCellCommit(project: TimeGridAssignedProject, day: TimeGridDay, rawValue: string) {
    const parsedMinutes = parseDurationToMinutes(rawValue);
    const cell = getCellEntries(entriesByCell, project.projectId, day.isoDate);

    if (parsedMinutes === null) {
      setNotice({ tone: "error", message: t("errors.invalidDurationFormat") });
      return;
    }

    if (parsedMinutes <= 0) {
      if (cell.entries.length === 1 && !cell.entries[0].locked) {
        runAction(() => deleteTimeEntryAction({ timeEntryId: cell.entries[0].id }));
      }
      return;
    }

    if (parsedMinutes > DAILY_HARD_LIMIT_MINUTES) {
      setNotice({ tone: "error", message: t("warnings.durationOver24Blocked") });
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <SegmentedControl
            label={t("zoom.controlLabel")}
            value={level}
            onValueChange={(value) => setLevel(value as ZoomLevel)}
            items={zoomLevels.map((zoomLevel) => ({
              value: zoomLevel,
              label: t(`zoom.${zoomLevel}`),
            }))}
          />
          <span className="hidden text-xs text-muted-foreground lg:inline">
            {t("zoom.keyboardHint")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* `Button` carries `disabled:pointer-events-none`, so a title on the button itself would
              never fire — the wrapper is what makes the disabled reason reachable on hover. */}
          <span title={week.runningTimer ? t("tooltips.stopTimerFirst") : undefined}>
            <Button
              type="button"
              variant="soft"
              icon={Play}
              disabled={Boolean(week.runningTimer) || !projectRows.length || isPending}
              onClick={() => setTimerOpen(true)}
            >
              {t("actions.newTimer")}
            </Button>
          </span>
          <Button
            type="button"
            variant="cta"
            icon={Plus}
            disabled={!projectRows.length || isPending}
            onClick={() => {
              const project = projectRows[0];
              if (!project) return;

              setEntryModal({
                mode: "create",
                source: "FORM",
                projectId: project.projectId,
                // The day strip is persistent chrome now, so the selected day is visible at every
                // level — which makes it the honest default for a new entry at every level too.
                localDate: targetDate,
                durationMinutes: 60,
              });
            }}
          >
            {t("actions.newEntry")}
          </Button>
        </div>
      </div>

      {/* Above the week navigation and outside the view branch below, so a running timer is on
          screen in the grid as well as the day list. */}
      {week.runningTimer ? (
        <RunningTimerCard
          disabled={isPending}
          runningTimer={week.runningTimer}
          onStop={() => runAction(stopRunningTimerAction)}
          t={t}
        />
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-border bg-card p-1">
            <button
              type="button"
              className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              aria-label={t("actions.previousWeek")}
              onClick={() => navigateToWeek(week.previousWeek)}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <span className="px-3 text-sm font-medium text-foreground">{week.weekLabel}</span>
            <button
              type="button"
              className="grid size-8 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              aria-label={t("actions.nextWeek")}
              onClick={() => navigateToWeek(week.nextWeek)}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>

          {week.weekStart === week.thisWeek ? (
            <span className="rounded-[var(--radius-pill)] bg-accent-soft px-3 py-1.5 font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">
              {t("labels.thisWeek")}
            </span>
          ) : (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary"
              onClick={goToToday}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              {t("labels.thisWeek")}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 lg:justify-end">
          <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {t("labels.weekTotal")}
          </span>
          <span className="text-[26px] font-semibold text-foreground">
            {formatMinutesWithUnit(weekTotal)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isPending || !selectedDay || selectedDay.locked}
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-50"
          title={
            selectedDay ? t("tooltips.copyPreviousDay", { date: selectedDay.isoDate }) : undefined
          }
          onClick={() =>
            setPendingQuickAction({
              type: "copyPreviousDay",
              sourceDate: shiftIsoDate(targetDate, -1),
              targetDate,
            })
          }
        >
          <Copy className="size-4" aria-hidden="true" />
          {t("actions.sameAsYesterday")}
        </button>
        <button
          type="button"
          disabled={isPending || weekHasLockedPeriod}
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-50"
          title={t("tooltips.duplicatePreviousWeek")}
          onClick={() =>
            setPendingQuickAction({
              type: "duplicatePreviousWeek",
              sourceWeekStart: shiftIsoDate(week.weekStart, -7),
              sourceWeekEnd: shiftIsoDate(week.weekStart, -1),
              targetWeekStart: week.weekStart,
              targetWeekEnd: week.weekEnd,
            })
          }
        >
          <Copy className="size-4" aria-hidden="true" />
          {t("actions.duplicateLastWeek")}
        </button>
        <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {t("labels.assigned")}
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
              {t("labels.recent")}
            </span>
            {recentProjects.slice(0, 3).map((project) => (
              <button
                key={project.projectId}
                type="button"
                className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition hover:border-accent-line hover:bg-accent-soft"
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
              ? "border-success/35 bg-success-soft text-success"
              : "border-destructive/35 bg-destructive-soft text-destructive",
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

      {adminModifiedEntryCount > 0 ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-accent-line bg-accent-soft px-4 py-3 text-sm text-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          <div>
            <span className="font-semibold">
              {t("adminModification.weekTitle", { count: adminModifiedEntryCount })}
            </span>{" "}
            <span className="text-muted-foreground">{t("adminModification.weekDescription")}</span>
          </div>
        </div>
      ) : null}

      {weekHasLockedPeriod ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <span className="font-semibold">{t("locked.title")}</span> {t("locked.description")}
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
        <TimeZoomShell
          days={week.days}
          todayIso={week.todayIso}
          dayTotalMinutes={selectedDayTotalMinutes}
          formatMinutes={formatMinutesWithUnit}
          onPreviousPeriod={() => navigateToWeek(week.previousWeek)}
          onNextPeriod={() => navigateToWeek(week.nextWeek)}
          onToday={goToToday}
          renderLevel={(activeLevel) =>
            activeLevel === "day" ? (
              <DayAgenda
                isoDate={targetDate}
                dayState={selectedDay?.state ?? "normal"}
                totalMinutes={selectedDayTotalMinutes}
                capacityMinutes={DAILY_SOFT_WARNING_MINUTES}
                entries={dayAgendaEntries}
                locale={locale}
                durationDisplayFormat={durationDisplayFormat}
                disabled={isPending}
                labels={{
                  durationMode: t("mode.duration"),
                  futureDay: t("warnings.futureDateAllowed"),
                  overCapacity: t("warnings.dayOver8"),
                  emptyTitle: t("day.emptyTitle"),
                  emptyDescription: t("day.emptyDescription"),
                  addEntry: t("actions.addEntry"),
                  editEntry: (entry) => t("week.editEntryNamed", { entry: entry.description }),
                  deleteEntry: (entry) => t("week.deleteEntryNamed", { entry: entry.description }),
                }}
                onAddEntry={addEntryOnDay}
                onEditEntry={(entry) => editEntryById(entry.id)}
                onDeleteEntry={(entry) => deleteEntryById(entry.id)}
              />
            ) : activeLevel === "week" ? (
              <WeekAgenda
                days={weekAgendaDays}
                selectedDayIso={targetDate}
                locale={locale}
                durationDisplayFormat={durationDisplayFormat}
                disabled={isPending}
                labels={{
                  openDay: (day) => t("zoom.zoomToDay", { day: day.label }),
                  expandDay: (day) => t("week.expandDay", { day: day.label }),
                  columnEmpty: t("week.columnEmpty"),
                  addEntry: (day) => t("week.addEntryOn", { day: day.label }),
                  editEntry: (entry) => t("week.editEntryNamed", { entry: entry.description }),
                  deleteEntry: (entry) => t("week.deleteEntryNamed", { entry: entry.description }),
                  adminModified: t("week.adminModified"),
                }}
                onSelectDay={setSelectedDayIso}
                onZoomToDay={zoomToDay}
                onAddEntry={addEntryOnDay}
                onEditEntry={(entry) => editEntryById(entry.id)}
                onDeleteEntry={(entry) => deleteEntryById(entry.id)}
              />
            ) : (
              <>
                <div className="hidden overflow-x-auto lg:block">
                  <div className="min-w-[900px] overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
                    <div className="grid grid-cols-[minmax(190px,1.5fr)_repeat(7,minmax(54px,1fr))_92px]">
                      <GridHeaderCell label={t("grid.projects")} />
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
                          <span className="mt-0.5 block text-[15px] font-medium">
                            {day.dayNumber}
                          </span>
                        </div>
                      ))}
                      <GridHeaderCell label={t("grid.total")} noRightBorder />

                      {projectRows.map((project) => {
                        const inactive = inactiveProjectIds.has(project.projectId);
                        const rowTotal = week.days.reduce(
                          (sum, day) =>
                            sum +
                            getCellEntries(entriesByCell, project.projectId, day.isoDate)
                              .totalMinutes,
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
                                    ? t("inactive.undo")
                                    : canToggleInactive
                                      ? t("inactive.mark")
                                      : t("inactive.removeEntriesFirst")
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
                                    cell={getCellEntries(
                                      entriesByCell,
                                      project.projectId,
                                      day.isoDate,
                                    )}
                                    disabled={
                                      isPending ||
                                      day.locked ||
                                      !isProjectAssignableOnDate(project, day.isoDate)
                                    }
                                    onCommit={(rawValue) =>
                                      handleCellCommit(project, day, rawValue)
                                    }
                                    onOpenBreakdown={() =>
                                      setBreakdown({
                                        projectId: project.projectId,
                                        localDate: day.isoDate,
                                      })
                                    }
                                    t={t}
                                  />
                                ))}
                                <div className="flex min-h-14 items-center justify-center border-b border-border text-base font-semibold">
                                  {formatMinutesAsHours(rowTotal)}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}

                      <div className="flex min-h-[52px] items-center border-r border-border bg-secondary px-3 font-ui text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                        {t("grid.dailyTotal")}
                      </div>
                      {week.days.map((day, dayIndex) => {
                        const total = dailyTotals[dayIndex] ?? 0;
                        const over = total > DAILY_SOFT_WARNING_MINUTES;

                        return (
                          <div
                            key={day.isoDate}
                            className={cn(
                              "relative flex min-h-[52px] items-center justify-center gap-1 border-r border-border bg-secondary text-sm font-semibold",
                              day.state === "today" && "bg-accent-soft",
                              over
                                ? "text-warning"
                                : total
                                  ? "text-foreground"
                                  : "text-muted-foreground",
                            )}
                          >
                            {formatMinutesAsHours(total)}
                            {over ? (
                              <WarningTip
                                text={t("warnings.dailyTotalExact", {
                                  hours: formatMinutesWithUnit(total),
                                })}
                              />
                            ) : null}
                          </div>
                        );
                      })}
                      <div className="flex min-h-[52px] items-center justify-center bg-secondary text-[17px] font-semibold text-accent">
                        {formatMinutesAsHours(weekTotal)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* The day row this level used to carry on mobile is now the persistent day strip
                above every level, so the grid renders only its project rows here. */}
                <div className="grid gap-3 lg:hidden">
                  <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
                    {projectRows.map((project) => {
                      const inactive = inactiveProjectIds.has(project.projectId);
                      return (
                        <div
                          key={project.projectId}
                          className="border-b border-border last:border-b-0"
                        >
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
                                {t("actions.undo")}
                              </button>
                            ) : null}
                          </div>
                          {inactive ? (
                            <div className="px-4 pb-4 text-sm italic text-muted-foreground">
                              {t("inactive.title")}
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
                                        "border-accent-line bg-accent-soft text-accent",
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
                                    {formatMinutesAsHours(cell.totalMinutes)}
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
                  {t("help.durationFormats")}
                </div>
              </>
            )
          }
        />
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-border bg-card px-6 py-12 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
            <Clock3 className="size-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">{t("empty.title")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {t("empty.description")}
          </p>
        </div>
      )}

      <TimerCreateDialog
        projects={projectRows}
        recentProjects={recentProjects}
        onStarted={refreshWithResult}
      />

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
          t={t}
        />
      ) : null}

      {breakdown && breakdownProject && breakdownDay ? (
        <BreakdownDialog
          day={breakdownDay}
          entries={breakdownEntries}
          entriesByDay={entriesByDay}
          project={breakdownProject}
          onAdd={() => {
            setBreakdown(null);
            setEntryModal({
              mode: "create",
              source: "GRID",
              projectId: breakdownProject.projectId,
              localDate: breakdownDay.isoDate,
              durationMinutes: 60,
              prefill: true,
            });
          }}
          onClose={() => setBreakdown(null)}
          onDelete={(entry) => runAction(() => deleteTimeEntryAction({ timeEntryId: entry.id }))}
          onEdit={(entry) => {
            setBreakdown(null);
            setEntryModal({ mode: "edit", entry });
          }}
          t={t}
        />
      ) : null}

      <QuickActionConfirmDialog
        action={pendingQuickAction}
        pending={isPending}
        onCancel={() => setPendingQuickAction(null)}
        onConfirm={confirmQuickAction}
        t={t}
      />
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
  t: TimeTrackingTranslator;
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
  t,
}: TimeGridCellProps) {
  const { formatMinutesAsHours, formatMinutesForInput } = useDurationFormatting();
  const simpleEntry =
    cell.entries.length === 1 && isSimpleDurationEntry(cell.entries[0]) ? cell.entries[0] : null;
  const canInlineEdit = !disabled && !cell.locked && (cell.entries.length === 0 || simpleEntry);
  const warningTexts = getCellWarnings(
    {
      day,
      dayTotalMinutes,
      entriesByDay,
      cell,
    },
    t,
  );
  const idleEditorTimerRef = useRef<number | null>(null);
  const skipNextBlurCommitValueRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (idleEditorTimerRef.current !== null) {
        window.clearTimeout(idleEditorTimerRef.current);
      }
    };
  }, []);

  function clearIdleEditorTimer() {
    if (idleEditorTimerRef.current !== null) {
      window.clearTimeout(idleEditorTimerRef.current);
      idleEditorTimerRef.current = null;
    }
  }

  function scheduleIdleEditorOpen(input: HTMLInputElement) {
    clearIdleEditorTimer();

    if (cell.entries.length !== 0) return;

    const parsedMinutes = parseDurationToMinutes(input.value);
    if (parsedMinutes === null || parsedMinutes <= 0) return;

    idleEditorTimerRef.current = window.setTimeout(() => {
      if (document.activeElement !== input) return;

      const currentValue = input.value;
      const currentMinutes = parseDurationToMinutes(currentValue);
      if (currentMinutes === null || currentMinutes <= 0) return;

      skipNextBlurCommitValueRef.current = currentValue;
      onCommit(currentValue);
    }, GRID_ENTRY_IDLE_OPEN_DELAY_MS);
  }

  function commitOnBlur(rawValue: string) {
    clearIdleEditorTimer();

    if (skipNextBlurCommitValueRef.current === rawValue) {
      skipNextBlurCommitValueRef.current = null;
      return;
    }

    onCommit(rawValue);
  }

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
          "relative flex min-h-14 items-center justify-center gap-1 border-b border-r border-border text-[13px] font-semibold transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60",
          day.state === "today" && "bg-accent-soft",
          warningTexts.length > 0 && "text-warning",
        )}
        onClick={onOpenBreakdown}
      >
        {formatMinutesAsHours(cell.totalMinutes)}
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
        day.state === "today" && "bg-accent-soft",
      )}
    >
      <input
        key={`${cell.totalMinutes}:${cell.entries.map((entry) => entry.updatedAt).join(":")}`}
        inputMode="text"
        defaultValue={formatMinutesForInput(cell.totalMinutes)}
        placeholder="0"
        disabled={disabled}
        aria-label={`${project.name}, ${day.label}`}
        // An inset ring rather than the global outline or a border brighten: the cell's own edge is
        // only the shared bottom/right hairline of the grid, so there is no full border to brighten,
        // and an outward outline would spill over the neighbouring cells.
        className={cn(
          "h-full min-h-14 w-full border-0 bg-transparent px-1 text-center text-[13px] font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:text-muted-foreground",
          warningTexts.length > 0 && "text-warning",
        )}
        onChange={(event) => scheduleIdleEditorOpen(event.currentTarget)}
        onBlur={(event) => commitOnBlur(event.currentTarget.value)}
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
          title={
            cell.needsDescription ? t("warnings.descriptionNeeded") : t("warnings.descriptionSaved")
          }
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
  const t = useTranslations("TimeTracking");

  return (
    <div className="col-span-8 flex min-h-14 items-center gap-3 border-b border-border bg-[repeating-linear-gradient(135deg,transparent,transparent_8px,var(--secondary)_8px,var(--secondary)_16px)] px-4">
      <Moon className="size-4 text-muted-foreground" aria-hidden="true" />
      <span className="text-sm font-semibold text-muted-foreground">{t("inactive.title")}</span>
      <span className="text-xs text-muted-foreground">· {t("inactive.description")}</span>
      <button
        type="button"
        className="ml-auto text-sm font-semibold text-accent hover:underline"
        onClick={onUndo}
      >
        {t("actions.undo")}
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
  const t = useTranslations("TimeTracking");

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-card text-accent">
          <Info className="size-4" aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold">{t("draft.title")}</p>
          <p className="text-muted-foreground">
            {t("draft.lastSaved", { time: formatDraftTimestamp(updatedAt) })}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-card px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          onClick={onDiscard}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          {t("actions.discard")}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-[color-mix(in_srgb,var(--accent)_88%,black)]"
          onClick={onRestore}
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          {t("actions.restoreDraft")}
        </button>
      </div>
    </div>
  );
}

type QuickActionConfirmDialogProps = {
  action: PendingQuickAction | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  t: TimeTrackingTranslator;
};

function QuickActionConfirmDialog({
  action,
  pending,
  onCancel,
  onConfirm,
  t,
}: QuickActionConfirmDialogProps) {
  const isCopyPreviousDay = action?.type === "copyPreviousDay";
  const title = isCopyPreviousDay
    ? t("quickActionConfirm.copyPreviousDay.title")
    : t("quickActionConfirm.duplicatePreviousWeek.title");
  const description =
    !action || isCopyPreviousDay
      ? t("quickActionConfirm.copyPreviousDay.description", {
          sourceDate: action?.type === "copyPreviousDay" ? action.sourceDate : "",
          targetDate: action?.type === "copyPreviousDay" ? action.targetDate : "",
        })
      : t("quickActionConfirm.duplicatePreviousWeek.description", {
          sourceWeekEnd: action.sourceWeekEnd,
          sourceWeekStart: action.sourceWeekStart,
          targetWeekEnd: action.targetWeekEnd,
          targetWeekStart: action.targetWeekStart,
        });

  return (
    <Dialog open={Boolean(action)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="rounded-[var(--radius-md)] border border-warning/35 bg-warning-soft px-3 py-2 text-sm text-warning">
          {t("quickActionConfirm.skipExisting")}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
            {t("actions.cancel")}
          </Button>
          <Button type="button" variant="cta" icon={Copy} loading={pending} onClick={onConfirm}>
            {t("quickActionConfirm.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The running timer, in full size, on the page where time gets tracked.
 *
 * The header pill covers every other route; this exists because `/time` is where you want the
 * elapsed reading big enough to glance at and the stop button where your hand already is. It has no
 * idle state any more — starting a timer is the `New timer` overlay.
 */
function RunningTimerCard({
  disabled,
  runningTimer,
  onStop,
  t,
}: {
  disabled: boolean;
  runningTimer: NonNullable<TimeGridWeek["runningTimer"]>;
  onStop: () => void;
  t: TimeTrackingTranslator;
}) {
  const elapsed = useElapsedLabel(runningTimer.startedAt);

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-accent-line bg-accent-soft p-4 sm:flex-row sm:items-center">
      <span className="relative flex size-3 shrink-0">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-45" />
        <span className="relative inline-flex size-3 rounded-full bg-accent" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {runningTimer.description || t("timer.trackedWithTimer")}
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
        {t("timer.stop")}
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
  t: TimeTrackingTranslator;
};

function EntryModal({ state, week, projects, onClose, onDone, t }: EntryModalProps) {
  const locale = useLocale();
  const { formatMinutesForInput, formatMinutesWithUnit } = useDurationFormatting();
  const pickerLabels = usePickerLabels();
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
      : formatMinutesForInput(initialDuration) || "1";
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const project = projects.find((item) => item.projectId === projectId) ?? projects[0];
  const parsedMinutes = parseDurationToMinutes(durationText);
  const intervalMinutes = calculateIntervalMinutes(startTime, endTime);
  const entryMinutes =
    timingMode === "INTERVAL" ? intervalMinutes : parsedMinutes !== null ? parsedMinutes : 0;
  const projectedDayTotalMinutes =
    entryMinutes > 0
      ? getDayLoggedMinutes(
          week.entries,
          localDate,
          state.mode === "edit" ? state.entry.id : null,
        ) + entryMinutes
      : 0;
  const durationOverHardLimit =
    timingMode === "DURATION" && parsedMinutes !== null && parsedMinutes > DAILY_HARD_LIMIT_MINUTES;
  const projectedDayOverHardLimit =
    projectedDayTotalMinutes > DAILY_HARD_LIMIT_MINUTES && !durationOverHardLimit;
  const projectedDayOverSoftLimit =
    projectedDayTotalMinutes > DAILY_SOFT_WARNING_MINUTES && !projectedDayOverHardLimit;
  const createDraftKey =
    state.mode === "create" ? (state.draftKey ?? TIME_ENTRY_FORM_DRAFT_KEY) : null;
  const createDraftSource = state.mode === "create" ? state.source : null;
  const createDraftPrefill = state.mode === "create" ? state.prefill : undefined;
  const ready = Boolean(
    projectId &&
    localDate &&
    description.trim() &&
    !durationOverHardLimit &&
    !projectedDayOverHardLimit &&
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

  function clearSubmitFeedback() {
    setFieldErrors(undefined);
    setSubmitError(null);
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

    setSubmitError(null);

    if (timingMode === "DURATION" && (!durationMinutes || durationMinutes <= 0)) {
      setFieldErrors({ durationMinutes: t("fieldErrors.durationPositive") });
      return;
    }

    if (timingMode === "INTERVAL" && intervalMinutes <= 0) {
      setFieldErrors({ endTime: t("fieldErrors.endAfterStart") });
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
      setSubmitError(result.status === "error" ? result.message : null);

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
            {state.mode === "edit" ? t("entryModal.editTitle") : t("entryModal.newTitle")}
          </h2>
          <button
            type="button"
            className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            onClick={closeModal}
            aria-label={t("actions.close")}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-5 px-6 py-6">
          {state.mode === "create" && state.prefill && project ? (
            <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-accent-line bg-accent-soft p-3">
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
                  <span className="rounded-[var(--radius-pill)] border border-accent-line bg-card px-2 py-0.5 font-ui text-[11px] font-bold text-accent">
                    {formatMinutesWithUnit(state.durationMinutes)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="size-3.5 text-accent" aria-hidden="true" />
                  {t("entryModal.prefillHint")}
                </div>
              </div>
            </div>
          ) : null}

          {submitError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-[var(--radius-md)] border border-destructive/35 bg-destructive-soft px-3 py-2 text-sm font-medium text-destructive"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{submitError}</span>
            </div>
          ) : null}

          {state.mode === "edit" && state.entry.adminModification ? (
            <AdminModificationNotice modification={state.entry.adminModification} t={t} />
          ) : null}

          <Field label={t("fields.description")} required error={fieldErrors?.description}>
            <textarea
              rows={3}
              value={description}
              placeholder={t("fields.descriptionPlaceholder")}
              className={inputClassName(Boolean(fieldErrors?.description))}
              onChange={(event) => {
                clearSubmitFeedback();
                setDescription(event.target.value);
                markDraftDirty(event.target.value);
              }}
            />
          </Field>

          <Field label={t("fields.project")} required error={fieldErrors?.projectId}>
            {({ id, describedBy, invalid, required }) => (
              <Combobox
                id={id}
                label={t("fields.project")}
                value={projectId}
                aria-describedby={describedBy}
                invalid={invalid}
                required={required}
                labels={pickerLabels.combobox}
                options={projects.map((option) => ({
                  value: option.projectId,
                  label: option.name,
                }))}
                onValueChange={(value) => {
                  clearSubmitFeedback();
                  setProjectId(value);
                  markDraftDirty();
                }}
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <Field label={t("fields.date")} required error={fieldErrors?.localDate}>
              {({ id, describedBy, invalid, required }) => (
                <DatePicker
                  id={id}
                  label={t("fields.date")}
                  locale={locale}
                  value={localDate}
                  min={week.weekStart}
                  max={week.weekEnd}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  required={required}
                  // The action rejects an empty date, so there is nothing to clear to.
                  clearable={false}
                  labels={pickerLabels.date}
                  onValueChange={(value) => {
                    clearSubmitFeedback();
                    setLocalDate(value ?? "");
                    markDraftDirty();
                  }}
                />
              )}
            </Field>
            <Field label={t("fields.mode")} required>
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
                    clearSubmitFeedback();
                    setTimingMode("DURATION");
                    markDraftDirty();
                  }}
                >
                  {t("mode.duration")}
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
                    clearSubmitFeedback();
                    setTimingMode("INTERVAL");
                    markDraftDirty();
                  }}
                >
                  {t("mode.interval")}
                </button>
              </div>
            </Field>
          </div>

          {timingMode === "DURATION" ? (
            <Field label={t("fields.duration")} required error={fieldErrors?.durationMinutes}>
              <input
                inputMode="decimal"
                value={durationText}
                placeholder="3h 20m"
                className={inputClassName(Boolean(fieldErrors?.durationMinutes))}
                onChange={(event) => {
                  clearSubmitFeedback();
                  setDurationText(event.target.value);
                  markDraftDirty();
                }}
              />
            </Field>
          ) : (
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label={t("fields.start")} required error={fieldErrors?.startTime}>
                {({ id, describedBy, invalid, required }) => (
                  <TimeInput
                    id={id}
                    value={startTime}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    required={required}
                    onChange={(event) => {
                      clearSubmitFeedback();
                      setStartTime(event.target.value);
                      markDraftDirty();
                    }}
                  />
                )}
              </Field>
              <Field label={t("fields.end")} required error={fieldErrors?.endTime}>
                {({ id, describedBy, invalid, required }) => (
                  <TimeInput
                    id={id}
                    value={endTime}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    required={required}
                    onChange={(event) => {
                      clearSubmitFeedback();
                      setEndTime(event.target.value);
                      markDraftDirty();
                    }}
                  />
                )}
              </Field>
              <div className="pb-2 text-xl font-semibold text-accent">
                {formatMinutesWithUnit(intervalMinutes)}
              </div>
            </div>
          )}

          {durationOverHardLimit ? (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="size-4" aria-hidden="true" />
              {t("warnings.durationOver24Blocked")}
            </div>
          ) : null}

          {projectedDayOverHardLimit ? (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="size-4" aria-hidden="true" />
              {t("warnings.dailyTotalOver24Projected", {
                hours: formatMinutesWithUnit(projectedDayTotalMinutes),
              })}
            </div>
          ) : null}

          {projectedDayOverSoftLimit ? (
            <div className="flex items-center gap-2 text-sm text-warning">
              <AlertTriangle className="size-4" aria-hidden="true" />
              {t("warnings.dayOver8Projected", {
                hours: formatMinutesWithUnit(projectedDayTotalMinutes),
              })}
            </div>
          ) : null}

          {timingMode === "INTERVAL" && intervalMinutes >= 480 ? (
            <div className="flex items-center gap-2 text-sm text-warning">
              <AlertTriangle className="size-4" aria-hidden="true" />
              {t("warnings.longSessionNotBlocked")}
            </div>
          ) : null}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="size-4" aria-hidden="true" />
            {t("entryModal.requiredHint")}
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
                ? t("draft.saving")
                : draftStatus === "saved"
                  ? t("draft.saved")
                  : t("draft.notSaved")}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            className="rounded-[var(--radius-md)] border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
            onClick={closeModal}
          >
            {t("actions.cancel")}
          </button>
          <button
            type="button"
            disabled={!ready || isPending}
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-gradient-to-br from-primary to-accent px-4 py-2 text-sm font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
            onClick={submit}
          >
            <Check className="size-4" aria-hidden="true" />
            {t("actions.save")}
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
  t: TimeTrackingTranslator;
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

function AdminModificationNotice({
  modification,
  compact = false,
  t,
}: {
  modification: NonNullable<TimeGridEntry["adminModification"]>;
  compact?: boolean;
  t: TimeTrackingTranslator;
}) {
  const locale = useLocale();
  const modifiedAt = formatAdminModifiedAt(modification, locale);

  return (
    <div
      className={cn(
        "mt-2 flex items-start gap-2 rounded-[var(--radius-sm)] border border-accent-line bg-accent-soft text-xs leading-relaxed",
        compact ? "px-2.5 py-2" : "px-3 py-2.5",
      )}
    >
      <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden="true" />
      <span>
        <span className="font-semibold text-foreground">
          {t("adminModification.changedBy", {
            name: modification.modifiedByName ?? t("adminModification.adminFallback"),
            date: modifiedAt,
          })}
        </span>{" "}
        <span className="text-muted-foreground">
          {t("adminModification.reason", { reason: modification.reason })}
        </span>
      </span>
    </div>
  );
}

type TimeFieldRenderProps = {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required?: boolean;
};

const timeFieldLabelClassName =
  "font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

/**
 * The entry modal's own field wrapper, kept local because its label is smaller and
 * uppercase compared with `src/components/ui/Field`.
 *
 * Takes either a plain node — wrapped in a `<label>`, which implicitly labels a single
 * input — or a render prop, which is what the popover-based controls need: a `<label>`
 * cannot wrap a button trigger, so those get an explicit `htmlFor` instead.
 */
function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode | ((field: TimeFieldRenderProps) => ReactNode);
}) {
  const generatedId = useId();

  if (typeof children !== "function") {
    return (
      <label className="grid gap-2">
        <span className={timeFieldLabelClassName}>
          {label} {required ? <span className="text-destructive">*</span> : null}
        </span>
        {children}
        {error ? <span className="text-xs font-medium text-destructive">{error}</span> : null}
      </label>
    );
  }

  const controlId = `time-field-${generatedId}`;
  const errorId = error ? `${controlId}-error` : undefined;

  return (
    <div className="grid gap-2">
      <label htmlFor={controlId} className={timeFieldLabelClassName}>
        {label} {required ? <span className="text-destructive">*</span> : null}
      </label>
      {children({ id: controlId, describedBy: errorId, invalid: Boolean(error), required })}
      {error ? (
        <span id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function inputClassName(error: boolean) {
  return cn(
    "w-full rounded-[var(--radius-md)] border bg-card px-3 py-2.5 text-sm text-foreground outline-none transition",
    focusChromeClassName,
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

function getDayLoggedMinutes(
  entries: TimeGridEntry[],
  localDate: string,
  excludingEntryId: string | null,
) {
  return entries.reduce((sum, entry) => {
    if (entry.localDate !== localDate || entry.id === excludingEntryId) return sum;
    return sum + entry.durationMinutes;
  }, 0);
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

function shiftIsoDate(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return isoDate;

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getCellWarnings(
  input: {
    day: TimeGridDay;
    dayTotalMinutes: number;
    entriesByDay: Map<string, TimeGridEntry[]>;
    cell: CellEntries;
  },
  t: TimeTrackingTranslator,
) {
  const warnings: string[] = [];

  if (input.cell.needsDescription) warnings.push(t("warnings.descriptionNeededSentence"));
  if (input.day.state === "future" && input.cell.totalMinutes > 0) {
    warnings.push(t("warnings.futureDay"));
  }
  if (input.dayTotalMinutes > DAILY_SOFT_WARNING_MINUTES) {
    warnings.push(t("warnings.dailyTotalOver8"));
  }
  if (hasOverlaps(input.entriesByDay.get(input.day.isoDate) ?? [])) {
    warnings.push(t("warnings.dayHasOverlaps"));
  }

  return warnings;
}

function getEntryWarnings(
  entry: TimeGridEntry,
  dayEntries: TimeGridEntry[],
  t: TimeTrackingTranslator,
) {
  const warnings: string[] = [];

  if (!entry.description.trim()) warnings.push(t("warnings.descriptionNeeded"));
  if (entry.durationMinutes >= 480) warnings.push(t("warnings.longContinuousSession"));
  if (entryHasOverlap(entry, dayEntries)) warnings.push(t("warnings.overlapsAnotherEntry"));

  return warnings;
}

/** The admin's own timezone, not the reader's — the correction happened at a moment they know. */
function formatAdminModifiedAt(
  modification: NonNullable<TimeGridEntry["adminModification"]>,
  locale: string,
) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: modification.timezone,
  }).format(new Date(modification.modifiedAt));
}

function formatEntrySource(source: TimeGridEntry["source"], t: TimeTrackingTranslator) {
  if (source === "FORM") return t("source.form");
  if (source === "TIMER") return t("source.timer");
  return t("source.grid");
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

  const minutes = end > start ? end - start : end + DAILY_HARD_LIMIT_MINUTES - start;
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

function formatDraftTimestamp(value: string) {
  return value.replace("T", " ").slice(0, 16);
}

function useDurationFormatting() {
  const locale = useLocale();
  const durationDisplayFormat = useContext(DurationDisplayContext);
  const formatMinutesAsHours = useCallback(
    (minutes: number) => formatDurationHours(minutes, locale, durationDisplayFormat),
    [durationDisplayFormat, locale],
  );
  const formatMinutesWithUnit = useCallback(
    (minutes: number) => formatDurationHoursWithUnit(minutes, locale, durationDisplayFormat),
    [durationDisplayFormat, locale],
  );
  const formatMinutesForInput = useCallback(
    (minutes: number) => formatDurationForInput(minutes, durationDisplayFormat),
    [durationDisplayFormat],
  );

  return { formatMinutesAsHours, formatMinutesForInput, formatMinutesWithUnit };
}
