import { cva } from "class-variance-authority";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border px-2.5 py-1 font-ui text-xs font-semibold",
  {
    variants: {
      tone: {
        neutral: "border-border bg-secondary text-muted-foreground",
        info: "border-primary/30 bg-primary/12 text-accent",
        success: "border-success/30 bg-success/12 text-success",
        warning: "border-warning/35 bg-warning/12 text-warning",
        danger: "border-destructive/35 bg-destructive/12 text-destructive",
        cta: "border-cta/35 bg-cta/14 text-cta",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);
