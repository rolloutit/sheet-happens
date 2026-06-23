import * as React from "react";

import { cn } from "@/src/lib/utils";
import type { IconButtonProps } from "./IconButton.types";
import { iconButtonVariants } from "./IconButton.variants";

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, label, active, dot, variant, size, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active || undefined}
      className={cn(iconButtonVariants({ variant, size, active }), className)}
      {...props}
    >
      <Icon className="size-4" aria-hidden="true" />
      {dot ? (
        <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-cta ring-2 ring-background" />
      ) : null}
    </button>
  ),
);
IconButton.displayName = "IconButton";
