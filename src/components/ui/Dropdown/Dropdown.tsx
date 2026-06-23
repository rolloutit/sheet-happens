"use client";

import { DropdownMenu as DropdownPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/src/lib/utils";
import type {
  DropdownContentProps,
  DropdownItemProps,
  DropdownLabelProps,
  DropdownSeparatorProps,
} from "./Dropdown.types";

export const Dropdown = DropdownPrimitive.Root;
export const DropdownTrigger = DropdownPrimitive.Trigger;

export const DropdownContent = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Content>,
  DropdownContentProps
>(({ className, sideOffset = 8, ...props }, ref) => (
  <DropdownPrimitive.Portal>
    <DropdownPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-48 rounded-[var(--radius-lg)] border border-border bg-popover p-1 text-popover-foreground shadow-panel outline-none",
        className,
      )}
      {...props}
    />
  </DropdownPrimitive.Portal>
));
DropdownContent.displayName = "DropdownContent";

export const DropdownItem = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Item>,
  DropdownItemProps
>(({ className, ...props }, ref) => (
  <DropdownPrimitive.Item
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm outline-none transition focus:bg-secondary data-[disabled]:pointer-events-none data-[disabled]:opacity-45",
      className,
    )}
    {...props}
  />
));
DropdownItem.displayName = "DropdownItem";

export const DropdownLabel = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Label>,
  DropdownLabelProps
>(({ className, ...props }, ref) => (
  <DropdownPrimitive.Label
    ref={ref}
    className={cn(
      "px-3 py-2 font-ui text-xs font-semibold uppercase text-muted-foreground",
      className,
    )}
    {...props}
  />
));
DropdownLabel.displayName = "DropdownLabel";

export const DropdownSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Separator>,
  DropdownSeparatorProps
>(({ className, ...props }, ref) => (
  <DropdownPrimitive.Separator
    ref={ref}
    className={cn("my-1 h-px bg-border", className)}
    {...props}
  />
));
DropdownSeparator.displayName = "DropdownSeparator";
