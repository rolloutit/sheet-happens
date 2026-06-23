import { CalendarRange, Edit3, Search, Trash2, UserPlus } from "lucide-react";

import { Avatar } from "@/src/components/ui/Avatar";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { ChipButton } from "@/src/components/ui/ChipButton";
import { DataTable } from "@/src/components/ui/Table";
import { IconButton } from "@/src/components/ui/IconButton";
import { Input } from "@/src/components/ui/Input";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import { Switch } from "@/src/components/ui/Switch";
import { cn } from "@/src/lib/utils";
import type { ManagementViewsProps } from "./ManagementViews.types";

type PersonRow = {
  id: string;
  name: string;
  email: string;
  profile: string;
  state: string;
  currency: string;
};

const people: PersonRow[] = [
  {
    id: "1",
    name: "Lena Kovacs",
    email: "lena@example.com",
    profile: "Contractor",
    state: "Active",
    currency: "EUR",
  },
  {
    id: "2",
    name: "Mark Chen",
    email: "mark@example.com",
    profile: "Employee",
    state: "Active",
    currency: "HUF",
  },
];

export function ManagementViews({ view = "people", className }: ManagementViewsProps) {
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
            items={[
              { value: "people", label: "People" },
              { value: "projects", label: "Projects" },
              { value: "rates", label: "Rates" },
            ]}
          />
          <Button variant="cta" icon={UserPlus}>
            Invite
          </Button>
        </div>
      </Card>
      {view === "people" ? <PeopleTable /> : null}
      {view === "projects" ? <ProjectsGrid /> : null}
      {view === "rates" ? <RatesRoster /> : null}
      <ProjectDrawerPreview />
    </div>
  );
}

function PeopleTable() {
  return (
    <DataTable
      rows={people}
      getRowKey={(row) => row.id}
      columns={[
        {
          id: "name",
          header: "Person",
          cell: (row) => (
            <div className="flex items-center gap-3">
              <Avatar name={row.name} size="sm" />
              <div>
                <p className="font-ui text-sm font-semibold text-foreground">{row.name}</p>
                <p className="text-xs text-muted-foreground">{row.email}</p>
              </div>
            </div>
          ),
        },
        {
          id: "profile",
          header: "Profile",
          cell: (row) => <Badge tone="cta">{row.profile}</Badge>,
        },
        { id: "state", header: "State", cell: (row) => <Badge tone="success">{row.state}</Badge> },
        { id: "currency", header: "Currency", accessor: "currency" },
        {
          id: "actions",
          header: "",
          cell: () => (
            <div className="flex justify-end gap-2">
              <IconButton icon={Edit3} label="Edit person" size="sm" />
              <IconButton icon={Trash2} label="Delete person" size="sm" variant="danger" />
            </div>
          ),
          align: "right",
        },
      ]}
    />
  );
}

function ProjectsGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {["Apollo Migration", "Helix Support"].map((name, index) => (
        <Card key={name} clickable variant={index === 0 ? "selected" : "elevated"}>
          <CardHeader>
            <div>
              <CardTitle>{name}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Client delivery · Active</p>
            </div>
            <Switch checked={index === 0} />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <ChipButton>Frontend</ChipButton>
              <ChipButton>Backend</ChipButton>
              <ChipButton>+3 more</ChipButton>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarRange className="size-4" aria-hidden="true" />
              Jan 2026 to Dec 2026
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RatesRoster() {
  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle>Rate timeline</CardTitle>
        <Badge tone="warning">2 missing rates</Badge>
      </CardHeader>
      <CardContent>
        {["Central rate", "Apollo override", "Helix override"].map((label, index) => (
          <div
            key={label}
            className="grid gap-2 rounded-[var(--radius-md)] bg-secondary p-3 md:grid-cols-[1fr_auto_auto] md:items-center"
          >
            <p className="font-ui text-sm font-semibold">{label}</p>
            <Badge tone={index === 0 ? "success" : "info"}>
              {index === 0 ? "Current" : "Override"}
            </Badge>
            <p className="font-ui text-sm font-semibold">EUR {index === 0 ? 65 : 72}/h</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ProjectDrawerPreview() {
  return (
    <Card variant="elevated">
      <CardHeader>
        <div>
          <CardTitle>Project drawer preview</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Active switch, members, date range, notes, and rate source flags.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          <label className="flex items-center justify-between rounded-[var(--radius-md)] bg-secondary p-3">
            <span className="font-ui text-sm font-semibold">Active project</span>
            <Switch checked />
          </label>
          <div className="flex flex-wrap gap-2">
            {people.map((person) => (
              <ChipButton key={person.id}>{person.name}</ChipButton>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
