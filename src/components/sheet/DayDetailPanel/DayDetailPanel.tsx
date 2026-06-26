import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { IconButton } from "@/src/components/ui/IconButton";
import { cn } from "@/src/lib/utils";
import { EmptyState } from "../EmptyState";
import { StatusPill } from "../StatusPill";
import type { DayDetailEntry, DayDetailPanelProps } from "./DayDetailPanel.types";

function formatHours(hours: number) {
  return `${Number(hours.toFixed(2))}h`;
}

export function DayDetailPanel({
  dateLabel,
  entries,
  capacityHours = 8,
  labels,
  className,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
}: DayDetailPanelProps) {
  const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
  const overCapacity = totalHours > capacityHours;

  return (
    <Card variant="elevated" className={className}>
      <CardHeader>
        <div>
          <CardTitle>{labels?.title ?? "Day detail"}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{dateLabel}</p>
        </div>
        {onAddEntry ? (
          <Button type="button" size="sm" icon={Plus} onClick={onAddEntry}>
            {labels?.addEntry ?? "Add entry"}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-secondary/60 p-4 sm:grid-cols-2">
          <Metric label={labels?.total ?? "Total"} value={formatHours(totalHours)} />
          <Metric
            label={labels?.capacity ?? "Capacity"}
            value={formatHours(capacityHours)}
            tone={overCapacity ? "warning" : undefined}
          />
        </div>
        {entries.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={labels?.empty ?? "No entries for this day"}
            body="Create a time entry to fill this day."
          />
        ) : (
          <div className="grid gap-2">
            {entries.map((entry) => (
              <DayEntryRow
                key={entry.id}
                entry={entry}
                labels={labels}
                onEditEntry={onEditEntry}
                onDeleteEntry={onDeleteEntry}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return (
    <div>
      <p className="font-ui text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-semibold", tone === "warning" && "text-warning")}>{value}</p>
    </div>
  );
}

function DayEntryRow({
  entry,
  labels,
  onEditEntry,
  onDeleteEntry,
}: {
  entry: DayDetailEntry;
  labels?: DayDetailPanelProps["labels"];
  onEditEntry?: (entry: DayDetailEntry) => void;
  onDeleteEntry?: (entry: DayDetailEntry) => void;
}) {
  return (
    <div className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-3 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: entry.projectColor ?? "var(--primary)" }}
            aria-hidden="true"
          />
          <p className="font-ui text-sm font-semibold">{entry.projectName}</p>
          <Badge tone={entry.billable === false ? "neutral" : "success"}>
            {entry.billable === false ? "Non-billable" : "Billable"}
          </Badge>
          {entry.status ? <StatusPill status={entry.status} density="compact" /> : null}
        </div>
        {entry.note ? <p className="mt-1 text-sm text-muted-foreground">{entry.note}</p> : null}
      </div>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <span className="font-ui text-sm font-semibold">{formatHours(entry.hours)}</span>
        {onEditEntry ? (
          <IconButton
            icon={Pencil}
            label={labels?.editEntry?.(entry) ?? `Edit ${entry.projectName}`}
            size="sm"
            onClick={() => onEditEntry(entry)}
          />
        ) : null}
        {onDeleteEntry ? (
          <IconButton
            icon={Trash2}
            label={labels?.deleteEntry?.(entry) ?? `Delete ${entry.projectName}`}
            size="sm"
            variant="danger"
            onClick={() => onDeleteEntry(entry)}
          />
        ) : null}
      </div>
    </div>
  );
}
