import * as React from "react";

import { cn } from "@/src/lib/utils";
import type { InputProps } from "./Input.types";

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || props["aria-invalid"]}
        className={cn(
          "flex h-10 w-full rounded-[var(--radius-md)] border border-input bg-background/50 px-3 py-2 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/30",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
