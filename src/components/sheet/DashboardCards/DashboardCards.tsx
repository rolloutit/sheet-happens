import { AlertCircle, ArrowUpRight, CheckCircle2, Clock3, Send, TrendingUp } from "lucide-react";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Checkbox } from "@/src/components/ui/Checkbox";
import { cn } from "@/src/lib/utils";
import type { DashboardCardsProps } from "./DashboardCards.types";

export function DashboardCards({
  name = "Lena",
  role = "contractor",
  className,
}: DashboardCardsProps) {
  return (
    <div className={cn("grid gap-4", className)}>
      <Card variant="featured">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge tone={role === "admin" ? "warning" : "info"}>{role}</Badge>
            <h2 className="mt-3 text-2xl font-semibold">Good morning, {name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              June timesheet is 82 percent complete.
            </p>
          </div>
          <Button variant="cta" icon={Send}>
            Submit timesheet
          </Button>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Logged" value="132.5h" trend="+8%" />
        <StatCard label="Billable" value="EUR 8,945" trend="+12%" />
        <StatCard label="Missing days" value="2" warning />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <PriorityCard />
        <StatusOverview />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  trend,
  warning,
}: {
  label: string;
  value: string;
  trend?: string;
  warning?: boolean;
}) {
  return (
    <Card variant={warning ? "warning" : "elevated"}>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
        {warning ? (
          <AlertCircle className="size-5 text-warning" aria-hidden="true" />
        ) : (
          <Clock3 className="size-5 text-accent" aria-hidden="true" />
        )}
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">{value}</p>
        {trend ? (
          <span className="inline-flex items-center gap-1 text-sm text-success">
            <TrendingUp className="size-4" aria-hidden="true" />
            {trend}
          </span>
        ) : (
          <p className="text-sm text-muted-foreground">Needs attention</p>
        )}
        <Sparkline />
      </CardContent>
    </Card>
  );
}

function Sparkline() {
  return (
    <div className="mt-2 flex h-10 items-end gap-1" aria-hidden="true">
      {[30, 48, 35, 64, 58, 82, 72].map((height, index) => (
        <span
          key={index}
          className="w-full rounded-t bg-primary/45"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}

function PriorityCard() {
  return (
    <Card variant="elevated">
      <CardHeader>
        <div>
          <CardTitle>Priority action</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Month-end checklist</p>
        </div>
        <Badge tone="warning">Due soon</Badge>
      </CardHeader>
      <CardContent>
        {["Review missing descriptions", "Upload invoice", "Confirm bank data"].map(
          (label, index) => (
            <label
              key={label}
              className="flex items-center gap-3 rounded-[var(--radius-md)] bg-secondary p-3"
            >
              <Checkbox checked={index === 0} />
              <span className="text-sm">{label}</span>
            </label>
          ),
        )}
      </CardContent>
    </Card>
  );
}

function StatusOverview() {
  const segments = [
    { label: "Submitted", value: 46, color: "bg-primary" },
    { label: "Approved", value: 32, color: "bg-success" },
    { label: "Rejected", value: 12, color: "bg-destructive" },
    { label: "Missing", value: 10, color: "bg-muted" },
  ];
  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle>Status overview</CardTitle>
        <Button variant="ghost" size="sm" icon={ArrowUpRight}>
          Open
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex h-3 overflow-hidden rounded-full bg-secondary">
          {segments.map((segment) => (
            <span
              key={segment.label}
              className={segment.color}
              style={{ width: `${segment.value}%` }}
            />
          ))}
        </div>
        <div className="grid gap-2">
          {segments.map((segment) => (
            <div key={segment.label} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-muted-foreground" aria-hidden="true" />
                {segment.label}
              </span>
              <span className="font-ui font-semibold">{segment.value}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
