import type { SelectOption } from "@/src/components/ui/Select";
import type { ReactNode } from "react";

export type ReportView = "user" | "project";

export type ReportFilterBarProps = {
  periodValue?: string;
  projectValue?: string;
  view?: ReportView;
  periodOptions: SelectOption[];
  projectOptions: SelectOption[];
  onPeriodChange?: (value: string) => void;
  onProjectChange?: (value: string) => void;
  onViewChange?: (value: ReportView) => void;
  onExport?: () => void;
  exportLabel?: ReactNode;
  className?: string;
};
