import * as React from "react";

import { cn } from "@/src/lib/utils";
import type { TextareaProps } from "./Textarea.types";

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || props["aria-invalid"]}
        className={cn(
          "min-h-24 w-full rounded-[var(--radius-md)] border border-input bg-background/50 px-3 py-2 text-sm text-foreground shadow-sm transition placeholder:text-subtle-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/30",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
