import { cva } from "class-variance-authority";

export const iconButtonVariants = cva(
  "relative inline-flex items-center justify-center rounded-[var(--radius-pill)] border font-ui transition duration-200 ease-[var(--ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        soft: "border-border bg-secondary text-foreground hover:bg-muted",
        ghost:
          "border-transparent bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground",
        primary: "border-primary/30 bg-primary text-primary-foreground hover:bg-primary/90",
        danger:
          "border-destructive/35 bg-destructive/12 text-destructive hover:bg-destructive hover:text-destructive-foreground",
      },
      size: {
        sm: "size-8",
        md: "size-10",
        lg: "size-12",
      },
      active: {
        true: "border-primary/55 bg-primary/16 text-accent",
        false: "",
      },
    },
    defaultVariants: {
      variant: "soft",
      size: "md",
      active: false,
    },
  },
);
