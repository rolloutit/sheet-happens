"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import type { ReportChartCardProps } from "./ReportChartCard.types";

export function ReportChartCard({
  title = "Charts",
  data,
  distribution = [],
  valueLabel = "Hours",
  empty = "No report data for the selected filters.",
  className,
}: ReportChartCardProps) {
  const hasData = data.length > 0;

  return (
    <Card variant="elevated" className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-56" role="img" aria-label={`${title} chart`}>
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={1}
              minHeight={1}
              initialDimension={{ width: 560, height: 224 }}
            >
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "color-mix(in srgb, var(--muted) 72%, transparent)" }}
                  labelClassName="font-ui"
                  formatter={(value) => [value, valueLabel]}
                />
                <Bar dataKey="value" fill="var(--chart-1)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-[var(--radius-md)] bg-secondary p-4 text-sm text-muted-foreground">
            {empty}
          </div>
        )}
        {distribution.length > 0 ? (
          <div className="grid gap-2">
            {distribution.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[5rem_1fr_auto] items-center gap-3 text-sm"
              >
                <span>{item.label}</span>
                <span className="h-2 rounded-full bg-secondary">
                  <span
                    className="block h-2 rounded-full bg-cta"
                    style={{ width: `${Math.max(0, Math.min(100, item.value))}%` }}
                  />
                </span>
                <span className="font-ui font-semibold">{item.value}%</span>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
