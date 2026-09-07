"use client";

import * as m from "motion/react-m";
import { useId, useRef } from "react";

import { springThumb } from "@/src/lib/motion";
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
  indicator = "static",
  indicatorId,
  className,
  ...props
}: SegmentedControlProps) {
  const generatedId = useId();
  const thumbId = indicatorId ?? `segmented-thumb-${generatedId}`;
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const enabledItems = items.filter((item) => !item.disabled);
  const selectedItem = items.find((item) => item.value === value && !item.disabled);
  const tabStopValue = selectedItem?.value ?? enabledItems[0]?.value;
  const sliding = indicator === "slide";

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
        "group/segmented inline-flex rounded-[var(--radius-pill)] border border-border bg-secondary/80 p-1",
        orientation === "vertical" && "flex-col rounded-[var(--radius-lg)]",
        width === "full" && "flex w-full",
        className,
      )}
      {...props}
    >
      {items.map((item) => {
        const selected = item.value === value;
        const Icon = item.icon;

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
              "relative inline-flex items-center gap-2 rounded-[var(--radius-pill)] font-ui font-semibold text-muted-foreground transition duration-200 hover:text-foreground disabled:pointer-events-none disabled:opacity-45",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3 text-sm",
              width === "full" && "flex-1 justify-center",
              selected && "text-primary-foreground hover:text-primary-foreground",
              selected && !sliding && "bg-primary shadow-soft",
            )}
          >
            {/* One thumb for the whole group: it is rendered inside whichever radio is selected and
                carries a shared `layoutId`, so Motion projects it from the old segment to the new
                one rather than painting a second pill. `initial={false}` keeps it from growing in
                on mount, which would read as the control loading. */}
            {selected && sliding ? (
              <m.span
                layoutId={thumbId}
                data-indicator=""
                aria-hidden="true"
                initial={false}
                transition={springThumb}
                className="absolute inset-0 rounded-[var(--radius-pill)] bg-primary shadow-soft"
              />
            ) : null}
            {Icon ? <Icon className="relative z-[1] size-3.5 shrink-0" aria-hidden="true" /> : null}
            <span className="relative z-[1]">{item.label}</span>
            {typeof item.count === "number" ? (
              <span className="relative z-[1] rounded-[var(--radius-pill)] bg-background/30 px-1.5 text-[10px]">
                {item.count}
              </span>
            ) : null}
            {item.shortcut ? (
              <kbd
                aria-hidden="true"
                className={cn(
                  "relative z-[1] hidden min-w-4 rounded-[var(--radius-xs)] border px-1 font-ui text-[10px] font-semibold leading-4 transition-colors duration-[var(--duration-micro)] lg:inline-block",
                  selected
                    ? "border-primary-foreground/25 text-primary-foreground/80"
                    : "border-border text-subtle-foreground group-hover/segmented:text-muted-foreground group-focus-within/segmented:text-muted-foreground",
                )}
              >
                {item.shortcut}
              </kbd>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
