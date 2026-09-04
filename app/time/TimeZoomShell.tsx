"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { LazyMotion, MotionConfig } from "motion/react";
import * as m from "motion/react-m";
import { useTranslations } from "next-intl";

import { barTransition, levelTransition } from "@/src/lib/motion";
import { DAILY_SOFT_WARNING_MINUTES } from "@/src/lib/time-entry-limits";
import { cn } from "@/src/lib/utils";
import type { TimeGridDay } from "@/src/server/time-tracking";

import { useTimeZoom } from "./use-time-zoom";
import { resolveZoomShortcut, stepZoomLevel, type ZoomLevel } from "./zoom";

/** A day of the visible week, plus the total the capacity bar under its chip measures. */
export type TimeZoomDay = TimeGridDay & { totalMinutes: number };

type TimeZoomShellProps = {
  days: TimeZoomDay[];
  todayIso: string;
  /** The selected day's logged minutes, which the persistent total reads. */
  dayTotalMinutes: number;
  /**
   * The month the selected day falls in, already named in the member's locale.
   *
   * Only the announcement uses it: at L4 "7 days" is not what changed, the month is. The month
   * label and total are *rendered* by the period row above this shell, which owns them at every
   * level — see `MonthOverview` for why they are not part of the level itself.
   */
  month: { label: string; totalMinutes: number };
  /** The member's own stop list (`resolveZoomStops`), which bounds the digits and the steps. */
  stops: readonly ZoomLevel[];
  /**
   * §8's hybrid handoff line — _"Nimbus is declared monthly — see Month"_ — rendered under the day
   * strip at L1-L3 and dropped at L4.
   *
   * A shell prop rather than something each level renders, for two reasons. It has to sit under the
   * strip, and the strip is here; and written into all three `renderLevel` branches it would be
   * three copies of one sentence, which is three places to forget it. It arrives as an already-built
   * node, so the shell still knows nothing about projects — only where the line goes and at which
   * levels it belongs.
   */
  handoff?: ReactNode;
  formatMinutes: (minutes: number) => string;
  onPreviousPeriod: () => void;
  onNextPeriod: () => void;
  onToday: () => void;
  renderLevel: (level: ZoomLevel) => ReactNode;
};

/**
 * `domMax`, loaded after first paint. See `motion-features.ts` for why it is not `domAnimation`.
 */
const loadMotionFeatures = () => import("./motion-features").then((module) => module.default);

/**
 * The chrome that stays put while the resolution changes underneath it.
 *
 * The continuity contract in §7 of `docs/time-view-zoom-axis.md` is not about animation — it is
 * about what survives a level change, and all of it is structural. The day strip is rendered here,
 * above the level, precisely so that it never unmounts: the selected day, the day total and the
 * focus ring on a day chip all outlive a transition because the elements holding them are never
 * torn down. The motion added on top makes that survival legible; nothing here depends on it.
 *
 * The level content comes in through `renderLevel` rather than as three nodes, so the grid's ~70
 * cells are only built when the grid is the level being shown.
 *
 * This is also the `/time` client root, so it is where the two Motion providers live:
 *
 * - `MotionConfig reducedMotion="user"` is **required, not belt-and-braces**. The global
 *   `prefers-reduced-motion` block in `app/globals.css` zeroes CSS durations and does nothing at
 *   all to Motion, which animates via JS outside CSS transitions. Without this, `/time` would be
 *   the one screen in the app that ignores the OS setting. `"user"` keeps opacity and drops
 *   transform and layout, which is the right degradation: the level still crossfades, nothing
 *   flies.
 * - `LazyMotion strict` keeps the feature bundle off every other route and makes a stray full
 *   `motion.*` import fail loudly instead of silently re-inflating it.
 */
export function TimeZoomShell({
  days,
  todayIso,
  dayTotalMinutes,
  month,
  stops,
  handoff,
  formatMinutes,
  onPreviousPeriod,
  onNextPeriod,
  onToday,
  renderLevel,
}: TimeZoomShellProps) {
  const t = useTranslations("TimeTracking");
  const { level, selectedDayIso, setLevel, setSelectedDayIso } = useTimeZoom(
    { days, todayIso },
    stops,
  );
  const dayChipRefs = useRef(new Map<string, HTMLButtonElement>());
  const previousLevel = useRef(level);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const shortcut = resolveZoomShortcut(event, stops);

      if (!shortcut) return;

      event.preventDefault();

      if (shortcut.type === "level") setLevel(shortcut.level);
      if (shortcut.type === "step") setLevel(stepZoomLevel(level, shortcut.direction, stops));
      if (shortcut.type === "period") {
        if (shortcut.direction === "previous") onPreviousPeriod();
        else onNextPeriod();
      }
      if (shortcut.type === "today") onToday();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [level, onNextPeriod, onPreviousPeriod, onToday, setLevel, stops]);

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

  /** L4 keeps the week on screen, quieter, as the week returning from the month lands on. */
  const atMonth = level === "month";

  /**
   * §15: a sighted user sees the transition, so a screen reader user has to be told about it.
   *
   * One day at L1, the whole week at L2 and L3, and the total that goes with whichever it is — the
   * same two facts the eye takes from the layout. L4 needs its own sentence rather than a fourth
   * value in the same one: what changed is the month, and "7 days" would be a plain lie about a
   * level that covers thirty of them.
   */
  const announcement = atMonth
    ? t("zoom.announceMonth", {
        level: t("zoom.month"),
        month: month.label,
        total: formatMinutes(month.totalMinutes),
      })
    : t("zoom.announce", {
        level: t(`zoom.${level}`),
        days: level === "day" ? 1 : days.length,
        total: formatMinutes(
          level === "day" ? dayTotalMinutes : days.reduce((sum, day) => sum + day.totalMinutes, 0),
        ),
      });

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion strict features={loadMotionFeatures}>
        <div className="grid gap-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            {/* Mounted at every level, including L4 — continuity item 2, and the reason zooming
                back in from the month is deterministic rather than a jump to today. At L4 it is
                de-emphasised rather than hidden, and by opacity rather than by movement: the chips
                stay operable there (picking the day is how the month is chosen at all, §11), so
                the treatment has to leave them both legible and clickable. */}
            <m.div
              role="group"
              aria-label={atMonth ? t("zoom.dayStripAtMonth") : t("zoom.dayStrip")}
              initial={false}
              animate={{ opacity: atMonth ? 0.7 : 1 }}
              transition={levelTransition}
              className="grid grid-cols-7 gap-1.5 sm:w-auto"
            >
              {days.map((day) => {
                const selected = day.isoDate === selectedDayIso;
                // Clicking the day you are already on is the one gesture that has nowhere finer to
                // go, so at L1 it means the opposite: step back out to the week.
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
                    aria-label={
                      zoomsOut ? t("zoom.zoomOut") : t("zoom.selectDay", { day: day.label })
                    }
                    /* The bar itself is decoration, so the figures it stands for reach a pointer
                       user as a tooltip and assistive technology as the button's description —
                       neither of which disturbs the accessible name the day strip is navigated by. */
                    title={t("week.capacity", {
                      logged: formatMinutes(day.totalMinutes),
                      target: formatMinutes(DAILY_SOFT_WARNING_MINUTES),
                    })}
                    className={cn(
                      "rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 text-center transition hover:border-accent/45 hover:bg-accent-soft",
                      selected && "border-accent bg-accent-soft text-accent",
                      day.state === "future" && "opacity-65",
                    )}
                    onClick={() =>
                      zoomsOut
                        ? setLevel(stepZoomLevel(level, "out", stops))
                        : setSelectedDayIso(day.isoDate)
                    }
                  >
                    <span className="block font-ui text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      {day.shortLabel}
                    </span>
                    <span className="block text-base font-semibold">{day.dayNumber}</span>
                    <CapacityBar minutes={day.totalMinutes} />
                  </button>
                );
              })}
            </m.div>

            <div className="flex items-center gap-3 sm:justify-end">
              <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {t("labels.dayTotal")}
              </span>
              {/* No layout animation and no tween. §9: a rolling odometer on a figure that feeds a
                  timesheet revision reads as imprecise, so the number simply swaps. */}
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

          {/* Information, not a warning, so it reads as a line under the strip rather than as a
              banner (§8). Absent at L4, where the declared projects are on screen and there is
              nothing left to explain. */}
          {handoff && !atMonth ? handoff : null}

          {renderLevel(level)}

          <p aria-live="polite" className="sr-only">
            {announcement}
          </p>
        </div>
      </LazyMotion>
    </MotionConfig>
  );
}

/**
 * How full a day is against the 8h soft target, drawn under its chip.
 *
 * `DAILY_SOFT_WARNING_MINUTES` is the implicit daily capacity (§17 decision 4) — the same number
 * the day view already warns against, so the bar and the warning can never disagree. Past the
 * target the bar fills and turns, rather than overflowing its track: the fact worth reading at a
 * glance is "over", not "over by how much".
 *
 * `scaleX`, not `width`, because §9's performance rule is transform and opacity only — a width
 * tween is a layout pass per frame, seven times over. `initial={false}` so the bars do not grow
 * from nothing when the page opens; they animate when a day's total actually changes.
 */
function CapacityBar({ minutes }: { minutes: number }) {
  const ratio = Math.min(1, Math.max(0, minutes / DAILY_SOFT_WARNING_MINUTES));
  const over = minutes > DAILY_SOFT_WARNING_MINUTES;

  return (
    <span
      aria-hidden="true"
      className="mt-1.5 block h-1 overflow-hidden rounded-[var(--radius-pill)] bg-secondary"
    >
      <m.span
        initial={false}
        animate={{ scaleX: ratio }}
        transition={barTransition}
        className={cn(
          "block h-full origin-left rounded-[var(--radius-pill)]",
          over ? "bg-warning" : "bg-accent",
        )}
      />
    </span>
  );
}
