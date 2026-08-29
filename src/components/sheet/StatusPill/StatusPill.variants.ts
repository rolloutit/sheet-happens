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

// Soft fill, the full-strength tone as text, and a border of the same hue
// (docs/dark-mode-redesign.md §6) — the border is what keeps the four tones apart when the
// tints sit side by side on a card.
//
// The border runs at 45% rather than 24%. At 24% over the old near-black card it composited to
// within a couple of points of the fill and did none of the separating work it was added for;
// the pills read as dim washes with no edge. Danger takes the lighter rose step for its label:
// `--destructive` is the darkest of the four signals and no longer clears 4.5:1 on its own tint.
export const statusPillVariants = cva(
  "inline-flex items-center gap-2 rounded-[var(--radius-pill)] border px-2.5 py-1 font-ui text-xs font-semibold",
  {
    variants: {
      tone: {
        muted: "border-border-strong bg-secondary text-muted-foreground",
        info: "border-accent/45 bg-accent-soft text-accent",
        success: "border-success/45 bg-success-soft text-success",
        warning: "border-warning/45 bg-warning-soft text-warning",
        danger: "border-destructive/45 bg-destructive-soft text-destructive-bright",
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
