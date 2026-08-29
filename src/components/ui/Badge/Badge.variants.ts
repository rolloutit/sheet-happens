import { cva } from "class-variance-authority";

// Matches the prototype's `.mg-badge` / `.diff-badge`: soft fill, tone-coloured text, no ring.
// Neutral keeps its border since `--surface-2` alone gives it no edge.
export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 font-ui text-xs font-semibold",
  {
    variants: {
      tone: {
        neutral: "border border-border bg-secondary text-muted-foreground",
        info: "bg-accent-soft text-accent",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-destructive-soft text-destructive-bright",
        cta: "bg-cta/16 text-cta",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);
