"use client";

import { Minus, Plus } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";

import { LENS_THUMB_LAYOUT_ID, microTransition, SCOPE_THUMB_LAYOUT_ID } from "@/src/lib/motion";
import { cn } from "@/src/lib/utils";
import { SegmentedControl, type SegmentItem } from "../../ui/SegmentedControl";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/Tooltip";
import type { TimeScopeBarOption, TimeScopeBarProps } from "./TimeScopeBar.types";

/**
 * Row 1 of the `/time` chrome: *how close*, and the two global actions (§4, §5.1, §5.2 of
 * `docs/time-view-redesign.md`).
 *
 * The scope control has `⊖` / `⊕` end caps — visible, clickable, and the answer to "why can't I
 * use the arrows to change the mode". They *are* the zoom arrows, in zoom glyphs, on the zoom
 * control, so the period arrows in the row below can only ever mean *when*. Each segment carries
 * its key as a chip, which is where Linear, Vimcal and Notion Calendar put shortcuts instead of a
 * legend.
 *
 * The lens toggle appears to the right only in the week scope, fading in with a 6px slide. It is
 * its own `radiogroup` because a lens is not a stop: the week does not get closer or farther when
 * it re-sorts.
 */
export function TimeScopeBar({
  scopes,
  scope,
  canZoomIn,
  canZoomOut,
  lenses = [],
  lens,
  lensVisible = false,
  labels,
  shortcuts,
  density = "comfortable",
  actions,
  disabled = false,
  className,
  onScopeChange,
  onLensChange,
  onZoom,
}: TimeScopeBarProps) {
  const compact = density === "compact";

  return (
    <TooltipProvider delayDuration={400}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-3",
          compact ? "flex-col items-stretch" : "justify-between",
          className,
        )}
      >
        <div className={cn("flex min-w-0 items-center gap-3", compact && "flex-col items-stretch")}>
          <div
            className={cn(
              "inline-flex items-center rounded-[var(--radius-pill)] border border-border bg-secondary/80 p-1",
              compact && "flex w-full",
            )}
          >
            {compact ? null : (
              <ZoomCap
                icon={Minus}
                label={labels.zoomOut}
                shortcut={shortcuts?.zoomOut}
                disabled={disabled || !canZoomOut}
                onClick={() => onZoom("out")}
              />
            )}
            <SegmentedControl
              label={labels.view}
              value={scope}
              indicator="slide"
              indicatorId={SCOPE_THUMB_LAYOUT_ID}
              size={compact ? "sm" : "md"}
              width={compact ? "full" : "auto"}
              items={scopes.map(toSegmentItem)}
              onValueChange={onScopeChange}
              className="border-0 bg-transparent p-0"
            />
            {compact ? null : (
              <ZoomCap
                icon={Plus}
                label={labels.zoomIn}
                shortcut={shortcuts?.zoomIn}
                disabled={disabled || !canZoomIn}
                onClick={() => onZoom("in")}
              />
            )}
          </div>

          <AnimatePresence initial={false}>
            {lensVisible && lenses.length && lens && onLensChange ? (
              <m.div
                key="lens"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={microTransition}
                className={cn("flex items-center gap-3", compact && "w-full")}
              >
                {compact ? null : <span aria-hidden="true" className="h-5 w-px bg-border" />}
                <SegmentedControl
                  label={labels.lens}
                  value={lens}
                  size="sm"
                  indicator="slide"
                  indicatorId={LENS_THUMB_LAYOUT_ID}
                  width={compact ? "full" : "auto"}
                  items={lenses.map(toSegmentItem)}
                  onValueChange={onLensChange}
                />
              </m.div>
            ) : null}
          </AnimatePresence>
        </div>

        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </TooltipProvider>
  );
}

function toSegmentItem(option: TimeScopeBarOption): SegmentItem {
  return {
    value: option.value,
    icon: option.icon,
    shortcut: option.shortcut,
    label: option.badge ? (
      <span className="inline-flex items-center gap-1.5">
        {option.label}
        <span aria-hidden="true" className="size-1 rounded-full bg-accent" />
        <span className="sr-only">{option.badge}</span>
      </span>
    ) : (
      option.label
    ),
  };
}

function ZoomCap({
  icon: Icon,
  label,
  shortcut,
  disabled,
  onClick,
}: {
  icon: typeof Minus;
  label: string;
  shortcut?: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors duration-[var(--duration-micro)] hover:bg-card hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
          onClick={onClick}
        >
          <Icon className="size-4" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {label}
        {shortcut ? <ShortcutChip>{shortcut}</ShortcutChip> : null}
      </TooltipContent>
    </Tooltip>
  );
}

/** The `· key` tail every tooltip on the surface ends with. */
export function ShortcutChip({ children }: { children: string }) {
  return (
    <>
      <span aria-hidden="true"> · </span>
      <kbd className="rounded-[var(--radius-xs)] border border-border-strong bg-background/60 px-1 font-ui text-[10px] font-semibold">
        {children}
      </kbd>
    </>
  );
}
