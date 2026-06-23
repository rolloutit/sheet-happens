"use client";

import { cn } from "@/src/lib/utils";
import type { SegmentedControlProps } from "./SegmentedControl.types";

export function SegmentedControl({
  items,
  value,
  onValueChange,
  label,
  size = "md",
  className,
  ...props
}: SegmentedControlProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex rounded-[var(--radius-pill)] border border-border bg-secondary/80 p-1",
        className,
      )}
      {...props}
    >
      {items.map((item) => {
        const selected = item.value === value;

        return (
          <button
            key={item.value}
            type="button"
            disabled={item.disabled}
            aria-pressed={selected}
            onClick={() => onValueChange?.(item.value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-[var(--radius-pill)] font-ui font-semibold text-muted-foreground transition duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3 text-sm",
              selected &&
                "bg-primary text-primary-foreground shadow-soft hover:text-primary-foreground",
            )}
          >
            <span>{item.label}</span>
            {typeof item.count === "number" ? (
              <span className="rounded-[var(--radius-pill)] bg-background/30 px-1.5 text-[10px]">
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
