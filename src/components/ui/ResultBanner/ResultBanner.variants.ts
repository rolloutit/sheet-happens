import { cva } from "class-variance-authority";

/**
 * The inline "your last action succeeded/failed" strip. Pulled out of `AdminProjectsTable` and
 * `AdminProjectGroupsPanel`, where the same `rounded-[var(--radius-md)] border px-3 py-2 text-sm`
 * markup was copy-pasted at four call sites.
 */
export const resultBannerVariants = cva("rounded-[var(--radius-md)] border px-3 py-2 text-sm", {
  variants: {
    tone: {
      success: "border-success/40 bg-success-soft text-success",
      error: "border-destructive/40 bg-destructive-soft text-destructive",
      warning: "border-warning/45 bg-warning-soft text-warning",
      info: "border-accent-line bg-accent-soft text-accent",
    },
  },
  defaultVariants: {
    tone: "info",
  },
});
