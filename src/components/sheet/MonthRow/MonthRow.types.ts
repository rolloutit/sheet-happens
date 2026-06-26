import type { ReactNode } from "react";
import type { TimesheetStatus } from "../StatusPill";

export type MonthRowProps = {
  month: ReactNode;
  meta?: ReactNode;
  status: TimesheetStatus;
  actionLabel?: string;
  onClick?: () => void;
  className?: string;
};
