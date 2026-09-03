"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { DAILY_SOFT_WARNING_MINUTES } from "@/src/lib/time-entry-limits";
import { cn } from "@/src/lib/utils";
import type { TimeGridDay } from "@/src/server/time-tracking";

import { useTimeZoom } from "./use-time-zoom";
import { resolveZoomShortcut, stepZoomLevel, type ZoomLevel } from "./zoom";

type TimeZoomShellProps = {
  days: TimeGridDay[];
  todayIso: string;
  /** The selected day's logged minutes, which the persistent total reads. */
  dayTotalMinutes: number;
  formatMinutes: (minutes: number) => string;
  onPreviousPeriod: () => void;
  onNextPeriod: () => void;
  onToday: () => void;
  renderLevel: (level: ZoomLevel) => ReactNode;
};

/**
 * The chrome that stays put while the resolution changes underneath it.
 *
 * The continuity contract in §7 of `docs/time-view-zoom-axis.md` is not about animation — it is
 * about what survives a level change, and all of it is structural. The day strip is rendered here,
 * above the level, precisely so that it never unmounts: the selected day, the day total and the
 * focus ring on a day chip all outlive a transition because the elements holding them are never
 * torn down. Motion arrives on top of this later; nothing here depends on it.
 *
 * The level content comes in through `renderLevel` rather than as three nodes, so the grid's ~70
 * cells are only built when the grid is the level being shown.
 */
export function TimeZoomShell({
  days,
  todayIso,
  dayTotalMinutes,
  formatMinutes,
  onPreviousPeriod,
  onNextPeriod,
  onToday,
  renderLevel,
}: TimeZoomShellProps) {
  const t = useTranslations("TimeTracking");
  const { level, selectedDayIso, setLevel, setSelectedDayIso } = useTimeZoom({ days, todayIso });
  const dayChipRefs = useRef(new Map<string, HTMLButtonElement>());
  const previousLevel = useRef(level);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const shortcut = resolveZoomShortcut(event);

      if (!shortcut) return;

      event.preventDefault();

      if (shortcut.type === "level") setLevel(shortcut.level);
      if (shortcut.type === "step") setLevel(stepZoomLevel(level, shortcut.direction));
      if (shortcut.type === "period") {
        if (shortcut.direction === "previous") onPreviousPeriod();
        else onNextPeriod();
      }
      if (shortcut.type === "today") onToday();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [level, onNextPeriod, onPreviousPeriod, onToday, setLevel]);

  /**
   * Continuity items 4 and 5, which only a level change can break.
   *
   * Focus is left exactly where it is whenever it survived — the point is not to move focus, it is
   * that a level change must never dump it on `<body>`. It lands there when the element that was
   * focused belonged to the level that just went away, which is what clicking a day column header
   * at L2 does; the day chip is where that focus belongs, because it is the same day.
   */
  useEffect(() => {
    if (previousLevel.current === level) return;

    previousLevel.current = level;

    const chip = dayChipRefs.current.get(selectedDayIso);
    const active = document.activeElement;

    if (!active || active === document.body) chip?.focus();
    if (typeof chip?.scrollIntoView === "function") chip.scrollIntoView({ block: "nearest" });
  }, [level, selectedDayIso]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div
          role="group"
          aria-label={t("zoom.dayStrip")}
          className="grid grid-cols-7 gap-1.5 sm:w-auto"
        >
          {days.map((day) => {
            const selected = day.isoDate === selectedDayIso;
            // Clicking the day you are already on is the one gesture that has nowhere finer to go,
            // so at L1 it means the opposite: step back out to the week.
            const zoomsOut = selected && level === "day";

            return (
              <button
                key={day.isoDate}
                ref={(node) => {
                  if (node) dayChipRefs.current.set(day.isoDate, node);
                  else dayChipRefs.current.delete(day.isoDate);
                }}
                type="button"
                aria-pressed={selected}
                aria-label={zoomsOut ? t("zoom.zoomOut") : t("zoom.selectDay", { day: day.label })}
                className={cn(
                  "rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 text-center transition hover:border-accent/45 hover:bg-accent-soft",
                  selected && "border-accent bg-accent-soft text-accent",
                  day.state === "future" && "opacity-65",
                )}
                onClick={() =>
                  zoomsOut ? setLevel(stepZoomLevel(level, "out")) : setSelectedDayIso(day.isoDate)
                }
              >
                <span className="block font-ui text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  {day.shortLabel}
                </span>
                <span className="block text-base font-semibold">{day.dayNumber}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 sm:justify-end">
          <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {t("labels.dayTotal")}
          </span>
          <span
            className={cn(
              "text-[26px] font-semibold",
              dayTotalMinutes > DAILY_SOFT_WARNING_MINUTES ? "text-warning" : "text-foreground",
            )}
          >
            {formatMinutes(dayTotalMinutes)}
          </span>
        </div>
      </div>

      {renderLevel(level)}
    </div>
  );
}
