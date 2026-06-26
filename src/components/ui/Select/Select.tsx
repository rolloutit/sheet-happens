"use client";

import { Check, ChevronDown } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/src/lib/utils";
import type { SelectProps } from "./Select.types";

export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      id,
      label,
      placeholder,
      options,
      className,
      triggerClassName,
      contentClassName,
      invalid,
      disabled,
      "aria-label": ariaLabel,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref,
  ) => (
    <SelectPrimitive.Root disabled={disabled} {...props}>
      <SelectPrimitive.Trigger
        id={id}
        ref={ref}
        aria-label={ariaLabel ?? label}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || undefined}
        className={cn(
          "inline-flex h-10 w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border border-input bg-card px-3 font-ui text-sm text-foreground shadow-inner outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-55 data-[placeholder]:text-muted-foreground aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/30",
          className,
          triggerClassName,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={8}
          className={cn(
            "z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[var(--radius-lg)] border border-border bg-popover p-1 text-popover-foreground shadow-panel",
            contentClassName,
          )}
        >
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="relative flex cursor-default select-none items-center rounded-[var(--radius-md)] py-2 pl-9 pr-3 text-sm outline-none transition focus:bg-secondary data-[disabled]:pointer-events-none data-[disabled]:opacity-45"
              >
                <SelectPrimitive.ItemIndicator className="absolute left-3 inline-flex items-center">
                  <Check className="size-4" aria-hidden="true" />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  ),
);
Select.displayName = "Select";
