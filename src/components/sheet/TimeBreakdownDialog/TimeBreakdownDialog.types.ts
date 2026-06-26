import type { ReactNode } from "react";

export type TimeBreakdownRowTone = "default" | "warning" | "success";

export type TimeBreakdownRow = {
  id: string;
  label: string;
  description?: string;
  hours: number;
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
  totalHours?: number;
  totalAmount?: string;
  labels?: TimeBreakdownDialogLabels;
  onOpenChange?: (open: boolean) => void;
  onExport?: () => void;
};
