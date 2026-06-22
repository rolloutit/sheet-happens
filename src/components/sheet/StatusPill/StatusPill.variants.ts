import { cva } from "class-variance-authority";

import type { StatusPillTone, TimesheetStatus } from "./StatusPill.types";

export const statusTone: Record<TimesheetStatus, StatusPillTone> = {
  not_created: "muted",
  submitted: "info",
  rejected: "danger",
  approved: "success",
  invoiced: "info",
  invoice_rejected: "danger",
  accepted: "success",
  paid: "success",
  missing: "warning",
};

export const statusPillVariants = cva(
  "inline-flex items-center gap-2 rounded-[var(--radius-pill)] border px-2.5 py-1 font-ui text-xs font-semibold",
  {
    variants: {
      tone: {
        muted: "border-border bg-secondary text-muted-foreground",
        info: "border-accent/35 bg-accent/10 text-accent",
        success: "border-success/35 bg-success/10 text-success",
        warning: "border-warning/35 bg-warning/10 text-warning",
        danger: "border-destructive/35 bg-destructive/10 text-destructive",
      },
      density: {
        compact: "px-2 py-0.5 text-[11px]",
        comfortable: "px-2.5 py-1 text-xs",
      },
    },
    defaultVariants: {
      tone: "muted",
      density: "comfortable",
    },
  },
);
