import type { ReactNode } from "react";

import type { DurationDisplayFormat } from "@/src/lib/formatting";

export type TimeBreakdownRowTone = "default" | "warning" | "success";

export type TimeBreakdownRow = {
  id: string;
  label: string;
  description?: string;
  durationMinutes: number;
  amount?: string;
  tone?: TimeBreakdownRowTone;
};

export type TimeBreakdownDialogLabels = {
  trigger?: string;
  title?: string;
  description?: string;
  hours?: string;
  amount?: string;
  close?: string;
  export?: string;
};

export type TimeBreakdownDialogProps = {
  rows: TimeBreakdownRow[];
  trigger?: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  totalMinutes?: number;
  totalAmount?: string;
  /** Defaults to `"en"`. */
  locale?: string;
  /** Defaults to `"DECIMAL_HOURS"`. */
  durationDisplayFormat?: DurationDisplayFormat;
  labels?: TimeBreakdownDialogLabels;
  onOpenChange?: (open: boolean) => void;
  onExport?: () => void;
};
