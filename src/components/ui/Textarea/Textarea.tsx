import * as React from "react";

import { cn } from "@/src/lib/utils";
import { focusChromeClassName } from "../focusRing";
import type { TextareaProps } from "./Textarea.types";

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || props["aria-invalid"]}
        className={cn(
          "min-h-24 w-full rounded-[var(--radius-md)] border border-input bg-surface-inset px-3 py-2 text-sm text-foreground shadow-sm transition placeholder:text-subtle-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive",
          focusChromeClassName,
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
