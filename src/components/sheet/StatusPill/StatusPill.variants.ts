import { cva } from "class-variance-authority";

import type { StatusPillTone, TimesheetStatus } from "./StatusPill.types";

// One hue per status, no repeats. The nine states used to share five tones, which put `submitted`
// and `invoiced` on the same mint, both rejections on the same rose, and `approved`/`accepted`/
// `paid` on one green — three quarters of the lifecycle unreadable at a glance. The four extra
// families live in `app/globals.css`; the reasoning for their hues, lightness stagger and soft
// alphas is there. What belongs here is which state gets which:
//
//   muted     neutral   no timesheet exists yet
//   warning   amber     the month is open and nothing has arrived — the one state that is a chase
//   info      mint      submitted, sitting in the review queue (the brand hue = "in the system")
//   danger    rose      the hours were rejected
//   success   green     the hours were approved
//   pending   yellow    invoice uploaded, waiting on verification
//   blocked   magenta   the invoice was rejected — an alarm, but not the same alarm as `rejected`
//   verified  blue      the invoice was accepted, payment outstanding
//   settled   violet    paid; the row is closed
//
// The three assignments that were already unambiguous (mint/rose/green for submitted/rejected/
// approved) are deliberately untouched — only the states that collided moved.
export const statusTone: Record<TimesheetStatus, StatusPillTone> = {
  not_created: "muted",
  submitted: "info",
  rejected: "danger",
  approved: "success",
  invoiced: "pending",
  invoice_rejected: "blocked",
  accepted: "verified",
  paid: "settled",
  missing: "warning",
};

// The colour is never the only carrier: every pill prints its status name, because eight chromatic
// families cannot stay separable under deuteranopia or protanopia.
export const statusToneVar: Record<StatusPillTone, string> = {
  muted: "var(--muted-foreground)",
  info: "var(--accent)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--destructive)",
  pending: "var(--pending)",
  verified: "var(--verified)",
  settled: "var(--settled)",
  blocked: "var(--blocked)",
};

// Soft fill, the full-strength tone as text, and a border of the same hue
// (docs/dark-mode-redesign.md §6) — the border is what keeps the tones apart when the
// tints sit side by side on a card.
//
// The border runs at 45% rather than 24%. At 24% over the old near-black card it composited to
// within a couple of points of the fill and did none of the separating work it was added for;
// the pills read as dim washes with no edge. Danger takes the lighter rose step for its label:
// `--destructive` is the darkest of the four original signals and no longer clears 4.5:1 on its
// own tint. The four added families each label their own tint, so they need no second step.
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
        pending: "border-pending/45 bg-pending-soft text-pending",
        verified: "border-verified/45 bg-verified-soft text-verified",
        settled: "border-settled/45 bg-settled-soft text-settled",
        blocked: "border-blocked/45 bg-blocked-soft text-blocked",
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
