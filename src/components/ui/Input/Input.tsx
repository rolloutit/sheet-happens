import * as React from "react";

import { cn } from "@/src/lib/utils";
import { focusChromeClassName } from "../focusRing";
import type { InputProps } from "./Input.types";

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || props["aria-invalid"]}
        className={cn(
          "flex h-10 w-full rounded-[var(--radius-md)] border border-input bg-surface-inset px-3 py-2 text-sm text-foreground shadow-sm transition placeholder:text-subtle-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive",
          focusChromeClassName,
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
