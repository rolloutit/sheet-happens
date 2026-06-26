import type { ReactNode } from "react";
import type { TimesheetStatus } from "../StatusPill";

export type DiffBadgeState = "match" | "mismatch";

export type ReviewDiffItem = {
  id: string;
  label: ReactNode;
  delta: ReactNode;
  state: DiffBadgeState;
};

export type ReviewDiffTotal = {
  id: string;
  label: ReactNode;
  value: ReactNode;
  tone?: "neutral" | "warning" | "danger" | "success";
};

export type ReviewDiffListProps = {
  title?: ReactNode;
  description?: ReactNode;
  status?: TimesheetStatus;
  items: ReviewDiffItem[];
  totals?: ReviewDiffTotal[];
  footer?: ReactNode;
  className?: string;
};
