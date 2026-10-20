import { cva } from "class-variance-authority";

/**
 * The three leave kinds share one colour language across the calendar ribbons, the badges and the
 * legend: mint for vacation, lavender for sick leave, a hatched neutral for a colleague's absence
 * whose reason is withheld. Rose is kept for public holidays alone. Each tint carries a same-hue
 * border, which the light theme needs to keep the pill's edge (see docs/tokens.md).
 */
export const leaveKindToneClasses = {
  vacation: "border-accent-line bg-accent-soft text-accent",
  sick: "border-settled/45 bg-settled-soft text-settled",
  absent:
    "border-border-strong text-muted-foreground bg-[repeating-linear-gradient(135deg,var(--muted)_0_5px,var(--secondary)_5px_10px)]",
} as const;

export const leaveKindBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border font-ui font-semibold whitespace-nowrap [&_svg]:shrink-0",
  {
    variants: {
      kind: leaveKindToneClasses,
      size: {
        sm: "px-2 py-0.5 text-xs [&_svg]:size-3",
        md: "px-2.5 py-1 text-xs [&_svg]:size-3.5",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);
