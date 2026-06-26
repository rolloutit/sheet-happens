"use client";

import { CalendarRange, Search, UserPlus } from "lucide-react";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { ChipButton } from "@/src/components/ui/ChipButton";
import { Input } from "@/src/components/ui/Input";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import { Switch } from "@/src/components/ui/Switch";
import { cn } from "@/src/lib/utils";
import { PeopleTable } from "../PeopleTable";
import { ProjectDrawer } from "../ProjectDrawer";
import { RateDrawer } from "../RateDrawer";
import type { ProjectDrawerData } from "../ProjectDrawer";
import type { RateDrawerData } from "../RateDrawer";
import type { ManagementView, ManagementViewsProps } from "./ManagementViews.types";

const defaultPeople = [
  {
    id: "1",
    name: "Lena Kovacs",
    email: "lena@example.com",
    profile: "Contractor",
    state: "active",
    currency: "EUR",
  },
  {
    id: "2",
    name: "Mark Chen",
    email: "mark@example.com",
    profile: "Employee",
    state: "active",
    currency: "HUF",
  },
] satisfies NonNullable<ManagementViewsProps["people"]>;

const defaultProjects = [
  {
    id: "apollo",
    name: "Apollo Migration",
    description: "Client delivery · Active",
    active: true,
    dateRange: "Jan 2026 to Dec 2026",
    tags: ["Frontend", "Backend", "+3 more"],
    members: [
      { id: "1", name: "Lena Kovacs" },
      { id: "2", name: "Mark Chen" },
    ],
    notes: "Migration squad with mixed rate sources.",
    rateSource: "Project override",
  },
  {
    id: "helix",
    name: "Helix Support",
    description: "Support retainer · Active",
    active: false,
    dateRange: "Feb 2026 to Nov 2026",
    tags: ["Support", "SLA"],
    members: [{ id: "2", name: "Mark Chen" }],
    notes: "Awaiting refreshed contract window.",
    rateSource: "Central rate",
  },
] satisfies ProjectDrawerData[];

const defaultRates = [
  {
    id: "central",
    label: "Central rate",
    scope: "Default contractor rate",
    amount: 65,
    currency: "EUR",
    unit: "hour",
    effectiveFrom: "2026-01-01",
    status: "current",
  },
  {
    id: "apollo",
    label: "Apollo override",
    scope: "Apollo Migration",
    amount: 72,
    currency: "EUR",
    unit: "hour",
    effectiveFrom: "2026-02-01",
    status: "override",
  },
  {
    id: "helix",
    label: "Helix override",
    scope: "Helix Support",
    amount: 72,
    currency: "EUR",
    unit: "hour",
    effectiveFrom: "2026-03-01",
    status: "override",
  },
] satisfies RateDrawerData[];

export function ManagementViews({
  view = "people",
  onViewChange,
  people = defaultPeople,
  projects = defaultProjects,
  rates = defaultRates,
  onPersonEdit,
  onPersonDelete,
  onProjectSave,
  onProjectActiveChange,
  onRateSave,
  onInvite,
  className,
}: ManagementViewsProps) {
  return (
    <div className={cn("grid gap-4", className)}>
      <Card variant="elevated">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input className="pl-9" placeholder={`Search ${view}`} />
          </div>
          <SegmentedControl
            label="Management view"
            value={view}
            onValueChange={(nextView) => onViewChange?.(nextView as ManagementView)}
            items={[
              { value: "people", label: "People" },
              { value: "projects", label: "Projects" },
              { value: "rates", label: "Rates" },
            ]}
          />
          <Button type="button" variant="cta" icon={UserPlus} onClick={onInvite}>
            Invite
          </Button>
        </div>
      </Card>
      {view === "people" ? (
        <PeopleTable rows={people} onEdit={onPersonEdit} onDelete={onPersonDelete} />
      ) : null}
      {view === "projects" ? (
        <ProjectsGrid
          projects={projects}
          onProjectSave={onProjectSave}
          onProjectActiveChange={onProjectActiveChange}
        />
      ) : null}
      {view === "rates" ? <RatesRoster rates={rates} onRateSave={onRateSave} /> : null}
    </div>
  );
}

function ProjectsGrid({
  projects,
  onProjectSave,
  onProjectActiveChange,
}: {
  projects: ProjectDrawerData[];
  onProjectSave?: ManagementViewsProps["onProjectSave"];
  onProjectActiveChange?: ManagementViewsProps["onProjectActiveChange"];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {projects.map((project, index) => (
        <Card key={project.id} clickable variant={index === 0 ? "selected" : "elevated"}>
          <CardHeader>
            <div>
              <CardTitle>{project.name}</CardTitle>
              {project.description ? (
                <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
              ) : null}
            </div>
            <Switch checked={project.active} aria-label={`${project.name} active`} />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {project.tags?.map((tag) => (
                <ChipButton key={tag}>{tag}</ChipButton>
              ))}
            </div>
            {project.dateRange ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarRange className="size-4" aria-hidden="true" />
                {project.dateRange}
              </div>
            ) : null}
            <ProjectDrawer
              project={project}
              onSave={onProjectSave}
              onActiveChange={(active) => onProjectActiveChange?.(project, active)}
              trigger={
                <Button type="button" variant="soft" size="sm">
                  Edit project
                </Button>
              }
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RatesRoster({
  rates,
  onRateSave,
}: {
  rates: RateDrawerData[];
  onRateSave?: ManagementViewsProps["onRateSave"];
}) {
  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle>Rate timeline</CardTitle>
        <Badge tone="warning">
          {rates.filter((rate) => rate.status === "missing").length || 2} missing rates
        </Badge>
      </CardHeader>
      <CardContent>
        {rates.map((rate) => (
          <div
            key={rate.id}
            className="grid gap-2 rounded-[var(--radius-md)] bg-secondary p-3 md:grid-cols-[1fr_auto_auto] md:items-center"
          >
            <p className="font-ui text-sm font-semibold">{rate.label}</p>
            <Badge tone={rate.status === "current" ? "success" : "info"}>
              {rate.status ?? "current"}
            </Badge>
            <div className="flex items-center justify-between gap-3">
              <p className="font-ui text-sm font-semibold">
                {rate.currency} {rate.amount}/{rate.unit ?? "h"}
              </p>
              <RateDrawer
                rate={rate}
                onSave={onRateSave}
                trigger={
                  <Button type="button" variant="ghost" size="sm">
                    Edit
                  </Button>
                }
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
