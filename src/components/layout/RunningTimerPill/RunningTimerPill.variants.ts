import { cva } from "class-variance-authority";

/**
 * `responsive` exists so the header can hold **one** pill rather than a mobile copy and a desktop
 * copy behind `hidden`/`md:flex`. Two copies would be two live regions and two stop buttons in the
 * accessibility tree for one timer; a breakpoint inside the variant keeps it to one node.
 */
export const runningTimerPillVariants = cva(
  "inline-flex items-center rounded-[var(--radius-pill)] border border-accent-line bg-accent-soft text-sm text-foreground shadow-soft transition hover:bg-accent/25",
  {
    variants: {
      density: {
        // Room for the project name, so the pill says which timer is running, not just that one is.
        comfortable: "max-w-[15rem] gap-2 px-3 py-1.5",
        // The mobile header already carries notifications and the account menu; at that width the
        // elapsed time is the only part worth the space.
        compact: "gap-1.5 px-2.5 py-1.5",
        responsive: "gap-1.5 px-2.5 py-1.5 md:max-w-[15rem] md:gap-2 md:px-3",
      },
    },
    defaultVariants: {
      density: "responsive",
    },
  },
);

/** Matches the pill's own breakpoint: the project name is the part that gives way first. */
export const runningTimerProjectVisibility = {
  comfortable: "",
  compact: "hidden",
  responsive: "hidden md:inline-flex",
} as const;
