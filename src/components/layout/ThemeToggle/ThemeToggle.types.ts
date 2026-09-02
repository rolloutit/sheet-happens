import type { VariantProps } from "class-variance-authority";

import type { iconButtonVariants } from "@/src/components/ui/IconButton";

export type ThemeToggleProps = Pick<VariantProps<typeof iconButtonVariants>, "size" | "variant"> & {
  className?: string;
  /** Dropdown alignment against the trigger. */
  align?: "start" | "center" | "end";
};
