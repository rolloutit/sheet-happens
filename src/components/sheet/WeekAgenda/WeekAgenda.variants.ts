import { cva } from "class-variance-authority";

/**
 * The day column, which carries the whole state of a day: whether it is today, whether it is the
 * day the rest of the page is pointing at, and whether it is a day nothing can be logged against
 * yet. `selected` deliberately outranks `today` — a member who has moved to another day wants to
 * see where they are, not where the calendar is.
 */
export const weekAgendaColumnVariants = cva(
  "flex flex-col rounded-[var(--radius-lg)] border bg-card transition-colors",
  {
    variants: {
      state: {
        normal: "border-border",
        today: "border-accent-line",
        future: "border-border opacity-70",
      },
      selected: {
        true: "border-accent shadow-soft",
        false: "",
      },
    },
    defaultVariants: {
      state: "normal",
      selected: false,
    },
  },
);

export const weekAgendaHeaderVariants = cva(
  "flex w-full items-baseline justify-between gap-2 rounded-t-[var(--radius-lg)] border-b border-border bg-card/95 px-3 py-2 text-left backdrop-blur transition hover:bg-secondary",
  {
    variants: {
      state: {
        normal: "",
        today: "text-accent",
        future: "",
      },
    },
    defaultVariants: {
      state: "normal",
    },
  },
);
