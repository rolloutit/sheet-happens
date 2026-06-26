import { AlertCircle, Minus, TrendingDown, TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Skeleton } from "@/src/components/ui/Skeleton";
import { cn } from "@/src/lib/utils";
import type {
  StatCardProps,
  StatCardSparkline,
  StatCardTone,
  StatTrendDirection,
} from "./StatCard.types";

const toneText: Record<StatCardTone, string> = {
  neutral: "text-muted-foreground",
  info: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

const toneBar: Record<StatCardTone, string> = {
  neutral: "bg-muted",
  info: "bg-primary/45",
  success: "bg-success/55",
  warning: "bg-warning/55",
  danger: "bg-destructive/55",
};

function normalizeSparkline(sparkline: StatCardProps["sparkline"]): StatCardSparkline | undefined {
  if (!sparkline) return undefined;
  if (Array.isArray(sparkline)) return { points: sparkline };
  return sparkline;
}

function normalizePoint(point: number, max: number) {
  if (!Number.isFinite(point) || max <= 0) return 8;
  return Math.max(8, Math.round((point / max) * 100));
}

function TrendIcon({ direction }: { direction?: StatTrendDirection }) {
  if (direction === "down") return <TrendingDown className="size-4" aria-hidden="true" />;
  if (direction === "flat") return <Minus className="size-4" aria-hidden="true" />;
  return <TrendingUp className="size-4" aria-hidden="true" />;
}

function StatSparkline({ sparkline, tone }: { sparkline: StatCardSparkline; tone: StatCardTone }) {
  const points = sparkline.points.filter((point) => Number.isFinite(point));
  const max = Math.max(...points, 0);

  return (
    <div
      className="mt-2 flex h-10 items-end gap-1"
      aria-label={sparkline["aria-label"]}
      aria-hidden={sparkline["aria-label"] ? undefined : true}
      role={sparkline["aria-label"] ? "img" : undefined}
    >
      {points.length > 0 ? (
        points.map((point, index) => (
          <span
            key={`${point}-${index}`}
            className={cn("w-full rounded-t", toneBar[sparkline.tone ?? tone])}
            style={{ height: `${normalizePoint(point, max)}%` }}
          />
        ))
      ) : (
        <span className="h-px w-full rounded bg-border" />
      )}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "info",
  trend,
  helperText,
  sparkline,
  loading,
  className,
}: StatCardProps) {
  const normalizedSparkline = normalizeSparkline(sparkline);
  const warning = tone === "warning" || tone === "danger";
  const StatusIcon = Icon ?? (warning ? AlertCircle : undefined);
  const trendTone =
    trend?.direction === "down"
      ? "text-destructive"
      : trend?.direction === "flat"
        ? "text-muted-foreground"
        : "text-success";

  return (
    <Card variant={warning ? "warning" : "elevated"} className={className} aria-busy={loading}>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
        {StatusIcon ? (
          <StatusIcon className={cn("size-5", toneText[tone])} aria-hidden="true" />
        ) : null}
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10" />
          </>
        ) : (
          <>
            <p className="text-3xl font-semibold">{value}</p>
            {trend ? (
              <span
                className={cn("inline-flex items-center gap-1 text-sm", trendTone)}
                aria-label={trend["aria-label"]}
              >
                <TrendIcon direction={trend.direction} />
                {trend.label}
              </span>
            ) : helperText ? (
              <p className="text-sm text-muted-foreground">{helperText}</p>
            ) : null}
            {normalizedSparkline ? (
              <StatSparkline sparkline={normalizedSparkline} tone={tone} />
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
