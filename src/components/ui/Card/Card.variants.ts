import { cva } from "class-variance-authority";

export const cardVariants = cva(
  "rounded-[var(--radius-lg)] border transition duration-200 ease-[var(--ease-standard)]",
  {
    variants: {
      variant: {
        flat: "border-border bg-card/72",
        elevated: "border-border bg-card/88 shadow-soft",
        featured:
          "border-primary/30 bg-[radial-gradient(circle_at_top_right,rgb(55_227_222_/_0.20),transparent_18rem),color-mix(in_srgb,var(--card)_86%,transparent)] shadow-panel",
        warning: "border-warning/35 bg-warning/10 text-foreground",
        selected: "border-primary/55 bg-primary/12 shadow-soft",
      },
      density: {
        sm: "p-3",
        md: "p-5",
        lg: "p-6",
      },
      clickable: {
        true: "cursor-pointer hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-panel",
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
