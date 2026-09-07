"use client";

import { Square } from "lucide-react";

import { cn } from "@/src/lib/utils";
import type { RunningEntryCardProps } from "./EntryCard.types";

/**
 * The running timer as the first card of today (§5.9 of `docs/time-view-redesign.md`) — the Toggl
 * convention that the timer is the first row of the day it is filling. A mint rail, the ticking
 * duration, and the stop button where the card's actions would be. Stopping it lets the saved
 * entry take its place through the ordinary card enter.
 *
 * The pulse is CSS and hidden under reduced motion; the elapsed label arrives as a prop so the
 * component is a pure function of what it is given and a story or a baseline never ticks.
 */
export function RunningEntryCard({
  projectName,
  projectColor,
  description,
  elapsedLabel,
  density = "compact",
  labels,
  disabled = false,
  className,
  onStop,
}: RunningEntryCardProps) {
  const compact = density === "compact";

  return (
    <div
      className={cn(
        "relative grid rounded-[var(--radius-md)] border border-accent-line border-l-[3px] border-l-accent bg-accent-soft/60",
        compact ? "gap-0.5 py-2 pl-2.5 pr-2" : "gap-1 px-4 py-3 pl-[1.125rem]",
        className,
      )}
      role="status"
      aria-label={`${labels.live} · ${elapsedLabel} · ${description || projectName}`}
    >
      <div className="flex min-w-0 items-start gap-2">
        <p
          className={cn(
            "min-w-0 flex-1 break-words text-foreground",
            compact ? "line-clamp-2 text-xs font-medium leading-snug" : "text-sm font-semibold",
          )}
        >
          {description || projectName}
        </p>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 font-ui font-semibold tabular-nums text-accent",
            compact ? "text-xs" : "text-sm",
          )}
        >
          <span aria-hidden="true" className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-45 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-accent" />
          </span>
          {elapsedLabel}
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1.5 text-muted-foreground",
            compact ? "text-[11px] leading-4" : "text-xs",
          )}
        >
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: projectColor }}
          />
          <span className="min-w-0 truncate">{projectName}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">{labels.live}</span>
        </span>
        {onStop ? (
          <button
            type="button"
            disabled={disabled}
            aria-label={labels.stop}
            title={labels.stop}
            className={cn(
              "ml-auto grid shrink-0 place-items-center rounded-[var(--radius-sm)] text-destructive transition-colors duration-[var(--duration-micro)] hover:bg-destructive-soft disabled:cursor-not-allowed disabled:opacity-40",
              compact ? "size-7" : "size-8",
            )}
            onClick={onStop}
          >
            <Square
              className={cn("fill-current", compact ? "size-3" : "size-3.5")}
              aria-hidden="true"
            />
          </button>
        ) : null}
      </div>
    </div>
  );
}
