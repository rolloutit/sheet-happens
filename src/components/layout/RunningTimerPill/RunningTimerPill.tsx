"use client";

import { Square, X } from "lucide-react";

import { cn } from "@/src/lib/utils";
import {
  runningTimerPillVariants,
  runningTimerProjectVisibility,
} from "./RunningTimerPill.variants";
import type { RunningTimerPillProps } from "./RunningTimerPill.types";

/**
 * The header's running-timer surface: a live elapsed pill that navigates to time tracking, with a
 * stop button hung off its corner and a slot for whatever the last stop attempt reported.
 *
 * The pill and the error note are one component rather than two because they are one story. A stop
 * that trips the daily limit throws the time away, deletes the timer and reports an error — so the
 * note has to keep standing after the pill it belongs to has gone.
 */
export function RunningTimerPill({
  timer,
  elapsedLabel,
  labels,
  density = "responsive",
  disabled = false,
  error = null,
  className,
  onOpen,
  onStop,
  onDismissError,
}: RunningTimerPillProps) {
  if (!timer && !error) return null;

  return (
    <div className={cn("relative", className)}>
      {timer ? (
        <>
          <button
            type="button"
            className={runningTimerPillVariants({ density })}
            aria-label={labels.open}
            title={timer.description || timer.projectName}
            onClick={onOpen}
          >
            <span className="relative flex size-2.5 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-45" />
              <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
            </span>
            <span className="font-ui text-[12px] font-bold text-accent">
              <span className="sr-only">{labels.running} </span>
              {elapsedLabel}
            </span>
            {density === "compact" ? null : (
              <span
                className={cn(
                  "min-w-0 items-center gap-2",
                  runningTimerProjectVisibility[density],
                  density === "comfortable" && "inline-flex",
                )}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: timer.projectColor }}
                  aria-hidden="true"
                />
                <span className="truncate text-xs font-medium">{timer.projectName}</span>
              </span>
            )}
          </button>
          <button
            type="button"
            className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full border border-destructive/40 bg-card text-destructive shadow-soft transition hover:bg-destructive-soft disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={labels.stop}
            disabled={disabled || !onStop}
            onClick={(event) => {
              event.stopPropagation();
              onStop?.();
            }}
          >
            <Square className="size-2.5 fill-current" aria-hidden="true" />
          </button>
        </>
      ) : null}

      {error ? (
        <span
          role="alert"
          className={cn(
            "absolute right-0 z-10 flex w-56 items-start gap-2 rounded-[var(--radius-sm)] border border-destructive/35 bg-card px-2 py-1 text-xs font-medium text-destructive shadow-panel",
            // Anchored under the pill when there is one, and in its place when there is not.
            timer ? "top-[calc(100%+0.35rem)]" : "top-0",
          )}
        >
          <span className="flex-1">{error}</span>
          {onDismissError ? (
            <button
              type="button"
              className="grid size-4 shrink-0 place-items-center rounded-full transition hover:bg-destructive-soft"
              aria-label={labels.dismissError}
              onClick={onDismissError}
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
