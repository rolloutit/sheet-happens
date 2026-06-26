import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { VariantProps } from "class-variance-authority";

import type { chipButtonVariants } from "./ChipButton.variants";

export type ChipButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof chipButtonVariants> & {
    selected?: boolean;
    removable?: boolean;
    removeLabel?: string;
    onRemove?: () => void;
    leading?: ReactNode;
  };
