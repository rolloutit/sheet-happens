import type { ReactNode } from "react";
import type { TimesheetStatus } from "../StatusPill";

export type TimesheetStepState = "done" | "current" | "todo" | "locked" | "rejected";

export type TimesheetWorkflowStepId = "created" | "submitted" | "approved" | "invoiced" | "paid";

export type TimesheetStepperStep = {
  id: string;
  label: ReactNode;
  state: TimesheetStepState;
  description?: ReactNode;
};

export type TimesheetStepperProps = {
  status?: TimesheetStatus;
  steps?: TimesheetStepperStep[];
  labels?: Partial<Record<TimesheetWorkflowStepId, ReactNode>>;
  lockedDescriptions?: Partial<Record<TimesheetWorkflowStepId, ReactNode>>;
  "aria-label"?: string;
  className?: string;
};
