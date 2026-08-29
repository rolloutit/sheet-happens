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

// The sparkline reports a trend, so "now" still carries the accent — but the history behind it is
// a lit gradient rather than a flat 30% wash. A single-alpha tone over the dark card composited to
// a dark, desaturated slab (the old `bg-destructive/30` landed at C 0.03, a mud brown), which is
// what made these bars read as camouflage blotches. A vertical ramp from a stronger alpha at the
// bar's head to a weaker one at its foot gives the same recessive weight while keeping the hue.
//
// These sparklines are decorative single-series indicators, not categorical data, so they are free
// to use the brand signal at full strength; `--chart-*` is reserved for the categorical ramp and
// is bound by the validator's mark-lightness band. That is why "now" can be brighter here than any
// chart mark is allowed to be.
// Every stop goes through `color-mix` on the token rather than a literal rgb() of the dark-mode
// value: these classes render in both themes, and light's `--primary` is a different colour
// entirely. Same reason `ChartPrimitives` mixes its tooltip cursor.
//
// Written out in full rather than built by a helper — Tailwind extracts class names by scanning
// source text, so a template literal assembled at runtime produces no utility at all.
const toneBar: Record<StatCardTone, string> = {
  neutral:
    "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--muted-foreground)_34%,transparent),color-mix(in_srgb,var(--muted-foreground)_14%,transparent))]",
  info: "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary)_62%,transparent),color-mix(in_srgb,var(--primary)_22%,transparent))]",
  success:
    "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--success)_62%,transparent),color-mix(in_srgb,var(--success)_22%,transparent))]",
  warning:
    "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--warning)_62%,transparent),color-mix(in_srgb,var(--warning)_22%,transparent))]",
  danger:
    "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--destructive)_62%,transparent),color-mix(in_srgb,var(--destructive)_22%,transparent))]",
};

// The corner light, per tone. Literal class strings for the same extraction reason as above.
const toneGlow: Record<StatCardTone, string> = {
  neutral:
    "bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--muted-foreground)_16%,transparent),transparent_70%)]",
  info: "bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--accent)_26%,transparent),transparent_70%)]",
  success:
    "bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--success)_24%,transparent),transparent_70%)]",
  warning:
    "bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--warning)_24%,transparent),transparent_70%)]",
  danger:
    "bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--destructive)_26%,transparent),transparent_70%)]",
};

// The final bar is the one lit element: full-strength fill plus a glow of its own hue, so the eye
// lands on "now" without needing a label. The glow is dark-only and light takes a tight
// directional cast instead, for the reason spelled out in `ChartPrimitives` — an omnidirectional
// bloom is light on a dark ground and a smudge on a pale one, so the claim has to be restated as a
// shadow rather than transplanted.
const toneBarFinal: Record<StatCardTone, string> = {
  neutral: "bg-muted-foreground/55",
  info: "bg-[linear-gradient(180deg,var(--accent),var(--primary))] shadow-[0_2px_6px_-1px_color-mix(in_srgb,var(--primary)_50%,transparent)] dark:shadow-[0_0_16px_-2px_color-mix(in_srgb,var(--primary)_72%,transparent)]",
  success:
    "bg-success shadow-[0_2px_6px_-1px_color-mix(in_srgb,var(--success)_50%,transparent)] dark:shadow-[0_0_16px_-2px_color-mix(in_srgb,var(--success)_72%,transparent)]",
  warning:
    "bg-warning shadow-[0_2px_6px_-1px_color-mix(in_srgb,var(--warning)_50%,transparent)] dark:shadow-[0_0_16px_-2px_color-mix(in_srgb,var(--warning)_72%,transparent)]",
  danger:
    "bg-destructive shadow-[0_2px_6px_-1px_color-mix(in_srgb,var(--destructive)_50%,transparent)] dark:shadow-[0_0_16px_-2px_color-mix(in_srgb,var(--destructive)_72%,transparent)]",
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
  const alert = tone === "warning" || tone === "danger";
  // Tone-matched rather than lumping danger in with warning: a rose stat card used to get an
  // amber ground, and amber under rose marks is mud.
  const cardVariant = tone === "danger" ? "danger" : tone === "warning" ? "warning" : "elevated";
  const StatusIcon = Icon ?? (alert ? AlertCircle : undefined);
  const trendTone =
    trend?.direction === "down"
      ? "text-destructive"
      : trend?.direction === "flat"
        ? "text-muted-foreground"
        : "text-success";

  return (
    <Card
      variant={cardVariant}
      className={cn("relative overflow-hidden", className)}
      aria-busy={loading}
    >
      {/* The brand quarter-circle, clipped by the card's own overflow — how the atmosphere's
          language reaches inside an opaque surface (docs/dark-mode-redesign.md §5, Layer 5).

          No outline ring: with `--accent-line` raised to 42% the ring resolved into a hard circle
          edge, and a complete shape reads as a sticker rather than as light (the doc's own rule for
          the blobs, §5 Layer 2). Pure gradient, blurred, so only the glow survives. It also takes
          the card's own tone — a mint glow in the corner of a rose danger card was the same
          mismatch as the amber ground it used to sit on. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -right-12 -top-12 size-36 rounded-full blur-lg",
          toneGlow[tone],
        )}
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
