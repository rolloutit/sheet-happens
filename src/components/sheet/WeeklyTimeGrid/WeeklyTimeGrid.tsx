import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  PauseCircle,
  Play,
  Plus,
  Save,
  TimerReset,
} from "lucide-react";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card } from "@/src/components/ui/Card";
import { ChipButton } from "@/src/components/ui/ChipButton";
import { Combobox } from "@/src/components/ui/Combobox";
import { Input } from "@/src/components/ui/Input";
import { LockedState } from "@/src/components/ui/LockedState";
import { cn } from "@/src/lib/utils";
import type { TimeGridProject, WeeklyTimeGridProps } from "./WeeklyTimeGrid.types";

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

const days = [
  { label: "Hétfő", date: "17" },
  { label: "Kedd", date: "18" },
  { label: "Szerda", date: "19" },
  { label: "Csütörtök", date: "20" },
  { label: "Péntek", date: "21" },
  { label: "Szombat", date: "22" },
  { label: "Vasárnap", date: "23" },
];

export function WeeklyTimeGrid({
  projects = defaultProjects,
  locked,
  showTimer = false,
  className,
}: WeeklyTimeGridProps) {
  const total = projects.flatMap((project) => project.hours).reduce((sum, hours) => sum + hours, 0);
  const dailyTotals = days.map((_, index) =>
    projects.reduce((sum, project) => sum + (project.hours[index] ?? 0), 0),
  );

  return (
    <div className={cn("grid gap-4", className)}>
      {showTimer ? <TimerComposer /> : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-ui text-xs font-semibold uppercase tracking-[0.12em] text-accent">
            Időkövetés
          </p>
          <h2 className="text-3xl font-semibold tracking-normal">Heti rögzítés</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Projekt, nap és státusz szerint szerkeszthető heti munkaidő.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="soft" size="sm" icon={ChevronLeft} aria-label="Előző hét" />
          <Button variant="soft" size="sm" icon={CalendarDays}>
            Jún. 17-23
          </Button>
          <Button variant="soft" size="sm" icon={ChevronRight} aria-label="Következő hét" />
          <ChipButton selected>Ez a hét</ChipButton>
          <Button variant="cta" size="sm" icon={Save}>
            Mentés
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <ChipButton selected>Apollo migráció</ChipButton>
        <ChipButton>Helix support</ChipButton>
        <ChipButton>Belső admin</ChipButton>
        <ChipButton variant="dashed" leading={<Plus className="size-3" aria-hidden="true" />}>
          Projekt hozzáadása
        </ChipButton>
        <ChipButton variant="filter" leading={<Copy className="size-3" aria-hidden="true" />}>
          Tegnapi másolása
        </ChipButton>
      </div>
      {locked ? (
        <LockedState
          title="A hét zárolva"
          reason="Ez a hét már beküldött timesheethez tartozik. Szerkesztéshez nyisd újra a hónapot."
        />
      ) : null}
      <Card variant="elevated" className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-border bg-card px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-ui text-xs font-semibold uppercase tracking-[0.12em] text-accent">
              2026. június
            </p>
            <h3 className="text-lg font-semibold">Heti időrács</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{total.toFixed(1)} óra</Badge>
            <Badge tone="success">32.0 óra jóváhagyható</Badge>
            <Badge tone="warning">2 hiányzó leírás</Badge>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[52rem]">
            <div className="grid grid-cols-[15rem_repeat(7,minmax(5.5rem,1fr))_5.5rem] border-b border-border bg-secondary/70 text-xs font-semibold uppercase text-muted-foreground">
              <div className="p-3">Projekt</div>
              {days.map((day) => (
                <div key={day.date} className="p-3 text-center">
                  <span className="block">{day.label}</span>
                  <span className="mt-1 block text-base font-semibold text-foreground">
                    {day.date}
                  </span>
                </div>
              ))}
              <div className="p-3 text-right">Össz.</div>
            </div>
            {projects.map((project) => {
              const rowTotal = project.hours.reduce((sum, hours) => sum + hours, 0);
              return (
                <div
                  key={project.id}
                  className={cn(
                    "grid grid-cols-[15rem_repeat(7,minmax(5.5rem,1fr))_5.5rem] border-b border-border bg-card last:border-b-0",
                    project.inactive && "opacity-55",
                  )}
                >
                  <div className="flex min-h-[4.5rem] items-center gap-3 p-3">
                    <span
                      className="size-3 rounded-full"
                      style={{ background: project.color }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{project.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {project.inactive ? "Inaktív sor" : "Billable"}
                      </span>
                    </div>
                  </div>
                  {project.hours.map((hours, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex min-h-[4.5rem] items-center border-l border-border p-2",
                        index === 4 && "bg-primary/8",
                        index > 4 && "bg-muted/45",
                      )}
                    >
                      <button
                        type="button"
                        disabled={locked}
                        aria-label={`${project.name}, ${days[index]?.label}`}
                        className={cn(
                          "h-11 w-full rounded-[var(--radius-sm)] border border-border bg-background text-sm font-semibold transition hover:border-primary/45 hover:bg-secondary disabled:pointer-events-none",
                          hours > 0 && "border-primary/30 bg-primary/12 text-accent shadow-soft",
                          index > 4 && "border-dashed text-muted-foreground",
                        )}
                      >
                        {hours > 0 ? hours : ""}
                      </button>
                    </div>
                  ))}
                  <div className="flex min-h-[4.5rem] items-center justify-end border-l border-border p-3 font-ui text-sm font-semibold">
                    {rowTotal.toFixed(1)}
                  </div>
                </div>
              );
            })}
            <div className="grid grid-cols-[15rem_repeat(7,minmax(5.5rem,1fr))_5.5rem] border-t border-border bg-secondary/70 text-sm font-semibold">
              <div className="p-3 text-muted-foreground">Napi összesen</div>
              {dailyTotals.map((hours, index) => (
                <div key={days[index]?.date} className="border-l border-border p-3 text-center">
                  {hours.toFixed(1)}
                </div>
              ))}
              <div className="border-l border-border p-3 text-right font-ui">
                {total.toFixed(1)}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function TimerComposer() {
  return (
    <Card variant="flat">
      <div className="grid gap-3 lg:grid-cols-[14rem_1fr_auto] lg:items-end">
        <Combobox
          label="Project"
          value="apollo"
          options={[
            { value: "apollo", label: "Apollo Migration" },
            { value: "helix", label: "Helix Support" },
          ]}
        />
        <Input placeholder="What are you working on?" defaultValue="Invoice diff review" />
        <div className="flex items-center gap-2">
          <Badge tone="success">01:24:12</Badge>
          <Button variant="cta" icon={Play}>
            Start
          </Button>
          <Button variant="soft" icon={PauseCircle}>
            Stop
          </Button>
          <Button variant="ghost" size="icon" icon={TimerReset} aria-label="Reset timer" />
        </div>
      </div>
    </Card>
  );
}
