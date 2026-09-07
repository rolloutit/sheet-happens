"use client";

import { CalendarX, Clock3, Info, Layers, MessageSquare, Moon } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { DayColumnHeader, type DayColumnHeaderDay } from "@/src/components/sheet/DayColumnHeader";
import { parseDurationToMinutes } from "@/src/lib/duration";
import { dayLayoutId, rowEnterTransition } from "@/src/lib/motion";
import { DAILY_SOFT_WARNING_MINUTES } from "@/src/lib/time-entry-limits";
import { cn } from "@/src/lib/utils";
import type {
  TimeGridAssignedProject,
  TimeGridDay,
  TimeGridEntry,
} from "@/src/server/time-tracking";

import {
  getCellEntries,
  getCellWarnings,
  isProjectAssignableOnDate,
  isSimpleDurationEntry,
  type CellEntries,
  type TimeTrackingTranslator,
} from "./time-entry-helpers";
import { useDurationFormatting } from "./use-duration-formatting";

const GRID_ENTRY_IDLE_OPEN_DELAY_MS = 900;

export type WeekGridLensProps = {
  days: DayColumnHeaderDay[];
  projects: TimeGridAssignedProject[];
  /** Declared projects, shown as ghost rows so the absence is explained where it is felt (§4.2). */
  declaredProjects: TimeGridAssignedProject[];
  inactiveProjectIds: Set<string>;
  entriesByCell: Map<string, TimeGridEntry[]>;
  entriesByDay: Map<string, TimeGridEntry[]>;
  dailyTotals: number[];
  weekTotal: number;
  weekHasLockedPeriod: boolean;
  /** Seven columns on a desktop, stacked project cards on a phone. */
  layout: "table" | "stack";
  disabled: boolean;
  animateRows: boolean;
  onOpenDay: (isoDate: string) => void;
  onCellCommit: (project: TimeGridAssignedProject, day: TimeGridDay, rawValue: string) => void;
  onOpenBreakdown: (projectId: string, isoDate: string) => void;
  onCreateFromCell: (project: TimeGridAssignedProject, day: TimeGridDay) => void;
  onToggleInactive: (project: TimeGridAssignedProject, inactive: boolean) => void;
  onSeeMonth: () => void;
};

/**
 * The Week scope's Grid lens: project × day, inline-editable, for filling a week fast (§4.2 of
 * `docs/time-view-redesign.md`).
 *
 * The seven column headers are the **same component** the Agenda lens heads its columns with and
 * carry the same `dayLayoutId`, so switching lens crossfades the bodies while the headers stay put:
 * the week "re-sorts" under fixed headers. Everything below them keeps its substance — `Enter`
 * commits, arrow keys move between cells, a cell with more than one entry opens the breakdown.
 *
 * The hover crosshair tints the hovered cell's row and column by one surface step so a dense grid
 * can be read across without losing the line. A declared project appears as a ghost row where it
 * would otherwise be missing, non-editable, with the handoff into Month.
 */
export function WeekGridLens({
  days,
  projects,
  declaredProjects,
  inactiveProjectIds,
  entriesByCell,
  entriesByDay,
  dailyTotals,
  weekTotal,
  weekHasLockedPeriod,
  layout,
  disabled,
  animateRows,
  onOpenDay,
  onCellCommit,
  onOpenBreakdown,
  onCreateFromCell,
  onToggleInactive,
  onSeeMonth,
}: WeekGridLensProps) {
  const t = useTranslations("TimeTracking");
  const { formatMinutesAsHours, formatMinutesWithUnit } = useDurationFormatting();
  const [crosshair, setCrosshair] = useState<{ projectId: string; isoDate: string } | null>(null);

  if (layout === "stack") {
    return (
      <div className="grid gap-3">
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
          {projects.map((project) => {
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
                      onClick={() => onToggleInactive(project, true)}
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
                    {days.map((day) => {
                      const cell = getCellEntries(entriesByCell, project.projectId, day.isoDate);
                      return (
                        <button
                          key={day.isoDate}
                          type="button"
                          aria-label={`${project.name}, ${day.label}`}
                          disabled={day.locked || !isProjectAssignableOnDate(project, day.isoDate)}
                          className={cn(
                            "rounded-[var(--radius-sm)] border border-border bg-background px-1 py-2 font-ui text-sm font-semibold tabular-nums disabled:opacity-35",
                            cell.totalMinutes > 0 &&
                              "border-accent-line bg-accent-soft text-accent",
                          )}
                          onClick={() =>
                            cell.entries.length === 0
                              ? onCreateFromCell(project, day)
                              : onOpenBreakdown(project.projectId, day.isoDate)
                          }
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
          {declaredProjects.map((project) => (
            <GhostRow key={project.projectId} project={project} onSeeMonth={onSeeMonth} t={t} />
          ))}
        </div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="size-4 shrink-0" aria-hidden="true" />
          {t("help.durationFormats")}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto">
        <div
          className="min-w-[900px] overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card"
          onMouseLeave={() => setCrosshair(null)}
        >
          <div className="grid grid-cols-[minmax(190px,1.5fr)_repeat(7,minmax(54px,1fr))_92px]">
            <GridHeaderCell label={t("grid.projects")} />
            {days.map((day) => (
              <div key={day.isoDate} className="border-b border-r border-border">
                <DayColumnHeader
                  day={day}
                  variant="column"
                  capacityMinutes={DAILY_SOFT_WARNING_MINUTES}
                  totalLabel={formatMinutesWithUnit(day.totalMinutes)}
                  label={t("header.open", { date: `${day.label}, ${day.dayNumber}` })}
                  labels={{
                    capacity: t("week.capacity", {
                      logged: formatMinutesWithUnit(day.totalMinutes),
                      target: formatMinutesWithUnit(DAILY_SOFT_WARNING_MINUTES),
                    }),
                    over: t("header.over", {
                      target: formatMinutesWithUnit(DAILY_SOFT_WARNING_MINUTES),
                    }),
                    locked: t("header.locked"),
                    today: t("header.today"),
                  }}
                  layoutId={dayLayoutId(day.isoDate)}
                  className="h-full rounded-none border-b-0"
                  onPress={() => onOpenDay(day.isoDate)}
                />
              </div>
            ))}
            <GridHeaderCell label={t("grid.total")} noRightBorder />

            <AnimatePresence initial={animateRows}>
              {projects.map((project, rowIndex) => {
                const inactive = inactiveProjectIds.has(project.projectId);
                const rowTotal = days.reduce(
                  (sum, day) =>
                    sum +
                    getCellEntries(entriesByCell, project.projectId, day.isoDate).totalMinutes,
                  0,
                );
                const canToggleInactive = !weekHasLockedPeriod && rowTotal === 0;
                const rowHovered = crosshair?.projectId === project.projectId;

                return (
                  <m.div
                    key={project.projectId}
                    className="contents"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={rowEnterTransition(rowIndex)}
                  >
                    <div
                      className={cn(
                        "flex min-h-14 items-center gap-2 border-b border-r border-border px-3 transition-colors duration-[var(--duration-micro)]",
                        inactive && "opacity-65",
                        rowHovered && "bg-secondary/60",
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
                        aria-label={
                          inactive
                            ? t("inactive.undo")
                            : canToggleInactive
                              ? t("inactive.mark")
                              : t("inactive.removeEntriesFirst")
                        }
                        className="grid size-7 place-items-center rounded-[var(--radius-xs)] text-muted-foreground transition hover:bg-secondary hover:text-accent disabled:cursor-not-allowed disabled:opacity-35"
                        onClick={() => onToggleInactive(project, inactive)}
                      >
                        <CalendarX className="size-4" aria-hidden="true" />
                      </button>
                    </div>

                    {inactive ? (
                      <InactiveProjectRow onUndo={() => onToggleInactive(project, true)} />
                    ) : (
                      <>
                        {days.map((day, dayIndex) => (
                          <TimeGridCell
                            key={day.isoDate}
                            day={day}
                            dayTotalMinutes={dailyTotals[dayIndex] ?? 0}
                            entriesByDay={entriesByDay}
                            project={project}
                            cell={getCellEntries(entriesByCell, project.projectId, day.isoDate)}
                            disabled={
                              disabled ||
                              day.locked ||
                              !isProjectAssignableOnDate(project, day.isoDate)
                            }
                            crosshair={
                              rowHovered ||
                              (crosshair?.isoDate === day.isoDate &&
                                crosshair.projectId !== project.projectId)
                            }
                            onHover={() =>
                              setCrosshair({ projectId: project.projectId, isoDate: day.isoDate })
                            }
                            onCommit={(rawValue) => onCellCommit(project, day, rawValue)}
                            onOpenBreakdown={() => onOpenBreakdown(project.projectId, day.isoDate)}
                            t={t}
                          />
                        ))}
                        <div
                          className={cn(
                            "flex min-h-14 items-center justify-center border-b border-border font-ui text-base font-semibold tabular-nums transition-colors duration-[var(--duration-micro)]",
                            rowHovered && "bg-secondary/60",
                          )}
                        >
                          {formatMinutesAsHours(rowTotal)}
                        </div>
                      </>
                    )}
                  </m.div>
                );
              })}
            </AnimatePresence>

            {declaredProjects.map((project) => (
              <div key={project.projectId} className="contents">
                <div className="flex min-h-12 items-center gap-2 border-b border-r border-border px-3 opacity-70">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: project.color }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
                    {project.name}
                  </span>
                </div>
                <div className="col-span-8 flex min-h-12 items-center gap-2 border-b border-border px-4 text-xs text-muted-foreground">
                  <span className="italic">{t("grid.declaredMonthly")}</span>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    className="font-semibold text-accent underline-offset-2 hover:underline"
                    onClick={onSeeMonth}
                  >
                    {t("grid.seeMonth")}
                  </button>
                </div>
              </div>
            ))}

            <div className="flex min-h-[52px] items-center border-r border-border bg-secondary px-3 font-ui text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {t("grid.dailyTotal")}
            </div>
            {days.map((day, dayIndex) => {
              const total = dailyTotals[dayIndex] ?? 0;
              const over = total > DAILY_SOFT_WARNING_MINUTES;

              return (
                <div
                  key={day.isoDate}
                  className={cn(
                    "relative flex min-h-[52px] items-center justify-center gap-1 border-r border-border bg-secondary font-ui text-sm font-semibold tabular-nums",
                    day.state === "today" && "bg-accent-soft",
                    over ? "text-warning" : total ? "text-foreground" : "text-muted-foreground",
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
            <div className="flex min-h-[52px] items-center justify-center bg-secondary font-ui text-[17px] font-semibold tabular-nums text-accent">
              {formatMinutesAsHours(weekTotal)}
            </div>
          </div>
        </div>
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Info className="size-4 shrink-0" aria-hidden="true" />
        {t("help.durationFormats")}
      </p>
    </div>
  );
}

function GhostRow({
  project,
  onSeeMonth,
  t,
}: {
  project: TimeGridAssignedProject;
  onSeeMonth: () => void;
  t: TimeTrackingTranslator;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm last:border-b-0">
      <span
        className="size-2.5 shrink-0 rounded-full opacity-70"
        style={{ backgroundColor: project.color }}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate font-medium text-muted-foreground">
        {project.name}
      </span>
      <span className="text-xs italic text-muted-foreground">{t("grid.declaredMonthly")}</span>
      <button
        type="button"
        className="text-xs font-semibold text-accent underline-offset-2 hover:underline"
        onClick={onSeeMonth}
      >
        {t("grid.seeMonth")}
      </button>
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
  crosshair: boolean;
  onHover: () => void;
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
  crosshair,
  onHover,
  onCommit,
  onOpenBreakdown,
  t,
}: TimeGridCellProps) {
  const { formatMinutesAsHours, formatMinutesForInput } = useDurationFormatting();
  const simpleEntry =
    cell.entries.length === 1 && isSimpleDurationEntry(cell.entries[0]) ? cell.entries[0] : null;
  const canInlineEdit = !disabled && !cell.locked && (cell.entries.length === 0 || simpleEntry);
  const warningTexts = getCellWarnings({ day, dayTotalMinutes, entriesByDay, cell }, t);
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

  const crosshairClassName = crosshair && "bg-secondary/60";

  if (!isProjectAssignableOnDate(project, day.isoDate)) {
    return (
      <div
        className={cn(
          "flex min-h-14 items-center justify-center border-b border-r border-border text-muted-foreground transition-colors duration-[var(--duration-micro)]",
          crosshairClassName,
        )}
        onMouseEnter={onHover}
      >
        ·
      </div>
    );
  }

  if (!canInlineEdit) {
    return (
      <button
        type="button"
        disabled={disabled}
        aria-label={`${project.name}, ${day.label}`}
        className={cn(
          "relative flex min-h-14 items-center justify-center gap-1 border-b border-r border-border font-ui text-[13px] font-semibold tabular-nums transition-colors duration-[var(--duration-micro)] hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60",
          day.state === "today" && "bg-accent-soft",
          warningTexts.length > 0 && "text-warning",
          crosshairClassName,
        )}
        onMouseEnter={onHover}
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
        "relative min-h-14 border-b border-r border-border transition-colors duration-[var(--duration-micro)] hover:bg-secondary",
        day.state === "today" && "bg-accent-soft",
        crosshairClassName,
      )}
      onMouseEnter={onHover}
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
          "h-full min-h-14 w-full border-0 bg-transparent px-1 text-center font-ui text-[13px] font-medium tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:text-muted-foreground",
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
          aria-label={
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

function WarningTip({ text }: { text: string }) {
  return (
    <span className="absolute bottom-1 right-1 text-warning" title={text}>
      <AlertTriangle className="size-3.5" aria-hidden="true" />
    </span>
  );
}
