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

const toneClasses: Record<ChartTone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  neutral: "bg-muted",
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
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.02} />
            </linearGradient>
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
            stroke="var(--primary)"
            fill="url(#trend-fill)"
            strokeWidth={2}
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
              className="h-2 rounded-full bg-secondary"
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
