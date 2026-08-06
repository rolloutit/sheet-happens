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

// The prototype's pills are a soft fill plus the full-strength tone as text, with no ring
// (`.ts-pill`, `.mg-badge`, `.diff-badge`). Only the neutral tone keeps a border, because its
// fill is `--surface-2` and would otherwise have no edge at all.
export const statusPillVariants = cva(
  "inline-flex items-center gap-2 rounded-[var(--radius-pill)] px-2.5 py-1 font-ui text-xs font-semibold",
  {
    variants: {
      tone: {
        muted: "border border-border bg-secondary text-muted-foreground",
        info: "bg-accent-soft text-accent",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-destructive-soft text-destructive",
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
