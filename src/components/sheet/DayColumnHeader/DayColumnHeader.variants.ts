import { cva } from "class-variance-authority";

/**
 * The header's chassis per density. `today` is a 2px mint top rule and a slightly lighter surface,
 * nothing else — the one column you are in should be findable, not loud. `future` fades the whole
 * header to 70%, which the cards below match, so a day nothing has happened in yet reads as
 * provisional rather than empty.
 */
export const dayColumnHeaderVariants = cva(
  "group/day-header relative isolate w-full text-left outline-none transition-colors duration-[var(--duration-micro)] disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        column:
          "flex flex-col gap-1.5 rounded-t-[var(--radius-lg)] border-b border-border bg-card/95 px-3 pb-2 pt-2.5 backdrop-blur hover:bg-secondary",
        chip: "flex min-w-[4.25rem] snap-center flex-col items-center gap-1 rounded-[var(--radius-md)] border border-border bg-card px-2.5 py-2 text-center hover:border-accent/45 hover:bg-accent-soft",
        row: "flex items-center gap-3 rounded-t-[var(--radius-lg)] border-b border-border bg-card/95 px-3 py-2.5 hover:bg-secondary",
      },
      state: {
        normal: "",
        today: "",
        future: "opacity-70",
      },
      pressed: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      {
        variant: "column",
        state: "today",
        className: "bg-card shadow-[inset_0_2px_0_0_var(--accent)]",
      },
      { variant: "row", state: "today", className: "shadow-[inset_3px_0_0_0_var(--accent)]" },
      { variant: "chip", state: "today", className: "border-accent-line" },
      {
        variant: "chip",
        pressed: true,
        className: "border-accent text-accent hover:bg-transparent",
      },
    ],
    defaultVariants: {
      variant: "column",
      state: "normal",
      pressed: false,
    },
  },
);
