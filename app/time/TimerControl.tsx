"use client";

import { Play, Square } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { useTranslations } from "next-intl";

import { Button } from "@/src/components/ui/Button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/Tooltip";
import { ShortcutChip } from "@/src/components/sheet/TimeScopeBar";
import { levelTransition, TIMER_LAYOUT_ID } from "@/src/lib/motion";
import { useElapsedLabel } from "@/src/lib/use-elapsed-label";
import type { RunningTimerView } from "@/src/server/time-tracking";

type TimerControlProps = {
  runningTimer: RunningTimerView | null;
  disabled: boolean;
  canStart: boolean;
  onStart: () => void;
  onStop: () => void;
};

/**
 * The toolbar's timer slot (§5.9 of `docs/time-view-redesign.md`).
 *
 * `▷ Start timer` is a ghost button. When a timer runs it **morphs** — same `layoutId`, same slot —
 * into a live pill: `● 00:42:13 · Atlas Platform ■`, the dot pulsing at the ping's cadence and
 * hidden under reduced motion. The full-size card that used to sit above the week is gone; the
 * pill here and the live card at the top of today's list are the timer's two homes on the page.
 */
export function TimerControl({
  runningTimer,
  disabled,
  canStart,
  onStart,
  onStop,
}: TimerControlProps) {
  const t = useTranslations("TimeTracking");
  const elapsed = useElapsedLabel(runningTimer?.startedAt ?? null);

  return (
    <TooltipProvider delayDuration={400}>
      <AnimatePresence mode="wait" initial={false}>
        {runningTimer ? (
          <m.div
            key="running"
            layoutId={TIMER_LAYOUT_ID}
            layout="position"
            transition={levelTransition}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="status"
            aria-label={`${t("timer.running")} · ${elapsed} · ${runningTimer.projectName}`}
            className="inline-flex h-10 max-w-[18rem] items-center gap-2 rounded-[var(--radius-pill)] border border-accent-line bg-accent-soft pl-3 pr-1 text-sm"
          >
            <span aria-hidden="true" className="relative flex size-2.5 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-45 motion-reduce:hidden" />
              <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
            </span>
            <span className="font-ui text-sm font-bold tabular-nums text-accent">{elapsed}</span>
            <span aria-hidden="true" className="text-muted-foreground">
              ·
            </span>
            <span className="min-w-0 truncate text-xs font-medium text-foreground">
              {runningTimer.projectName}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={t("timer.stopTimer")}
                  className="ml-1 grid size-8 shrink-0 place-items-center rounded-full text-destructive transition-colors duration-[var(--duration-micro)] hover:bg-destructive-soft disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={onStop}
                >
                  <Square className="size-3 fill-current" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t("timer.stopTimer")}
                <ShortcutChip>S</ShortcutChip>
              </TooltipContent>
            </Tooltip>
          </m.div>
        ) : (
          <m.div
            key="idle"
            layoutId={TIMER_LAYOUT_ID}
            layout="position"
            transition={levelTransition}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  icon={Play}
                  disabled={disabled || !canStart}
                  onClick={onStart}
                >
                  {t("timer.startTimer")}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t("timer.startTimer")}
                <ShortcutChip>S</ShortcutChip>
              </TooltipContent>
            </Tooltip>
          </m.div>
        )}
      </AnimatePresence>
    </TooltipProvider>
  );
}
