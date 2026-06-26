import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type StatCardTone = "neutral" | "info" | "success" | "warning" | "danger";
export type StatTrendDirection = "up" | "down" | "flat";

export type StatCardTrend = {
  label: ReactNode;
  direction?: StatTrendDirection;
  "aria-label"?: string;
};

export type StatCardSparkline = {
  points: number[];
  tone?: StatCardTone;
  "aria-label"?: string;
};

export type StatCardProps = {
  label: ReactNode;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: StatCardTone;
  trend?: StatCardTrend;
  helperText?: ReactNode;
  sparkline?: StatCardSparkline | number[];
  loading?: boolean;
  className?: string;
};
