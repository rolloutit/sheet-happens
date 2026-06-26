import type { ReactNode } from "react";

export type ReviewActionBarLabels = {
  region?: string;
  selected?: (count: number) => ReactNode;
  clear?: ReactNode;
  approve?: ReactNode;
};

export type ReviewActionBarProps = {
  selectedCount: number;
  summary?: ReactNode;
  rejectAction?: ReactNode;
  onClear?: () => void;
  onApprove?: () => void;
  labels?: ReviewActionBarLabels;
  className?: string;
};
