import { cva } from "class-variance-authority";

/**
 * A declared project's row in the month's declared band.
 *
 * Three states rather than a cluster of booleans. `empty` is a live declared assignment with
 * nothing declared yet — the row that exists to be filled in, and the whole reason the band is a
 * form and not a report. It reads quieter rather than louder, the same way an unlogged tracked
 * project does: on the 2nd of the month it is a prompt, not a problem.
 */
export const declaredHoursRowVariants = cva(
  "grid gap-4 border-b border-border px-4 py-4 last:border-b-0",
  {
    variants: {
      state: {
        declared: "",
        empty: "bg-secondary/25",
        locked: "opacity-90",
      },
    },
    defaultVariants: {
      state: "declared",
    },
  },
);

/** The proof slot, which is a real affordance only once there is a figure for it to prove. */
export const declaredProofSlotVariants = cva(
  "flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2.5 text-sm",
  {
    variants: {
      state: {
        uploaded: "border-success/35 bg-success-soft text-success",
        missing: "border-warning/30 bg-warning-soft text-warning",
        unavailable: "border-dashed border-border bg-transparent text-muted-foreground",
      },
    },
    defaultVariants: {
      state: "missing",
    },
  },
);
