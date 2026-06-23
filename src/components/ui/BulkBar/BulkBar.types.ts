import type { ReactNode } from "react";

export type BulkBarProps = {
  selectedCount: number;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  summary?: ReactNode;
  className?: string;
};
