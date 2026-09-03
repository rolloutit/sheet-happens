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

/**
 * Ordered zoomed-in → zoomed-out, which is the order the `SegmentedControl` renders, the order the
 * number keys select, and the direction `-` / `+` step. `month` joins the end of this list with the
 * month level; nothing else has to change when it does.
 */
export const zoomLevels = ["day", "week", "grid"] as const;

export type ZoomLevel = (typeof zoomLevels)[number];

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

/** `in` moves toward the day, `out` toward the grid. Clamped at both ends — never wraps. */
export function stepZoomLevel(level: ZoomLevel, direction: "in" | "out"): ZoomLevel {
  const index = zoomLevels.indexOf(level);
  const nextIndex = Math.min(
    zoomLevels.length - 1,
    Math.max(0, index + (direction === "in" ? -1 : 1)),
  );

  return zoomLevels[nextIndex];
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
 */
export function resolveZoomShortcut(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
}): ZoomShortcut | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (suppressesZoomShortcut(event.target)) return null;

  const digit = Number.parseInt(event.key, 10);
  if (digit >= 1 && digit <= zoomLevels.length)
    return { type: "level", level: zoomLevels[digit - 1] };

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
