import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import type { VariantProps } from "class-variance-authority";

import type { iconButtonVariants } from "./IconButton.variants";

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof iconButtonVariants> & {
    icon: LucideIcon;
    label: string;
    active?: boolean;
    dot?: boolean;
  };
