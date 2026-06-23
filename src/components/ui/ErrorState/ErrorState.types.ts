import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type ErrorStateProps = {
  title: string;
  message: string;
  code?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  tone?: "error" | "warning";
  className?: string;
};
