import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type ReportStatTone = "neutral" | "info" | "success" | "warning" | "danger";

export type ReportStatTileProps = {
  label: ReactNode;
  value: ReactNode;
  helperText?: ReactNode;
  tone?: ReportStatTone;
  icon?: LucideIcon;
  className?: string;
};
