import type { ButtonProps } from "@/src/components/ui/Button";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { TimesheetStatus } from "../StatusPill";

export type TimesheetSummaryAction = {
  label: ReactNode;
  icon?: LucideIcon;
  variant?: ButtonProps["variant"];
  onClick?: () => void;
  disabled?: boolean;
};

export type TimesheetSummaryCardProps = {
  title: ReactNode;
  status: TimesheetStatus;
  meta?: ReactNode;
  action?: TimesheetSummaryAction;
  className?: string;
};
