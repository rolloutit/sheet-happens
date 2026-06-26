import type { ReactNode } from "react";

export type ChartTone = "primary" | "success" | "warning" | "danger" | "neutral";

export type ChartFrameProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  empty?: ReactNode;
  hasData?: boolean;
  className?: string;
  children: ReactNode;
};

export type TrendChartDatum = {
  label: string;
  value: number;
};

export type TrendChartProps = {
  title?: string;
  data: TrendChartDatum[];
  valueLabel?: string;
  height?: number;
  className?: string;
};

export type DistributionBarItem = {
  id: string;
  label: string;
  value: number;
  detail?: ReactNode;
  tone?: ChartTone;
};

export type DistributionBarListProps = {
  items: DistributionBarItem[];
  totalLabel?: string;
  className?: string;
};
