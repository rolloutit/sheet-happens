/**
 * The scope × lens model behind `/time`.
 *
 * Everything here is pure so the model can be reasoned about — and tested — without a DOM: the
 * scope order, what a keystroke means, and which day a URL resolves to. `use-time-view.ts` binds it
 * to the URL, `TimeZoomShell.tsx` renders it.
 *
 * Three **scopes** form a real time hierarchy — Day ⊂ Week ⊂ Month — and one **lens** applies to
 * the week: Agenda (cards per day) or Grid (project × day). The grid used to be a fourth stop
 * between Week and Month, which broke the axis invariant that zooming out always means more
 * coverage: it covered the same seven days as Week. As a lens it is "another way to see the week",
 * which is what users read it as anyway (`docs/time-view-redesign.md` §3).
 *
 * Plain `.ts` with no directive: the scope list and the param names are shared with anything that
 * needs to build a `/time` link.
 */

import type { TrackingMode } from "@/src/server/time-tracking";

/**
 * Ordered zoomed-in → zoomed-out, which is the order the scope control renders, the order the
 * number keys select, and the direction `−` / `+` step.
 *
 * Every scope a member can *possibly* have. Which of them a given member actually gets is
 * {@link resolveScopeStops}, and it is that list — not this one — that the control, the digit keys
 * and the steps are bounded by.
 */
export const timeScopes = ["day", "week", "month"] as const;

export type TimeScope = (typeof timeScopes)[number];

/** The two ways to look at a week. Only meaningful at the `week` scope. */
export const weekLenses = ["agenda", "grid"] as const;

export type WeekLens = (typeof weekLenses)[number];

/**
 * The one scope a declared-only member gets.
 *
 * A member whose hours all live in another company's system has nothing at the finer resolutions —
 * no entries to read in a day, no week to fill — so the hierarchy collapses to the month, and a
 * one-stop scope control is not worth rendering. Everything else here is bounded by this list for
 * the same reason: a scope that is not offered must not be reachable by keyboard either.
 */
export const declaredOnlyScopes = ["month"] as const satisfies readonly TimeScope[];

export const SCOPE_PARAM = "scope";
export const LENS_PARAM = "lens";
export const DAY_PARAM = "day";
export const WEEK_PARAM = "week";
/** The pre-redesign `?zoom=` param. Still read, never written, so old links and bookmarks work. */
export const LEGACY_ZOOM_PARAM = "zoom";

/**
 * The scope a member lands on with nothing in the URL and nothing remembered. The week answers
 * "what did I do this week?", which is the question the page is opened with on a desktop; on a
 * phone, where seven columns cannot be shown, the day list is where entries get made (§9).
 */
export const defaultScope = "week" satisfies TimeScope;
export const phoneDefaultScope = "day" satisfies TimeScope;
export const defaultLens = "agenda" satisfies WeekLens;

export const scopeStorageKey = "time-scope";
export const lensStorageKey = "time-lens";

/** How long after an overlay swallowed `Esc` a second `Esc` is still ignored (§15.5). */
export const ESCAPE_ZOOM_GRACE_MS = 300;

export function isTimeScope(value: unknown): value is TimeScope {
  return timeScopes.includes(value as TimeScope);
}

export function isWeekLens(value: unknown): value is WeekLens {
  return weekLenses.includes(value as WeekLens);
}

/**
 * Which scopes a member gets, derived from their assignments rather than fixed.
 *
 * Tracked-only and hybrid members get all three: a monthly overview is useful to everyone and
 * costs nothing once built. A **declared-only** member — assignments, none of them tracked here —
 * gets the month alone. A member with no assignments at all is not declared-only; they get the full
 * hierarchy, and the empty state `/time` already shows them.
 *
 * Takes resolved modes, so the precedence between an assignment override and the member default is
 * `resolveTrackingMode`'s business and never re-decided here.
 */
export function resolveScopeStops(
  assignments: readonly { trackingMode: TrackingMode }[],
): readonly TimeScope[] {
  const declaredOnly =
    assignments.length > 0 &&
    assignments.every((assignment) => assignment.trackingMode === "DECLARED");

  return declaredOnly ? declaredOnlyScopes : timeScopes;
}

/**
 * The nearest scope the member actually has.
 *
 * Applied on every read rather than on write, which is what makes a declared-only member land on
 * the month whatever a shared link or a remembered preference says — and what keeps the forced
 * scope out of `localStorage`, so the same browser signed in as someone else is unaffected.
 */
export function clampScope(scope: TimeScope, stops: readonly TimeScope[]): TimeScope {
  return stops.includes(scope) ? scope : (stops[0] ?? defaultScope);
}

/** `in` moves toward the day, `out` toward the month. Clamped at both ends — never wraps. */
export function stepScope(
  scope: TimeScope,
  direction: "in" | "out",
  stops: readonly TimeScope[],
): TimeScope {
  const index = stops.indexOf(scope);

  if (index < 0) return clampScope(scope, stops);

  const nextIndex = Math.min(stops.length - 1, Math.max(0, index + (direction === "in" ? -1 : 1)));

  return stops[nextIndex] ?? scope;
}

/**
 * Where an old `?zoom=` link lands (§3): `day` and `month` are scopes of the same name, `week` is
 * the week's Agenda lens and `grid` its Grid lens. `null` for anything else, including no param.
 */
export function mapLegacyZoom(
  value: string | null | undefined,
): { scope: TimeScope; lens: WeekLens | null } | null {
  switch (value) {
    case "day":
      return { scope: "day", lens: null };
    case "week":
      return { scope: "week", lens: "agenda" };
    case "grid":
      return { scope: "week", lens: "grid" };
    case "month":
      return { scope: "month", lens: null };
    default:
      return null;
  }
}

/**
 * The first of the month a day falls in.
 *
 * **The month comes from `day`, never from `week`.** A week can span two months — the design doc's
 * own example week is Aug 31 - Sep 6, 2026 — so deriving it from the week start would put the whole
 * of that week in August, including the six days of it that are September.
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

/** The ISO date `days` away. Pure string arithmetic over UTC so no host timezone can shift it. */
export function shiftIsoDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return isoDate;

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The Monday of the week a day falls in, which is the `week` param a navigation targets. The
 * server owns the same rule in `getMonday`; this is the client's half, over ISO strings.
 */
export function resolveWeekStartIso(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  const weekday = (date.getUTCDay() + 6) % 7;

  date.setUTCDate(date.getUTCDate() - weekday);

  return date.toISOString().slice(0, 10);
}

/**
 * The month the Month scope shows: the selected day's month when the page loaded it, else the
 * first month it did load.
 *
 * The same shape as {@link resolveSelectedDayIso} and for the same reason — validating against
 * what is actually on the client is what keeps a hand-edited URL, or a `day` left over from
 * another week, from asking the month scope for data that never arrived.
 */
export function resolveSelectedMonthStartIso(
  selectedDayIso: string,
  monthStarts: readonly string[],
): string {
  const derived = resolveMonthStartIso(selectedDayIso);

  return monthStarts.includes(derived) ? derived : (monthStarts[0] ?? derived);
}

/**
 * The selected day: the `?day=` param when it names a day of the visible week, else today when the
 * week contains it, else the week start.
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

export type TimeShortcut =
  | { type: "scope"; scope: TimeScope }
  | { type: "step"; direction: "in" | "out" }
  | { type: "period"; direction: "previous" | "next" }
  | { type: "today" }
  | { type: "lens" }
  | { type: "compose" }
  | { type: "timer" }
  | { type: "help" }
  | { type: "escape" };

/**
 * What a keystroke on `/time` means, or `null` for "leave it alone" (§8).
 *
 * Two rules make the difference between a shortcut and a surprise. Nothing fires while a text
 * input, a textarea or a dialog has the keystroke — someone typing `3h 20m` into a cell is not
 * asking for the grid — and nothing fires with Ctrl / Cmd / Alt held, because those belong to the
 * browser. Shift is allowed through because `+` and `?` need it on most layouts.
 *
 * `J` / `K` are the primary period keys. On the Hungarian QWERTZ layout `[` and `]` are `AltGr+F`
 * and `AltGr+G`, and the Alt rule above swallows them — so for a large share of the people this app
 * is built for the bracket shortcut never fired at all. `J` / `K` are unmodified on every layout and
 * are the Google Calendar / Notion Calendar convention; the brackets stay as aliases.
 *
 * The arrow keys are deliberately not claimed: the grid is a spreadsheet, and arrow-key movement
 * between its cells is the muscle memory anyone filling a week brings to it.
 *
 * `Esc` comes back as `escape` rather than as a step: only the caller knows whether an overlay is
 * open, and it applies the {@link ESCAPE_ZOOM_GRACE_MS} rule.
 */
export function resolveTimeShortcut(
  event: {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    target: EventTarget | null;
  },
  stops: readonly TimeScope[],
): TimeShortcut | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (suppressesTimeShortcut(event.target)) return null;

  const digit = Number.parseInt(event.key, 10);
  const scope = digit >= 1 && digit <= stops.length ? stops[digit - 1] : undefined;
  if (scope) return { type: "scope", scope };

  switch (event.key) {
    case "-":
      return { type: "step", direction: "out" };
    case "+":
      return { type: "step", direction: "in" };
    case "[":
    case "k":
    case "K":
      return { type: "period", direction: "previous" };
    case "]":
    case "j":
    case "J":
      return { type: "period", direction: "next" };
    case "t":
    case "T":
      return { type: "today" };
    case "g":
    case "G":
      return { type: "lens" };
    case "n":
    case "N":
      return { type: "compose" };
    case "s":
    case "S":
      return { type: "timer" };
    case "?":
      return { type: "help" };
    case "Escape":
      return { type: "escape" };
    default:
      return null;
  }
}

/**
 * Anything that owns the keystroke itself: a field being typed into, or an overlay that has taken
 * over the keyboard. A menu and a listbox count — both run their own type-ahead.
 */
export function suppressesTimeShortcut(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName;

  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") return true;
  if (target.isContentEditable) return true;

  return Boolean(target.closest('[role="dialog"], [role="menu"], [role="listbox"]'));
}

/** Whether an overlay that owns the keyboard is open anywhere on the page. */
export function hasOpenOverlay(root: ParentNode = document): boolean {
  return Boolean(
    root.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]'),
  );
}
