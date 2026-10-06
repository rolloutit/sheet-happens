import { cva } from "class-variance-authority";

/**
 * The day column. `today` is a 2px mint top rule, carried by the header's own inset shadow so the
 * column border stays one colour; `future` fades the whole column to 70% so a day nothing has
 * happened in yet reads as provisional. Nothing marks the selected day here: in the Week scope a
 * header is the way *into* a day, and marking one column would say something the page no longer
 * asks (§4.1 of `docs/time-view-redesign.md`).
 */
export const weekAgendaColumnVariants = cva(
  "flex min-w-0 flex-col rounded-[var(--radius-lg)] border bg-card transition-colors duration-[var(--duration-micro)]",
  {
    variants: {
      state: {
        normal: "border-border",
        today: "border-accent-line",
        future: "border-border",
      },
      locked: {
        true: "border-dashed",
        false: "",
      },
    },
    defaultVariants: {
      state: "normal",
      locked: false,
    },
  },
);
