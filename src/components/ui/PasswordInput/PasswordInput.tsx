"use client";

import { Eye, EyeOff } from "lucide-react";
import * as React from "react";

import { cn } from "@/src/lib/utils";
import { focusChromeClassName } from "../focusRing";
import type { PasswordInputProps } from "./PasswordInput.types";

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    { className, invalid, visible, defaultVisible = false, labels, onVisibilityChange, ...props },
    ref,
  ) => {
    const [localVisible, setLocalVisible] = React.useState(defaultVisible);
    const resolvedVisible = visible ?? localVisible;
    const showLabel = labels?.show ?? "Show password";
    const hideLabel = labels?.hide ?? "Hide password";

    function updateVisibility(nextVisible: boolean) {
      if (visible === undefined) setLocalVisible(nextVisible);
      onVisibilityChange?.(nextVisible);
    }

    return (
      <div className="relative">
        <input
          ref={ref}
          type={resolvedVisible ? "text" : "password"}
          aria-invalid={invalid || props["aria-invalid"]}
          className={cn(
            "flex h-10 w-full rounded-[var(--radius-md)] border border-input bg-surface-inset px-3 py-2 pr-11 text-sm text-foreground shadow-sm transition placeholder:text-subtle-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive",
            focusChromeClassName,
            className,
          )}
          {...props}
        />
        <button
          type="button"
          aria-label={resolvedVisible ? hideLabel : showLabel}
          aria-pressed={resolvedVisible}
          disabled={props.disabled}
          onClick={() => updateVisibility(!resolvedVisible)}
          className="absolute right-1.5 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-[var(--radius-pill)] text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          {resolvedVisible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
