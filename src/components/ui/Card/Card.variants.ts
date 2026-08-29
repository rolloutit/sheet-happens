import { cva } from "class-variance-authority";

// Surfaces are opaque. The prototype's cards are a flat `--surface`, and the page's canvas gradient
// sits behind them rather than showing through — a translucent card samples whatever it happens to
// be over and so never lands on the intended `#11221F` / `#FFFFFF`.
export const cardVariants = cva(
  "rounded-[var(--radius-lg)] border transition duration-200 ease-[var(--ease-standard)]",
  {
    variants: {
      variant: {
        flat: "border-border bg-card",
        elevated: "border-border bg-card shadow-soft",
        // `.ts-featured`: a 9% accent wash pulled from the top-right corner, on the xl radius.
        featured:
          "rounded-[var(--radius-xl)] border-border bg-[radial-gradient(120%_140%_at_100%_0%,color-mix(in_srgb,var(--accent)_9%,transparent),transparent_55%),var(--card)] shadow-panel",
        // `.mg-segbtn.on`: full-strength accent edge over the soft fill.
        selected: "border-accent bg-accent-soft shadow-soft",
        warning: "border-warning/45 bg-warning-soft text-foreground shadow-soft",
        // A danger card used to borrow `warning`, so a rose stat card was painted with an amber
        // wash and then filled with rose content — an amber ground under rose marks is most of
        // why the dashboard's "Rejected rows" tile read as mud. Danger now has its own tone.
        danger: "border-destructive/45 bg-destructive-soft text-foreground shadow-soft",
      },
      density: {
        sm: "p-3",
        md: "p-5",
        lg: "p-6",
      },
      // `.lift:hover` — a 2px rise, a stronger edge, and the one elevation.
      clickable: {
        true: "cursor-pointer hover:-translate-y-0.5 hover:border-border-strong hover:shadow-panel",
        false: "",
      },
    },
    defaultVariants: {
      variant: "flat",
      density: "md",
      clickable: false,
    },
  },
);
