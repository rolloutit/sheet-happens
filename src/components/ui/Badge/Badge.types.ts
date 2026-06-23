import type { HTMLAttributes } from "react";
import type { VariantProps } from "class-variance-authority";

import type { badgeVariants } from "./Badge.variants";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants> & {
    dot?: boolean;
  };
