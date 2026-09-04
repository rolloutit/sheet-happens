import { cva } from "class-variance-authority";

/**
 * A project's row in a band.
 *
 * `empty` is a project that is still live this month with nothing logged against it — the case the
 * level exists to surface, since "I forgot Atlas in September" is invisible at every finer
 * resolution. It reads quieter rather than louder: it is a prompt, not a problem, and a month of
 * red rows on the 2nd would train people to ignore it.
 */
export const monthOverviewRowVariants = cva(
  "flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition last:border-b-0 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
  {
    variants: {
      state: {
        logged: "",
        empty: "text-muted-foreground",
      },
    },
    defaultVariants: {
      state: "logged",
    },
  },
);
