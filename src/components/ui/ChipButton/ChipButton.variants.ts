import { cva } from "class-variance-authority";

export const chipButtonVariants = cva(
  "inline-flex h-8 items-center justify-center gap-2 rounded-[var(--radius-pill)] border px-3 font-ui text-xs font-semibold transition duration-200 ease-[var(--ease-standard)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        soft: "border-border bg-secondary text-secondary-foreground hover:bg-muted",
        dashed: "border-dashed border-accent-line bg-accent-soft text-accent hover:bg-accent/25",
        filter: "border-border bg-card text-muted-foreground hover:text-foreground",
        warning: "border-warning/35 bg-warning-soft text-warning hover:bg-warning/25",
      },
      selected: {
        // `.fchip` / `.ex-check.on`: accent-line edge over the soft fill.
        true: "border-accent-line bg-accent-soft text-accent",
        false: "",
      },
    },
    defaultVariants: {
      variant: "soft",
      selected: false,
    },
  },
);
