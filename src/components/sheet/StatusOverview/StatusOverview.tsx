import { CheckCircle2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { cn } from "@/src/lib/utils";
import type {
  StatusOverviewProps,
  StatusOverviewSegment,
  StatusOverviewTone,
} from "./StatusOverview.types";

const toneClass: Record<StatusOverviewTone, string> = {
  info: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  neutral: "bg-muted",
};

const legendClass: Record<StatusOverviewTone, string> = {
  info: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  neutral: "text-muted-foreground",
};

function getTotal(segments: StatusOverviewSegment[]) {
  return segments.reduce((total, segment) => total + Math.max(0, segment.value), 0);
}

function getPercent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((Math.max(0, value) / total) * 100);
}

export function StatusOverview({
  title = "Státusz áttekintés",
  action,
  segments,
  empty = "No status data",
  valueFormatter = (_value, percent) => `${percent}%`,
  className,
}: StatusOverviewProps) {
  const total = getTotal(segments);
  const hasData = segments.length > 0 && total > 0;

  return (
    <Card variant="elevated" className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>
        {hasData ? (
          <>
            <div
              className="flex h-3 overflow-hidden rounded-full bg-secondary"
              role="img"
              aria-label="Status distribution"
            >
              {segments.map((segment) => {
                const percent = getPercent(segment.value, total);
                return (
                  <span
                    key={segment.id}
                    className={toneClass[segment.tone ?? "neutral"]}
                    style={{ width: `${percent}%` }}
                    title={`${segment.label}: ${percent}%`}
                  />
                );
              })}
            </div>
            <div className="grid gap-2">
              {segments.map((segment) => {
                const tone = segment.tone ?? "neutral";
                const percent = getPercent(segment.value, total);
                return (
                  <div key={segment.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <CheckCircle2
                        className={cn("size-4 shrink-0", legendClass[tone])}
                        aria-hidden="true"
                      />
                      <span className="truncate">{segment.label}</span>
                    </span>
                    <span className="font-ui font-semibold">
                      {valueFormatter(segment.value, percent)}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="rounded-[var(--radius-md)] bg-secondary p-4 text-sm text-muted-foreground">
            {empty}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
