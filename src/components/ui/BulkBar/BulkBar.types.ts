import type { ReactNode } from "react";

export type BulkBarLabels = {
  region?: string;
  selected?: (count: number) => ReactNode;
};

export type BulkBarProps = {
  selectedCount: number;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  summary?: ReactNode;
  labels?: BulkBarLabels;
  className?: string;
};
