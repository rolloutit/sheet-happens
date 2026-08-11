"use client";

import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import * as React from "react";

import { cn } from "@/src/lib/utils";
import { commandFilter } from "./Command.filter";
import type {
  CommandEmptyProps,
  CommandGroupProps,
  CommandInputProps,
  CommandItemProps,
  CommandListProps,
  CommandProps,
  CommandSeparatorProps,
} from "./Command.types";

/**
 * The searchable list behind `Combobox` and the command palette.
 *
 * Three cmdk behaviours are worth knowing before composing this:
 *
 * 1. `CommandInput` hardcodes `role="combobox"` *after* its prop spread, so the role cannot
 *    be overridden. When this sits inside a trigger that is itself a combobox, pass `label`
 *    to `Command` — it renders an sr-only `<label>` that gives the input its own accessible
 *    name, which is the only way to tell the two apart in a test or a screen reader.
 * 2. `data-selected` on an item means "active descendant", not "chosen". Rendering the
 *    chosen state is the caller's job.
 * 3. `CommandItem`'s `onSelect` receives cmdk's own lowercased copy of the value. Close over
 *    the real value instead of reading the argument.
 */
export const Command = React.forwardRef<React.ElementRef<typeof CommandPrimitive>, CommandProps>(
  ({ className, filter = commandFilter, loop = true, ...props }, ref) => (
    <CommandPrimitive
      ref={ref}
      filter={filter}
      loop={loop}
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-[var(--radius-lg)] bg-popover font-ui text-popover-foreground",
        className,
      )}
      {...props}
    />
  ),
);
Command.displayName = "Command";

export const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  CommandInputProps
>(({ className, ...props }, ref) => (
  <div className="flex h-9 shrink-0 items-center gap-2 rounded-[var(--radius-md)] border border-input bg-surface-inset px-3">
    <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "min-w-0 flex-1 bg-transparent font-ui text-sm text-foreground outline-none placeholder:text-subtle-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = "CommandInput";

export const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  CommandListProps
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("mt-2 max-h-64 overflow-y-auto overflow-x-hidden", className)}
    {...props}
  />
));
CommandList.displayName = "CommandList";

export const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  CommandEmptyProps
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className={cn("px-2 py-6 text-center text-sm text-muted-foreground", className)}
    {...props}
  />
));
CommandEmpty.displayName = "CommandEmpty";

export const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  CommandGroupProps
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      // cmdk renders the heading itself, so it can only be reached by attribute selector.
      "overflow-hidden [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-ui [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground",
      className,
    )}
    {...props}
  />
));
CommandGroup.displayName = "CommandGroup";

export const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  CommandItemProps
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm outline-none transition data-[selected=true]:bg-secondary data-[selected=true]:text-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-45",
      className,
    )}
    {...props}
  />
));
CommandItem.displayName = "CommandItem";

export const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  CommandSeparatorProps
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("my-1 h-px bg-border", className)}
    {...props}
  />
));
CommandSeparator.displayName = "CommandSeparator";
