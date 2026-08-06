import { cva } from "class-variance-authority";

export const emptyStateVariants = cva(
  "rounded-[var(--radius-xl)] border p-6 text-center shadow-soft sm:p-8",
  {
    variants: {
      tone: {
        default: "border-border bg-card/70",
        warm: "border-cta/30 bg-cta/10",
        good: "border-success/30 bg-success-soft",
      },
    },
    defaultVariants: {
      tone: "default",
    },
  },
);
