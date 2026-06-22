import type { VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { emptyStateVariants } from "./EmptyState.variants";

export type EmptyStateProps = VariantProps<typeof emptyStateVariants> & {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
  className?: string;
};
