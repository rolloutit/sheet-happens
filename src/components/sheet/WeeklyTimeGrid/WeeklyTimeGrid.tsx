import { PauseCircle, Play, Plus, TimerReset } from "lucide-react";

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
  { id: "apollo", name: "Apollo Migration", color: "#37e3de", hours: [8, 6, 7.5, 8, 4, 0, 0] },
  { id: "helix", name: "Helix Support", color: "#ffc68b", hours: [1, 2, 0, 1.5, 0, 0, 0] },
  {
    id: "legacy",
    name: "Legacy Cleanup",
    color: "#72df9a",
    inactive: true,
    hours: [0, 0, 2, 0, 0, 0, 0],
  },
];

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function WeeklyTimeGrid({
  projects = defaultProjects,
  locked,
  className,
}: WeeklyTimeGridProps) {
  const total = projects.flatMap((project) => project.hours).reduce((sum, hours) => sum + hours, 0);

  return (
    <div className={cn("grid gap-4", className)}>
      <TimerComposer />
      {locked ? (
        <LockedState
          title="Week locked"
          reason="This week belongs to a submitted timesheet. Reopen the month before editing entries."
        />
      ) : null}
      <Card variant="elevated" className="overflow-hidden p-0">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-ui text-xs font-semibold uppercase text-accent">Jun 15 to Jun 21</p>
            <h3 className="text-xl font-semibold">Weekly grid</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="info">{total.toFixed(1)}h total</Badge>
            <ChipButton variant="dashed" leading={<Plus className="size-3" aria-hidden="true" />}>
              Add project
            </ChipButton>
            <ChipButton>Same as yesterday</ChipButton>
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[52rem]">
            <div className="grid grid-cols-[12rem_repeat(7,1fr)_5rem] border-b border-border bg-secondary/70 text-xs font-semibold uppercase text-muted-foreground">
              <div className="p-3">Project</div>
              {days.map((day) => (
                <div key={day} className="p-3 text-center">
                  {day}
                </div>
              ))}
              <div className="p-3 text-right">Total</div>
            </div>
            {projects.map((project) => {
              const rowTotal = project.hours.reduce((sum, hours) => sum + hours, 0);
              return (
                <div
                  key={project.id}
                  className={cn(
                    "grid grid-cols-[12rem_repeat(7,1fr)_5rem] border-b border-border last:border-b-0",
                    project.inactive && "opacity-55",
                  )}
                >
                  <div className="flex items-center gap-2 p-3">
                    <span className="size-2.5 rounded-full" style={{ background: project.color }} />
                    <span className="truncate text-sm font-semibold">{project.name}</span>
                  </div>
                  {project.hours.map((hours, index) => (
                    <div key={index} className={cn("p-2", index === 4 && "bg-primary/8")}>
                      <button
                        type="button"
                        disabled={locked}
                        className={cn(
                          "h-10 w-full rounded-[var(--radius-md)] border border-border bg-card text-sm transition hover:border-primary/45 hover:bg-secondary disabled:pointer-events-none",
                          hours > 0 && "border-primary/30 bg-primary/12 text-accent",
                          index > 4 && "border-dashed text-muted-foreground",
                        )}
                      >
                        {hours > 0 ? hours : ""}
                      </button>
                    </div>
                  ))}
                  <div className="p-3 text-right font-ui text-sm font-semibold">
                    {rowTotal.toFixed(1)}
                  </div>
                </div>
              );
            })}
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
