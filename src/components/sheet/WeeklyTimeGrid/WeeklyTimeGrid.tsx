"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Copy, Plus, Save } from "lucide-react";
import { useRef, useState } from "react";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import { ChipButton } from "@/src/components/ui/ChipButton";
import { LockedState } from "@/src/components/ui/LockedState";
import { cn } from "@/src/lib/utils";
import { TimeGridTimer } from "../TimeGridTimer";
import type {
  TimeGridCellContext,
  TimeGridCellState,
  TimeGridCellValue,
  TimeGridDay,
  TimeGridProject,
  TimeGridSelectedCell,
  WeeklyTimeGridLabels,
  WeeklyTimeGridProps,
} from "./WeeklyTimeGrid.types";

const defaultProjects: TimeGridProject[] = [
  { id: "apollo", name: "Apollo migráció", color: "#37e3de", hours: [8, 6, 7.5, 8, 4, 0, 0] },
  { id: "helix", name: "Helix support", color: "#ffc68b", hours: [1, 2, 0, 1.5, 0, 0, 0] },
  {
    id: "legacy",
    name: "Belső admin",
    color: "#72df9a",
    inactive: true,
    hours: [0, 0, 2, 0, 0, 0, 0],
  },
];

const defaultDays: TimeGridDay[] = [
  { id: "mon", label: "Hétfő", date: "17" },
  { id: "tue", label: "Kedd", date: "18" },
  { id: "wed", label: "Szerda", date: "19" },
  { id: "thu", label: "Csütörtök", date: "20" },
  { id: "fri", label: "Péntek", date: "21", state: "today" },
  { id: "sat", label: "Szombat", date: "22", state: "future" },
  { id: "sun", label: "Vasárnap", date: "23", state: "future" },
];

const defaultLabels = {
  eyebrow: "Időkövetés",
  title: "Heti rögzítés",
  description: "Projekt, nap és státusz szerint szerkeszthető heti munkaidő.",
  previousWeek: "Előző hét",
  nextWeek: "Következő hét",
  today: "Ez a hét",
  save: "Mentés",
  addProject: "Projekt hozzáadása",
  copyPreviousDay: "Tegnapi másolása",
  lockedTitle: "A hét zárolva",
  lockedReason:
    "Ez a hét már beküldött timesheethez tartozik. Szerkesztéshez nyisd újra a hónapot.",
  projectColumn: "Projekt",
  totalColumn: "Össz.",
  dailyTotal: "Napi összesen",
  gridTitle: "Heti időrács",
} satisfies Required<WeeklyTimeGridLabels>;

function cellKey(projectId: string, dayId: string) {
  return `${projectId}:${dayId}`;
}

function isSameCell(left?: TimeGridSelectedCell | null, right?: TimeGridSelectedCell | null) {
  return Boolean(left && right && left.projectId === right.projectId && left.dayId === right.dayId);
}

function formatHours(hours: number) {
  return hours > 0 ? Number(hours.toFixed(2)).toString() : "";
}

function mergeCell(
  project: TimeGridProject,
  day: TimeGridDay,
  dayIndex: number,
  draftHours: Record<string, number>,
): TimeGridCellValue {
  const key = cellKey(project.id, day.id);
  const source = project.cells?.[day.id] ?? { hours: project.hours?.[dayIndex] ?? 0 };
  const hours = draftHours[key] ?? source.hours ?? 0;
  return { ...source, hours };
}

function getCellState(
  cell: TimeGridCellValue,
  day: TimeGridDay,
  editing: boolean,
  locked: boolean,
): TimeGridCellState {
  if (locked || cell.locked) return "locked";
  if (editing) return "editing";
  if (cell.state) return cell.state;
  if (cell.warning) return "warning";
  if (day.state === "future") return "future";
  if (day.state === "today") return "today";
  return (cell.hours ?? 0) > 0 ? "filled" : "empty";
}

function getCellClasses(state: TimeGridCellState) {
  return cn(
    "h-11 w-full rounded-[var(--radius-sm)] border border-border bg-background text-sm font-semibold transition hover:border-primary/45 hover:bg-secondary disabled:pointer-events-none disabled:opacity-55",
    state === "filled" && "border-primary/30 bg-accent-soft text-accent shadow-soft",
    state === "today" && "border-primary/40 bg-accent-soft text-accent",
    state === "future" && "border-dashed bg-muted/45 text-muted-foreground",
    state === "warning" && "border-warning/45 bg-warning-soft text-warning",
    state === "locked" && "border-border bg-secondary text-muted-foreground",
    state === "editing" && "border-ring bg-background",
  );
}

export function WeeklyTimeGrid({
  projects = defaultProjects,
  days = defaultDays,
  weekLabel = "Jún. 17-23",
  monthLabel = "2026. június",
  selectedProjectId,
  editingCell,
  defaultEditingCell = null,
  locked = false,
  showTimer = false,
  timer,
  labels,
  onPreviousWeek,
  onNextWeek,
  onToday,
  onSave,
  onAddProject,
  onCopyPreviousDay,
  onProjectSelect,
  onCellFocus,
  onCellEditStart,
  onCellChange,
  className,
}: WeeklyTimeGridProps) {
  const resolvedLabels = { ...defaultLabels, ...labels };
  const selectedId = selectedProjectId ?? projects[0]?.id;
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const [localEditingCell, setLocalEditingCell] = useState<TimeGridSelectedCell | null>(
    defaultEditingCell,
  );
  const [draftHours, setDraftHours] = useState<Record<string, number>>({});
  const activeEditingCell = editingCell === undefined ? localEditingCell : editingCell;

  function getCell(project: TimeGridProject, day: TimeGridDay, dayIndex: number) {
    return mergeCell(project, day, dayIndex, draftHours);
  }

  const total = projects
    .flatMap((project) => days.map((day, dayIndex) => getCell(project, day, dayIndex).hours ?? 0))
    .reduce((sum, hours) => sum + hours, 0);
  const dailyTotals = days.map((day, dayIndex) =>
    projects.reduce((sum, project) => sum + (getCell(project, day, dayIndex).hours ?? 0), 0),
  );

  function makeContext(
    project: TimeGridProject,
    day: TimeGridDay,
    dayIndex: number,
    value: TimeGridCellValue,
  ): TimeGridCellContext {
    return { project, day, dayIndex, value };
  }

  function moveFocus(
    projectIndex: number,
    dayIndex: number,
    projectDelta: number,
    dayDelta: number,
  ) {
    const nextProjectIndex = Math.max(
      0,
      Math.min(projects.length - 1, projectIndex + projectDelta),
    );
    const nextDayIndex = Math.max(0, Math.min(days.length - 1, dayIndex + dayDelta));
    const nextProject = projects[nextProjectIndex];
    const nextDay = days[nextDayIndex];
    if (!nextProject || !nextDay) return;
    cellRefs.current.get(cellKey(nextProject.id, nextDay.id))?.focus();
  }

  function startEditing(context: TimeGridCellContext) {
    if (locked || context.value.locked) return;
    const nextCell = { projectId: context.project.id, dayId: context.day.id };
    setLocalEditingCell(nextCell);
    onCellFocus?.(context);
    onCellEditStart?.(context);
  }

  function updateHours(context: TimeGridCellContext, hours: number) {
    const key = cellKey(context.project.id, context.day.id);
    const nextValue = { ...context.value, hours };
    setDraftHours((current) => ({ ...current, [key]: hours }));
    onCellChange?.({ ...context, value: nextValue }, hours);
  }

  function renderCellControl(
    project: TimeGridProject,
    projectIndex: number,
    day: TimeGridDay,
    dayIndex: number,
    mobile = false,
  ) {
    const value = getCell(project, day, dayIndex);
    const disabled = locked || Boolean(value.locked);
    const context = makeContext(project, day, dayIndex, value);
    const currentCell = { projectId: project.id, dayId: day.id };
    const isEditing = isSameCell(activeEditingCell, currentCell) && !disabled;
    const state = getCellState(value, day, isEditing, locked);
    const hours = value.hours ?? 0;
    const label = `${mobile ? "Mobile " : ""}${project.name}, ${day.label}`;

    if (isEditing) {
      return (
        <input
          autoFocus
          type="number"
          min={0}
          step={0.25}
          aria-label={`Edit ${label}`}
          value={hours || ""}
          onChange={(event) => updateHours(context, Number(event.target.value || 0))}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Escape") {
              event.preventDefault();
              setLocalEditingCell(null);
              window.requestAnimationFrame(() =>
                cellRefs.current.get(cellKey(project.id, day.id))?.focus(),
              );
            }
          }}
          className={cn(
            getCellClasses("editing"),
            "px-2 text-center outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          )}
        />
      );
    }

    return (
      <button
        ref={
          mobile
            ? undefined
            : (node) => {
                const key = cellKey(project.id, day.id);
                if (node) cellRefs.current.set(key, node);
                else cellRefs.current.delete(key);
              }
        }
        type="button"
        disabled={disabled}
        aria-label={`${label}${hours > 0 ? `, ${formatHours(hours)} hours` : ""}`}
        aria-describedby={value.warning ? `${cellKey(project.id, day.id)}-warning` : undefined}
        className={getCellClasses(state)}
        onFocus={() => onCellFocus?.(context)}
        onClick={() => startEditing(context)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            startEditing(context);
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            moveFocus(projectIndex, dayIndex, 0, 1);
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            moveFocus(projectIndex, dayIndex, 0, -1);
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            moveFocus(projectIndex, dayIndex, 1, 0);
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            moveFocus(projectIndex, dayIndex, -1, 0);
          }
        }}
      >
        {formatHours(hours)}
      </button>
    );
  }

  return (
    <div className={cn("grid gap-4", className)}>
      {showTimer ? (
        <TimeGridTimer
          projectOptions={projects.map((project) => ({
            value: project.id,
            label: project.name,
            meta: project.inactive ? "Inactive" : undefined,
          }))}
          projectValue={timer?.projectId ?? selectedId}
          descriptionValue={timer?.description ?? "Invoice diff review"}
          elapsedLabel={timer?.elapsedLabel ?? "01:24:12"}
          running={timer?.running}
        />
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-ui text-xs font-semibold uppercase tracking-[0.12em] text-accent">
            {resolvedLabels.eyebrow}
          </p>
          <h2 className="text-3xl font-semibold tracking-normal">{resolvedLabels.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{resolvedLabels.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="soft"
            size="sm"
            icon={ChevronLeft}
            aria-label={resolvedLabels.previousWeek}
            onClick={onPreviousWeek}
          />
          <Button type="button" variant="soft" size="sm" icon={CalendarDays}>
            {weekLabel}
          </Button>
          <Button
            type="button"
            variant="soft"
            size="sm"
            icon={ChevronRight}
            aria-label={resolvedLabels.nextWeek}
            onClick={onNextWeek}
          />
          <ChipButton selected onClick={onToday}>
            {resolvedLabels.today}
          </ChipButton>
          <Button type="button" variant="cta" size="sm" icon={Save} onClick={onSave}>
            {resolvedLabels.save}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {projects.map((project) => (
          <ChipButton
            key={project.id}
            selected={project.id === selectedId}
            disabled={project.inactive}
            onClick={() => onProjectSelect?.(project)}
          >
            {project.name}
          </ChipButton>
        ))}
        <ChipButton
          variant="dashed"
          leading={<Plus className="size-3" aria-hidden="true" />}
          onClick={onAddProject}
        >
          {resolvedLabels.addProject}
        </ChipButton>
        <ChipButton
          variant="filter"
          leading={<Copy className="size-3" aria-hidden="true" />}
          onClick={onCopyPreviousDay}
        >
          {resolvedLabels.copyPreviousDay}
        </ChipButton>
      </div>
      {locked ? (
        <LockedState title={resolvedLabels.lockedTitle} reason={resolvedLabels.lockedReason} />
      ) : null}
      <Card variant="elevated" className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-border bg-card px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-ui text-xs font-semibold uppercase tracking-[0.12em] text-accent">
              {monthLabel}
            </p>
            <h3 className="text-lg font-semibold">{resolvedLabels.gridTitle}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{total.toFixed(1)} óra</Badge>
            <Badge tone="success">{Math.min(32, total).toFixed(1)} óra jóváhagyható</Badge>
            <Badge tone="warning">
              {
                projects
                  .flatMap((project) =>
                    days.map((day, dayIndex) => getCell(project, day, dayIndex).warning),
                  )
                  .filter(Boolean).length
              }{" "}
              hiányzó leírás
            </Badge>
          </div>
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <div
            role="grid"
            aria-label={resolvedLabels.gridTitle}
            className="min-w-[52rem]"
            aria-readonly={locked || undefined}
          >
            <div
              role="row"
              className="grid grid-cols-[15rem_repeat(7,minmax(5.5rem,1fr))_5.5rem] border-b border-border bg-secondary/70 text-xs font-semibold uppercase text-muted-foreground"
            >
              <div role="columnheader" className="p-3">
                {resolvedLabels.projectColumn}
              </div>
              {days.map((day) => (
                <div key={day.id} role="columnheader" className="p-3 text-center">
                  <span className="block">{day.label}</span>
                  <span className="mt-1 block text-base font-semibold text-foreground">
                    {day.date}
                  </span>
                </div>
              ))}
              <div role="columnheader" className="p-3 text-right">
                {resolvedLabels.totalColumn}
              </div>
            </div>
            {projects.map((project, projectIndex) => {
              const rowTotal = days.reduce(
                (sum, day, dayIndex) => sum + (getCell(project, day, dayIndex).hours ?? 0),
                0,
              );
              return (
                <div
                  key={project.id}
                  role="row"
                  className={cn(
                    "grid grid-cols-[15rem_repeat(7,minmax(5.5rem,1fr))_5.5rem] border-b border-border bg-card last:border-b-0",
                    project.inactive && "opacity-55",
                  )}
                >
                  <div role="rowheader" className="flex min-h-[4.5rem] items-center gap-3 p-3">
                    <span
                      className="size-3 rounded-full"
                      style={{ background: project.color }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{project.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {project.billingLabel ?? (project.inactive ? "Inaktív sor" : "Billable")}
                      </span>
                    </div>
                  </div>
                  {days.map((day, dayIndex) => {
                    const value = getCell(project, day, dayIndex);
                    return (
                      <div
                        key={day.id}
                        role="gridcell"
                        className={cn(
                          "flex min-h-[4.5rem] items-center border-l border-border p-2",
                          day.state === "today" && "bg-accent-soft",
                          day.state === "future" && "bg-muted/45",
                        )}
                      >
                        <div className="grid w-full gap-1">
                          {renderCellControl(project, projectIndex, day, dayIndex)}
                          {value.warning ? (
                            <span
                              id={`${cellKey(project.id, day.id)}-warning`}
                              className="text-center text-[0.6875rem] font-semibold text-warning"
                            >
                              {value.warning}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  <div
                    role="gridcell"
                    className="flex min-h-[4.5rem] items-center justify-end border-l border-border p-3 font-ui text-sm font-semibold"
                  >
                    {rowTotal.toFixed(1)}
                  </div>
                </div>
              );
            })}
            <div
              role="row"
              className="grid grid-cols-[15rem_repeat(7,minmax(5.5rem,1fr))_5.5rem] border-t border-border bg-secondary/70 text-sm font-semibold"
            >
              <div role="rowheader" className="p-3 text-muted-foreground">
                {resolvedLabels.dailyTotal}
              </div>
              {dailyTotals.map((hours, index) => (
                <div
                  key={days[index]?.id}
                  role="gridcell"
                  className="border-l border-border p-3 text-center"
                >
                  {hours.toFixed(1)}
                </div>
              ))}
              <div role="gridcell" className="border-l border-border p-3 text-right font-ui">
                {total.toFixed(1)}
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-3 p-3 lg:hidden">
          {days.map((day, dayIndex) => (
            <section
              key={day.id}
              aria-labelledby={`mobile-day-${day.id}`}
              className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-background/40 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 id={`mobile-day-${day.id}`} className="font-ui text-sm font-semibold">
                    {day.label} {day.date}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {dailyTotals[dayIndex]?.toFixed(1)} óra
                  </p>
                </div>
                {day.state ? (
                  <Badge tone={day.state === "future" ? "neutral" : "info"}>{day.state}</Badge>
                ) : null}
              </div>
              <div className="grid gap-2">
                {projects.map((project, projectIndex) => (
                  <div key={project.id} className="grid grid-cols-[1fr_5.5rem] items-center gap-3">
                    <span className="min-w-0 text-sm font-semibold">{project.name}</span>
                    {renderCellControl(project, projectIndex, day, dayIndex, true)}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Card>
    </div>
  );
}
