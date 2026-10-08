import { cva } from "class-variance-authority";

import { leaveKindToneClasses } from "../LeaveKindBadge/LeaveKindBadge.variants";

/**
 * A ribbon is the run of one leave across one week row. Where it continues into the previous or
 * next week its end is cut square, so a leave crossing a weekend still reads as one stroke split by
 * the row break rather than two separate leaves.
 */
export const leaveRibbonVariants = cva(
  "relative z-10 flex h-6 min-w-0 items-center gap-1 border px-2 text-left font-ui text-[0.72rem] leading-none transition-[filter,box-shadow] duration-150 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      kind: leaveKindToneClasses,
      own: {
        true: "font-semibold",
        false: "font-medium",
      },
      start: {
        cut: "rounded-l-none border-l-0",
        round: "rounded-l-full",
      },
      end: {
        cut: "rounded-r-none border-r-0",
        round: "rounded-r-full",
      },
      dayPart: {
        FULL: "mx-1",
        MORNING: "ml-1 w-[calc(50%-0.25rem)] justify-self-start",
        AFTERNOON: "mr-1 w-[calc(50%-0.25rem)] justify-self-end",
      },
    },
    compoundVariants: [
      { start: "cut", dayPart: "FULL", className: "ml-0" },
      { end: "cut", dayPart: "FULL", className: "mr-0" },
    ],
    defaultVariants: {
      own: false,
      start: "round",
      end: "round",
      dayPart: "FULL",
    },
  },
);

/** The background of one day in a week row; the ribbons float above it. */
export const leaveDayVariants = cva("border-border", {
  variants: {
    tone: {
      workday: "bg-card",
      weekend: "bg-surface-inset",
      holiday: "bg-[color-mix(in_srgb,var(--destructive-soft)_55%,var(--card))]",
    },
    inMonth: {
      true: "",
      false: "opacity-55",
    },
  },
  defaultVariants: {
    tone: "workday",
    inMonth: true,
  },
});
