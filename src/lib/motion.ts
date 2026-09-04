"use client";

import { useSyncExternalStore } from "react";

/**
 * The motion vocabulary of the `/time` resolution axis, as TypeScript literals.
 *
 * **The token table in `app/globals.css` is the source of truth** — `--ease-standard`,
 * `--ease-exit`, `--duration-level`, `--duration-micro`, `--duration-bar`, `--stagger-entry`,
 * documented in `docs/tokens.md`. The values are repeated here because Motion animates via JS
 * outside CSS transitions and cannot interpolate a `var()`. Change one and change the other.
 *
 * Durations are seconds, which is what Motion takes; the tokens are milliseconds, which is what
 * CSS takes. That is the only difference between the two lists.
 *
 * This module sits in `src/lib` rather than `app/time` — where §12 of
 * `docs/time-view-zoom-axis.md` sketches it — because the entry cards that carry the stagger live
 * inside `WeekAgenda` and `DayAgenda`, which are library components. Nothing under `src/` imports
 * from `app/`, and inverting that for a table of six numbers would be the wrong trade. The
 * `/time`-specific half of the wiring, the `LazyMotion` feature boundary, does stay in
 * `app/time/motion-features.ts`.
 */

/** `cubic-bezier(0.2, 0.7, 0.2, 1)` — the default for everything. */
export const EASE_STANDARD: [number, number, number, number] = [0.2, 0.7, 0.2, 1];

/** `cubic-bezier(0.4, 0, 1, 1)` — elements leaving, which should be quick and unremarkable. */
export const EASE_EXIT: [number, number, number, number] = [0.4, 0, 1, 1];

/** 260ms — a zoom-level transition. */
export const DURATION_LEVEL = 0.26;

/** 140ms — hover, chip state, badge crossfade, and a single card arriving. */
export const DURATION_MICRO = 0.14;

/** 300ms — a capacity bar changing width. */
export const DURATION_BAR = 0.3;

/** 18ms — the step between entry cards entering. */
export const STAGGER_ENTRY = 0.018;

/**
 * How many cards in a column actually stagger.
 *
 * §9's arithmetic: a 40-entry week at 18ms each is 720ms of drizzle. Capping the *delay* rather
 * than dropping it past the cap bounds the whole cascade to 7 × 18ms = 126ms while keeping the
 * cards in reading order — dropping it would make the tenth card arrive before the third, which
 * looks like a bug rather than a restraint.
 */
export const STAGGER_CAP = 8;

/** A zoom-level transition: the shared `layoutId` morph and anything that rides along with it. */
export const levelTransition = { duration: DURATION_LEVEL, ease: EASE_STANDARD } as const;

/** A capacity bar growing or shrinking. */
export const barTransition = { duration: DURATION_BAR, ease: EASE_STANDARD } as const;

/** Leaving. Opacity only, and faster than arriving. */
export const exitTransition = { duration: DURATION_MICRO, ease: EASE_EXIT } as const;

/**
 * Entering entry cards: opacity plus 4px of `y`, and nothing else.
 *
 * Transform and opacity only — no width, height, top or left — so the whole cascade stays on the
 * compositor. Exits carry no movement at all.
 */
export const entryCardMotion = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
} as const;

/** Where the nth card in a column sits in the cascade. Capped — see {@link STAGGER_CAP}. */
export function entryStaggerDelay(index: number): number {
  return Math.min(Math.max(index, 0), STAGGER_CAP - 1) * STAGGER_ENTRY;
}

/** The arrival of the nth card in a column. */
export function entryEnterTransition(index: number) {
  return { duration: DURATION_MICRO, ease: EASE_STANDARD, delay: entryStaggerDelay(index) };
}

/**
 * The shared-identity scheme of §7 item 6: one `layoutId` per conceptual object, so the same thing
 * seen at two resolutions morphs rather than swapping.
 *
 * A `layoutId` must name at most one mounted element at a time, which is the constraint that
 * decides where each of these may be used:
 *
 * - {@link dayLayoutId} belongs to the level's own representation of a day — the L2 column, the L3
 *   grid column header. **Not the day chip:** the strip is persistent chrome that never unmounts
 *   (§7 item 2) and is the fixed point the rest moves against (§9), so a chip carrying the same id
 *   as a live column would both collide with it and animate the one thing that must not.
 * - {@link entryLayoutId} belongs to an entry seen at one level at a time — the L1 row, the L2
 *   card. Only the selected day's entries carry it, because only they exist at both levels; a card
 *   in Thursday's column has nothing at L1 to morph into and would just cost a measure pass.
 * - {@link projectLayoutId} belongs to a project row at L4, and **only** there. A project appears
 *   on many cards at L1 and L2, so it cannot name one element at those levels; the L4 bands are the
 *   one place it appears exactly once, because a project is in either the tracked band or the
 *   declared band and never both. That is what lets a row keep its identity as the month changes
 *   under it, and what the declared band will morph against when it lands.
 */
export function dayLayoutId(isoDate: string): string {
  return `day-${isoDate}`;
}

/** See {@link dayLayoutId} for where this may and may not be used. */
export function entryLayoutId(entryId: string): string {
  return `entry-${entryId}`;
}

/** See {@link dayLayoutId} for where this may and may not be used — L4 rows only. */
export function projectLayoutId(projectId: string): string {
  return `project-${projectId}`;
}

/**
 * `false` on the render the browser paints first, `true` from the next one on.
 *
 * §9's `initial={false}` rule: a page that flies in on load reads as cheap and delays first
 * interaction. Passing this down as the `animateEntries` of a level is what separates "the page
 * just opened" from "the level just changed" — the second is worth animating, the first is not.
 * `AnimatePresence initial={false}` cannot do the job on its own here, because a nested
 * `AnimatePresence` supplies its own presence context and shadows the outer one.
 *
 * Read the way `use-time-zoom.ts` reads the remembered level, and for the same reason: the server
 * snapshot is what the hydrating render uses, so the markup React sends and the markup it hydrates
 * agree, and the flip to `true` lands on the render after the first commit rather than inside it.
 * An effect writing state would say the same thing a beat later — and is what the repo's React
 * lint rules forbid.
 */
export function useAfterFirstPaint(): boolean {
  return useSyncExternalStore(
    subscribeToFirstPaint,
    () => true,
    () => false,
  );
}

/** Nothing to subscribe to: the value flips once, when hydration hands over, and never again. */
function subscribeToFirstPaint() {
  return () => {};
}
