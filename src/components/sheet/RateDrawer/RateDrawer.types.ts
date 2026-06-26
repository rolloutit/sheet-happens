import type { ReactNode } from "react";

export type RateDrawerData = {
  id: string;
  label: string;
  scope: string;
  amount: number;
  currency: string;
  unit?: string;
  effectiveFrom?: string;
  status?: "current" | "override" | "missing" | "scheduled";
};

export type RateDrawerProps = {
  rate: RateDrawerData;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSave?: (rate: RateDrawerData) => void;
  saveLabel?: ReactNode;
  cancelLabel?: ReactNode;
};
