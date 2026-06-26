import type { ReactNode } from "react";

export type ReportChartDatum = {
  label: string;
  value: number;
};

export type ReportDistributionItem = {
  id: string;
  label: ReactNode;
  value: number;
};

export type ReportChartCardProps = {
  title?: ReactNode;
  data: ReportChartDatum[];
  distribution?: ReportDistributionItem[];
  valueLabel?: string;
  empty?: ReactNode;
  className?: string;
};
