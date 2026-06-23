import { cva } from "class-variance-authority";

export const chipButtonVariants = cva(
  "inline-flex h-8 items-center justify-center gap-2 rounded-[var(--radius-pill)] border px-3 font-ui text-xs font-semibold transition duration-200 ease-[var(--ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        soft: "border-border bg-secondary text-secondary-foreground hover:bg-muted",
        dashed: "border-dashed border-primary/45 bg-primary/8 text-accent hover:bg-primary/14",
        filter: "border-border bg-card text-muted-foreground hover:text-foreground",
        warning: "border-warning/35 bg-warning/12 text-warning hover:bg-warning/18",
      },
      selected: {
        true: "border-primary/60 bg-primary/18 text-accent",
        false: "",
      },
    },
    defaultVariants: {
      variant: "soft",
      selected: false,
    },
  },
);
