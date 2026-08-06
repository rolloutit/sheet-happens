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

// Soft fill, the full-strength tone as text, and a 24%-alpha border of the same hue
// (docs/dark-mode-redesign.md §6) — the border is what keeps the four tones apart when the
// tints sit side by side on a card.
export const statusPillVariants = cva(
  "inline-flex items-center gap-2 rounded-[var(--radius-pill)] border px-2.5 py-1 font-ui text-xs font-semibold",
  {
    variants: {
      tone: {
        muted: "border-border bg-secondary text-muted-foreground",
        info: "border-accent/24 bg-accent-soft text-accent",
        success: "border-success/24 bg-success-soft text-success",
        warning: "border-warning/24 bg-warning-soft text-warning",
        danger: "border-destructive/24 bg-destructive-soft text-destructive",
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
