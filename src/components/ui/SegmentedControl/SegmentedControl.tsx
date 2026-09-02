"use client";

import { useRef } from "react";

import { cn } from "@/src/lib/utils";
import type { SegmentedControlProps } from "./SegmentedControl.types";

export function SegmentedControl({
  items,
  value,
  onValueChange,
  label,
  size = "md",
  orientation = "horizontal",
  width = "auto",
  className,
  ...props
}: SegmentedControlProps) {
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const enabledItems = items.filter((item) => !item.disabled);
  const selectedItem = items.find((item) => item.value === value && !item.disabled);
  const tabStopValue = selectedItem?.value ?? enabledItems[0]?.value;

  function moveSelection(currentValue: string, direction: 1 | -1) {
    const currentIndex = enabledItems.findIndex((item) => item.value === currentValue);
    const startIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (startIndex + direction + enabledItems.length) % enabledItems.length;
    const nextValue = enabledItems[nextIndex]?.value;

    if (!nextValue) return;

    onValueChange?.(nextValue);
    window.requestAnimationFrame(() => itemRefs.current.get(nextValue)?.focus());
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-orientation={orientation}
      className={cn(
        "inline-flex rounded-[var(--radius-pill)] border border-border bg-secondary/80 p-1",
        orientation === "vertical" && "flex-col rounded-[var(--radius-lg)]",
        width === "full" && "flex w-full",
        className,
      )}
      {...props}
    >
      {items.map((item) => {
        const selected = item.value === value;

        return (
          <button
            key={item.value}
            ref={(node) => {
              if (node) itemRefs.current.set(item.value, node);
              else itemRefs.current.delete(item.value);
            }}
            type="button"
            role="radio"
            disabled={item.disabled}
            aria-checked={selected}
            tabIndex={item.value === tabStopValue ? 0 : -1}
            onClick={() => onValueChange?.(item.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                moveSelection(item.value, 1);
              }
              if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                moveSelection(item.value, -1);
              }
            }}
            className={cn(
              "inline-flex items-center gap-2 rounded-[var(--radius-pill)] font-ui font-semibold text-muted-foreground transition duration-200 hover:text-foreground disabled:pointer-events-none disabled:opacity-45",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3 text-sm",
              width === "full" && "flex-1 justify-center",
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
