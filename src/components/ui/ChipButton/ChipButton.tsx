import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/src/lib/utils";
import type { ChipButtonProps } from "./ChipButton.types";
import { chipButtonVariants } from "./ChipButton.variants";

export const ChipButton = React.forwardRef<HTMLButtonElement, ChipButtonProps>(
  ({ className, variant, selected, removable, leading, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(chipButtonVariants({ variant, selected }), className)}
      aria-pressed={selected || undefined}
      {...props}
    >
      {leading}
      <span>{children}</span>
      {removable ? <X className="size-3" aria-hidden="true" /> : null}
    </button>
  ),
);
ChipButton.displayName = "ChipButton";
