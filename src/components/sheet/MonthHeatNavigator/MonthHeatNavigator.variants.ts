import { cva } from "class-variance-authority";

/**
 * A day cell. Intensity is four steps of the primary mixed into the card surface — the point is
 * to see a 2h day next to an 8h day, not a binary logged-or-not — and the three non-logged states
 * each have a shape as well as a colour: hollow for a past workday with nothing logged, dotted for
 * the future, a ring for today.
 */
export const heatCellVariants = cva(
  "relative grid size-7 place-items-center rounded-[var(--radius-xs)] border font-ui text-[10px] font-semibold tabular-nums transition-[background-color,border-color,transform] duration-[var(--duration-micro)] disabled:cursor-default disabled:opacity-40",
  {
    variants: {
      step: {
        0: "border-border bg-transparent text-muted-foreground hover:border-border-strong",
        1: "border-transparent bg-[color-mix(in_srgb,var(--primary)_28%,var(--card))] text-foreground hover:brightness-110",
        2: "border-transparent bg-[color-mix(in_srgb,var(--primary)_50%,var(--card))] text-foreground hover:brightness-110",
        3: "border-transparent bg-[color-mix(in_srgb,var(--primary)_72%,var(--card))] text-primary-foreground hover:brightness-110",
        4: "border-transparent bg-primary text-primary-foreground hover:brightness-110",
      },
      state: {
        past: "",
        today: "ring-2 ring-accent ring-offset-1 ring-offset-card",
        future: "border-dashed text-subtle-foreground",
      },
      workday: {
        true: "",
        false: "",
      },
      selected: {
        true: "outline outline-2 outline-offset-1 outline-accent",
        false: "",
      },
      outside: {
        true: "invisible",
        false: "",
      },
    },
    compoundVariants: [
      // A past weekend with nothing logged is not a forgotten day: no hollow frame, just a dot.
      {
        step: 0,
        state: "past",
        workday: false,
        className: "border-transparent text-subtle-foreground",
      },
    ],
    defaultVariants: {
      step: 0,
      state: "past",
      workday: true,
      selected: false,
      outside: false,
    },
  },
);
