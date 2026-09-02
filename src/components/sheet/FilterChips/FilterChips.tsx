"use client";

import { X } from "lucide-react";

import { Button } from "@/src/components/ui/Button";
import { ChipButton } from "@/src/components/ui/ChipButton";
import { cn } from "@/src/lib/utils";
import type { FilterChipsProps } from "./FilterChips.types";

/**
 * The row under a filter toolbar that says what is actually filtering the list.
 *
 * Once the labels move off the controls to keep the toolbar to one line, this is what stops
 * the filter state from going invisible — and it takes a filter off in one click, which is
 * the thing a "more filters" popover cannot do without being opened first.
 */
export function FilterChips<Id extends string>({
  chips,
  labels,
  onRemove,
  onClear,
  summary,
  className,
}: FilterChipsProps<Id>) {
  if (!chips.length && !summary) return null;

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {chips.length ? (
          <>
            <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {labels.active}
            </span>
            {chips.map((chip) => (
              <ChipButton
                key={chip.id}
                selected
                removable
                leading={chip.leading}
                aria-label={labels.remove(chip.aria ?? chip.label)}
                onClick={() => onRemove(chip.id)}
              >
                {chip.label}
              </ChipButton>
            ))}
            <Button type="button" variant="ghost" size="sm" icon={X} onClick={onClear}>
              {labels.clear}
            </Button>
          </>
        ) : null}
      </div>
      {summary ? (
        <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
          {summary}
        </p>
      ) : null}
    </div>
  );
}
