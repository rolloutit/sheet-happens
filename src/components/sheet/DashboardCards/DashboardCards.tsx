import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileWarning,
  Send,
  TrendingUp,
  Users,
} from "lucide-react";

import { Avatar } from "@/src/components/ui/Avatar";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Checkbox } from "@/src/components/ui/Checkbox";
import { cn } from "@/src/lib/utils";
import type { DashboardCardsProps } from "./DashboardCards.types";

export function DashboardCards({
  name = "Márta",
  role = "contractor",
  className,
}: DashboardCardsProps) {
  const isAdmin = role === "admin";

  return (
    <div className={cn("grid gap-5", className)}>
      <section className="flex flex-col gap-4 rounded-[var(--radius-xl)] border border-border bg-card/80 p-5 shadow-panel md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={name} size="lg" tone={isAdmin ? "teal" : "deep"} />
          <div>
            <Badge tone={isAdmin ? "warning" : "info"}>{isAdmin ? "admin" : role}</Badge>
            <h2 className="mt-3 text-2xl font-semibold">Jó reggelt, {name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdmin
                ? "12 beküldés vár jóváhagyásra a júniusi zárás előtt."
                : "A júniusi timesheet 82 százalékban kész."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="soft" icon={ArrowUpRight}>
            Riport megnyitása
          </Button>
          <Button variant="cta" icon={Send}>
            {isAdmin ? "Jóváhagyási sor" : "Timesheet beküldése"}
          </Button>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Rögzített órák" value="1 284h" trend="+8%" />
        <StatCard label="Billable érték" value="EUR 86k" trend="+12%" />
        <StatCard label="Beküldve" value="48" icon="users" trend="+6" />
        <StatCard label="Hiányzó napok" value="17" warning />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        {isAdmin ? <FlaggedUsers /> : <PriorityCard />}
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
  icon,
}: {
  label: string;
  value: string;
  trend?: string;
  warning?: boolean;
  icon?: "clock" | "users";
}) {
  return (
    <Card variant={warning ? "warning" : "elevated"}>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
        {warning ? (
          <AlertCircle className="size-5 text-warning" aria-hidden="true" />
        ) : icon === "users" ? (
          <Users className="size-5 text-accent" aria-hidden="true" />
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
          <p className="text-sm text-muted-foreground">Figyelmet igényel</p>
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
          <CardTitle>Prioritás</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Hózárási ellenőrzőlista</p>
        </div>
        <Badge tone="warning">Hamarosan</Badge>
      </CardHeader>
      <CardContent>
        {["Hiányzó leírások ellenőrzése", "Számla feltöltése", "Bankadatok megerősítése"].map(
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

function FlaggedUsers() {
  const users = [
    { name: "Kovács Anna", detail: "2 hiányzó nap", tone: "warning" },
    { name: "Tóth Bence", detail: "számla nélkül", tone: "danger" },
    { name: "Nagy Eszter", detail: "jóváhagyásra vár", tone: "info" },
  ] as const;

  return (
    <Card variant="elevated">
      <CardHeader>
        <div>
          <CardTitle>Figyelmet igényel</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Admin teendők a zárás előtt</p>
        </div>
        <Badge tone="warning">3 jelzés</Badge>
      </CardHeader>
      <CardContent>
        {users.map((user) => (
          <div
            key={user.name}
            className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-secondary p-3"
          >
            <div className="flex items-center gap-3">
              <Avatar name={user.name} size="sm" tone="deep" />
              <div>
                <p className="text-sm font-semibold">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.detail}</p>
              </div>
            </div>
            <FileWarning
              className={cn("size-4", user.tone === "danger" ? "text-destructive" : "text-warning")}
              aria-hidden="true"
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function StatusOverview() {
  const segments = [
    { label: "Beküldve", value: 46, color: "bg-primary" },
    { label: "Jóváhagyva", value: 32, color: "bg-success" },
    { label: "Elutasítva", value: 12, color: "bg-destructive" },
    { label: "Hiányzik", value: 10, color: "bg-muted" },
  ];
  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle>Státusz áttekintés</CardTitle>
        <Button variant="ghost" size="sm" icon={ArrowUpRight}>
          Megnyitás
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
