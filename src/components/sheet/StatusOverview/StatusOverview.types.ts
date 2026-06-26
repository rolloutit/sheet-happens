import type { ReactNode } from "react";

export type StatusOverviewTone = "info" | "success" | "warning" | "danger" | "neutral";

export type StatusOverviewSegment = {
  id: string;
  label: ReactNode;
  value: number;
  tone?: StatusOverviewTone;
};

export type StatusOverviewProps = {
  title?: ReactNode;
  action?: ReactNode;
  segments: StatusOverviewSegment[];
  empty?: ReactNode;
  valueFormatter?: (value: number, percent: number) => ReactNode;
  className?: string;
};
