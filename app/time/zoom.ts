/**
 * The resolution axis behind `/time`.
 *
 * Everything here is pure so the axis can be reasoned about — and tested — without a DOM: the
 * stop order, what a keystroke means, and which day a URL resolves to. `use-time-zoom.ts` binds it
 * to the URL, `TimeZoomShell.tsx` renders it.
 *
 * Plain `.ts` with no directive: the stop list and the param names are shared with anything that
 * needs to build a `/time` link.
 */

import type { TrackingMode } from "@/src/server/time-tracking";

/**
 * Ordered zoomed-in → zoomed-out, which is the order the `SegmentedControl` renders, the order the
 * number keys select, and the direction `-` / `+` step.
 *
 * Every stop a member can *possibly* have. Which of them a given member actually gets is
 * {@link resolveZoomStops}, and it is that list — not this one — that the control, the digit keys
 * and the steps are bounded by.
 */
export const zoomLevels = ["day", "week", "grid", "month"] as const;

export type ZoomLevel = (typeof zoomLevels)[number];

/**
 * The one stop a declared-only member gets (§5).
 *
 * A member whose hours all live in another company's system has nothing at the finer resolutions —
 * no entries to read at L1, no week to fill at L3 — so the axis collapses to the month, and a
 * one-stop `SegmentedControl` is not worth rendering. Everything else here is bounded by this list
 * for the same reason: a stop that is not offered must not be reachable by keyboard either.
 */
export const declaredOnlyZoomStops = ["month"] as const satisfies readonly ZoomLevel[];

export const ZOOM_PARAM = "zoom";
export const DAY_PARAM = "day";

/**
 * The level a member lands on with no `?zoom=` and nothing remembered. The week is the level that
 * answers "what did I do this week?", which is the question the page is opened with; the grid is
 * for filling one in, which is a deliberate act.
 */
export const defaultZoomLevel = "week" satisfies ZoomLevel;

export const zoomStorageKey = "time-zoom";

export function isZoomLevel(value: unknown): value is ZoomLevel {
  return zoomLevels.includes(value as ZoomLevel);
}

/**
 * Which stops a member gets, derived from their assignments rather than fixed (§5).
 *
 * Tracked-only and hybrid members get all four: a monthly overview is useful to everyone and costs
 * nothing once built. A **declared-only** member — assignments, none of them tracked here — gets
 * the month alone. A member with no assignments at all is not declared-only; they get the full
 * axis, and the empty state `/time` already shows them.
 *
 * Takes resolved modes, so the precedence between an assignment override and the member default is
 * `resolveTrackingMode`'s business and never re-decided here.
 */
export function resolveZoomStops(
  assignments: readonly { trackingMode: TrackingMode }[],
): readonly ZoomLevel[] {
  const declaredOnly =
    assignments.length > 0 &&
    assignments.every((assignment) => assignment.trackingMode === "DECLARED");

  return declaredOnly ? declaredOnlyZoomStops : zoomLevels;
}

/**
 * The nearest stop the member actually has.
 *
 * Applied on every read rather than on write, which is what makes a declared-only member land on
 * the month whatever a shared link or a remembered preference says — and what keeps the forced
 * level out of `localStorage`, so the same browser signed in as someone else is unaffected.
 */
export function clampZoomLevel(level: ZoomLevel, stops: readonly ZoomLevel[]): ZoomLevel {
  return stops.includes(level) ? level : (stops[0] ?? defaultZoomLevel);
}

/** `in` moves toward the day, `out` toward the month. Clamped at both ends — never wraps. */
export function stepZoomLevel(
  level: ZoomLevel,
  direction: "in" | "out",
  stops: readonly ZoomLevel[],
): ZoomLevel {
  const index = stops.indexOf(level);

  if (index < 0) return clampZoomLevel(level, stops);

  const nextIndex = Math.min(stops.length - 1, Math.max(0, index + (direction === "in" ? -1 : 1)));

  return stops[nextIndex] ?? level;
}

/**
 * The first of the month a day falls in.
 *
 * **The month comes from `day`, never from `week`** (§11). A week can span two months — the design
 * doc's own example week is Aug 31 - Sep 6, 2026 — so deriving it from the week start would put the
 * whole of that week in August, including the six days of it that are September.
 */
export function resolveMonthStartIso(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

/** The first of the month `months` away. Counts in absolute months, so December wraps the year. */
export function shiftMonthStartIso(monthStartIso: string, months: number): string {
  const year = Number.parseInt(monthStartIso.slice(0, 4), 10);
  const monthIndex = Number.parseInt(monthStartIso.slice(5, 7), 10) - 1 + months;
  const shiftedYear = year + Math.floor(monthIndex / 12);
  const shiftedMonth = ((monthIndex % 12) + 12) % 12;

  return `${String(shiftedYear).padStart(4, "0")}-${String(shiftedMonth + 1).padStart(2, "0")}-01`;
}

/**
 * The Monday of the week a day falls in, which is the `week` param the month level navigates to:
 * §11's "`[` and `]` set `day` to the 1st of the adjacent month and `week` to the week containing
 * it". The server owns the same rule in `getMonday`; this is the client's half, over ISO strings.
 */
export function resolveWeekStartIso(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  const weekday = (date.getUTCDay() + 6) % 7;

  date.setUTCDate(date.getUTCDate() - weekday);

  return date.toISOString().slice(0, 10);
}

/**
 * The month L4 shows: the selected day's month when the page loaded it, else the first month it
 * did load.
 *
 * The same shape as {@link resolveSelectedDayIso} and for the same reason — validating against
 * what is actually on the client is what keeps a hand-edited URL, or a `day` left over from
 * another week, from asking the month level for data that never arrived.
 */
export function resolveSelectedMonthStartIso(
  selectedDayIso: string,
  monthStarts: readonly string[],
): string {
  const derived = resolveMonthStartIso(selectedDayIso);

  return monthStarts.includes(derived) ? derived : (monthStarts[0] ?? derived);
}

/**
 * The selected day, resolved the way §11 of the design doc specifies: the `?day=` param when it
 * names a day of the visible week, else today when the week contains it, else the week start.
 *
 * Validating against the visible week rather than the string alone is what keeps a stale `day` from
 * a previous week — or a hand-edited URL — out of the rest of the page.
 */
export function resolveSelectedDayIso(
  dayParam: string | null,
  days: readonly { isoDate: string }[],
  todayIso: string,
): string {
  const weekStart = days[0]?.isoDate ?? todayIso;

  if (dayParam && days.some((day) => day.isoDate === dayParam)) return dayParam;
  if (days.some((day) => day.isoDate === todayIso)) return todayIso;

  return weekStart;
}

export type ZoomShortcut =
  | { type: "level"; level: ZoomLevel }
  | { type: "step"; direction: "in" | "out" }
  | { type: "period"; direction: "previous" | "next" }
  | { type: "today" };

/**
 * What a keystroke on `/time` means, or `null` for "leave it alone".
 *
 * Two rules make the difference between a shortcut and a surprise. Nothing fires while a text
 * input, a textarea or a dialog has the keystroke — someone typing `3h 20m` into a cell is not
 * asking for the grid — and nothing fires with Ctrl / Cmd / Alt held, because those belong to the
 * browser. Shift is allowed through because `+` needs it on most layouts.
 *
 * The arrow keys are deliberately not claimed: the grid is a spreadsheet, and arrow-key movement
 * between its cells is the muscle memory anyone filling a week brings to it.
 *
 * `[` and `]` stay a generic `{ type: "period" }`: at L1-L3 a period is a week and at L4 it is a
 * month, and only the caller knows which level it is on. The digit keys and the steps are bounded
 * by `stops` — the member's own stop list — so a level they were not offered is not reachable by
 * keyboard either.
 */
export function resolveZoomShortcut(
  event: {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    target: EventTarget | null;
  },
  stops: readonly ZoomLevel[],
): ZoomShortcut | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (suppressesZoomShortcut(event.target)) return null;

  const digit = Number.parseInt(event.key, 10);
  const level = digit >= 1 && digit <= stops.length ? stops[digit - 1] : undefined;
  if (level) return { type: "level", level };

  switch (event.key) {
    case "-":
      return { type: "step", direction: "out" };
    case "+":
      return { type: "step", direction: "in" };
    case "[":
      return { type: "period", direction: "previous" };
    case "]":
      return { type: "period", direction: "next" };
    case "t":
    case "T":
      return { type: "today" };
    default:
      return null;
  }
}

/**
 * Anything that owns the keystroke itself: a field being typed into, or an overlay that has taken
 * over the keyboard. A menu and a listbox count — both run their own type-ahead.
 */
export function suppressesZoomShortcut(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName;

  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") return true;
  if (target.isContentEditable) return true;

  return Boolean(target.closest('[role="dialog"], [role="menu"], [role="listbox"]'));
}
