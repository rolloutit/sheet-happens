import { cva } from "class-variance-authority";

/**
 * The card's chassis. The 3px project rail on the left replaces the dot plus uppercase caption:
 * the project is the card's *context*, so it reads as a colour at the edge, and the description —
 * the *thing* — is the primary line.
 */
export const entryCardVariants = cva(
  "group/card relative grid rounded-[var(--radius-md)] border border-border border-l-[3px] bg-background transition-[box-shadow,border-color] duration-[var(--duration-micro)]",
  {
    variants: {
      density: {
        compact: "gap-0.5 py-2 pl-2.5 pr-2",
        comfortable: "gap-1 px-4 py-3 pl-[1.125rem]",
      },
      tone: {
        normal: "",
        warning: "border-warning/40 bg-warning-soft",
        locked: "border-dashed",
      },
    },
    defaultVariants: {
      density: "compact",
      tone: "normal",
    },
  },
);
