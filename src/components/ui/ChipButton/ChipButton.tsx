import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/src/lib/utils";
import type { ChipButtonProps } from "./ChipButton.types";
import { chipButtonVariants } from "./ChipButton.variants";

export const ChipButton = React.forwardRef<HTMLButtonElement, ChipButtonProps>(
  (
    { className, variant, selected, removable, removeLabel, onRemove, leading, children, ...props },
    ref,
  ) => {
    const button = (
      <button
        ref={ref}
        type="button"
        className={cn(
          chipButtonVariants({ variant, selected }),
          onRemove && "rounded-r-none border-r-0",
          !onRemove && className,
        )}
        aria-pressed={selected || undefined}
        {...props}
      >
        {leading}
        <span>{children}</span>
        {removable && !onRemove ? <X className="size-3" aria-hidden="true" /> : null}
      </button>
    );

    if (!onRemove) return button;

    return (
      <span className={cn("inline-flex items-center", className)}>
        {button}
        <button
          type="button"
          aria-label={removeLabel ?? "Remove chip"}
          disabled={props.disabled}
          onClick={onRemove}
          className={cn(
            "inline-flex h-8 items-center justify-center rounded-r-[var(--radius-pill)] border border-border bg-secondary px-2 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
            selected && "border-primary/60 bg-accent-soft text-accent",
          )}
        >
          <X className="size-3" aria-hidden="true" />
        </button>
      </span>
    );
  },
);
ChipButton.displayName = "ChipButton";
