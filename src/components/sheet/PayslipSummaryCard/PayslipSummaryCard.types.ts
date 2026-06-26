import type { ButtonProps } from "@/src/components/ui/Button";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { PayslipStatus } from "../PayslipStatus";

export type PayslipSummaryAction = {
  label: ReactNode;
  icon?: LucideIcon;
  variant?: ButtonProps["variant"];
  disabled?: boolean;
  onClick?: () => void;
};

export type PayslipSummaryCardProps = {
  title: ReactNode;
  status?: PayslipStatus;
  statusLabel?: ReactNode;
  meta?: ReactNode;
  primaryAction?: PayslipSummaryAction;
  secondaryAction?: PayslipSummaryAction;
  className?: string;
};
