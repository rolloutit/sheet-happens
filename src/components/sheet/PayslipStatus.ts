import type { BadgeProps } from "@/src/components/ui/Badge";

export type PayslipStatus = "available" | "missing" | "processing" | "failed";

export const payslipStatusLabels: Record<PayslipStatus, string> = {
  available: "Available",
  missing: "Missing",
  processing: "Processing",
  failed: "Failed",
};

export const payslipStatusTone: Record<PayslipStatus, BadgeProps["tone"]> = {
  available: "success",
  missing: "warning",
  processing: "info",
  failed: "danger",
};
