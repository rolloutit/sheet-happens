"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { cn } from "@/src/lib/utils";
import type {
  ChartFrameProps,
  ChartTone,
  DistributionBarListProps,
  TrendChartProps,
} from "./ChartPrimitives.types";

// Each bar is lit by its own hue rather than being a flat block of it — the glow is what makes a
// 8px meter read as a filled level instead of a painted stripe. `color-mix` on the token, not a
// literal rgb(), so the same class works in both themes.
//
// The shadow is written twice because a glow does not survive the polarity flip. Omnidirectional
// bloom off a bright bar on a near-black well reads as light; the same shape in light is a dark
// halo around a dark bar, i.e. a smudge. So light takes a tight DIRECTIONAL shadow instead — the
// bar casting onto the well rather than glowing into it — which is the same claim ("this mark is
// in front") made in the language of the medium. Every string is written out in full: Tailwind
// extracts class names by scanning source text, so a template literal produces no utility at all.
const toneClasses: Record<ChartTone, string> = {
  primary:
    "bg-[linear-gradient(90deg,var(--primary),var(--accent))] shadow-[0_1px_5px_-1px_color-mix(in_srgb,var(--primary)_50%,transparent)] dark:shadow-[0_0_14px_-3px_color-mix(in_srgb,var(--primary)_75%,transparent)]",
  success:
    "bg-success shadow-[0_1px_5px_-1px_color-mix(in_srgb,var(--success)_50%,transparent)] dark:shadow-[0_0_14px_-3px_color-mix(in_srgb,var(--success)_70%,transparent)]",
  warning:
    "bg-warning shadow-[0_1px_5px_-1px_color-mix(in_srgb,var(--warning)_50%,transparent)] dark:shadow-[0_0_14px_-3px_color-mix(in_srgb,var(--warning)_70%,transparent)]",
  danger:
    "bg-destructive shadow-[0_1px_5px_-1px_color-mix(in_srgb,var(--destructive)_50%,transparent)] dark:shadow-[0_0_14px_-3px_color-mix(in_srgb,var(--destructive)_70%,transparent)]",
  neutral: "bg-muted-foreground/45",
};

export function ChartFrame({
  title,
  description,
  actions,
  empty,
  hasData = true,
  className,
  children,
}: ChartFrameProps) {
  return (
    <Card variant="elevated" className={className}>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </CardHeader>
      <CardContent>
        {hasData ? (
          children
        ) : (
          <div className="rounded-[var(--radius-md)] bg-secondary p-4 text-sm text-muted-foreground">
            {empty ?? "No chart data"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TrendChart({
  title = "Trend",
  data,
  valueLabel = "Value",
  height = 220,
  className,
}: TrendChartProps) {
  return (
    <div
      className={cn("min-w-0", className)}
      style={{ height }}
      role="img"
      aria-label={`${title} chart`}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={1}
        minHeight={1}
        initialDimension={{ width: 560, height }}
      >
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <defs>
            {/* A deeper, longer fill than the old 0.35 → 0.02: at that range the area under the
                line was all but invisible against the card, so the chart was a hairline floating
                in an empty box. The two-stop-plus-tail shape keeps the foot of the area from
                banding on 8-bit panels. */}
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.55} />
              <stop offset="55%" stopColor="var(--chart-1)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.03} />
            </linearGradient>
            {/* The stroke's own light. `feDropShadow` rather than a CSS filter so it travels with
                the SVG when the chart is exported or screenshotted.

                The opacity is themed from `globals.css` rather than set here, because a filter
                attribute cannot resolve a `var()` — `flood-opacity` has to be reached as a CSS
                property, which is exactly what `.sheet-trend-glow` does. Light runs it at a
                quarter strength: a bloom around a dark line on a white card is a blurred line,
                not a lit one. */}
            <filter id="trend-glow" x="-20%" y="-40%" width="140%" height="180%">
              <feDropShadow
                className="sheet-trend-glow"
                dx="0"
                dy="0"
                stdDeviation="4"
                floodColor="var(--chart-1)"
              />
            </filter>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: "color-mix(in srgb, var(--muted) 72%, transparent)" }}
            formatter={(value) => [value, valueLabel]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--chart-1)"
            fill="url(#trend-fill)"
            strokeWidth={2.5}
            filter="url(#trend-glow)"
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DistributionBarList({
  items,
  totalLabel = "Total",
  className,
}: DistributionBarListProps) {
  const total = Math.max(
    1,
    items.reduce((sum, item) => sum + item.value, 0),
  );

  return (
    <div className={cn("grid gap-3", className)}>
      {items.map((item) => {
        const width = Math.max(0, Math.min(100, (item.value / total) * 100));

        return (
          <div key={item.id} className="grid gap-1">
            <div className="flex justify-between gap-3 text-sm">
              <span className="font-ui font-semibold">{item.label}</span>
              <span className="text-muted-foreground">{item.detail ?? item.value}</span>
            </div>
            <div
              // The well sits *below* the card, not level with it — `--secondary` is the hover
              // fill and only a step above the card, so the empty part of the meter used to
              // disappear into it and the bar had nothing to read against.
              className="h-2 rounded-full bg-surface-inset ring-1 ring-inset ring-border"
              role="meter"
              aria-label={`${item.label}, ${item.value} of ${totalLabel}`}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={item.value}
            >
              <span
                className={cn("block h-2 rounded-full", toneClasses[item.tone ?? "primary"])}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
