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

// Quiet bars with only the final one at full strength (docs/dark-mode-redesign.md §6) — the
// sparkline reports a trend, so the accent belongs on "now", not on every bar.
const toneBar: Record<StatCardTone, string> = {
  neutral: "bg-muted",
  info: "bg-primary/30",
  success: "bg-success/30",
  warning: "bg-warning/30",
  danger: "bg-destructive/30",
};

const toneBarFinal: Record<StatCardTone, string> = {
  neutral: "bg-muted-foreground/40",
  info: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
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
            className={cn(
              "w-full rounded-t",
              index === points.length - 1
                ? toneBarFinal[sparkline.tone ?? tone]
                : toneBar[sparkline.tone ?? tone],
            )}
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
    <Card
      variant={warning ? "warning" : "elevated"}
      className={cn("relative overflow-hidden", className)}
      aria-busy={loading}
    >
      {/* The brand quarter-circle, clipped by the card's own overflow — how the atmosphere's
          language reaches inside an opaque surface (docs/dark-mode-redesign.md §5, Layer 5). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-9 -top-9 size-24 rounded-full border border-accent-line bg-[radial-gradient(circle_at_center,var(--accent-soft),transparent_72%)]"
      />
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
            <p className="text-3xl font-medium tracking-[-0.02em] tabular-nums">{value}</p>
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
