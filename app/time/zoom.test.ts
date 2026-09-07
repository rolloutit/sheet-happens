import { describe, expect, it } from "vitest";

import {
  clampScope,
  declaredOnlyScopes,
  hasOpenOverlay,
  isTimeScope,
  isWeekLens,
  mapLegacyZoom,
  resolveMonthStartIso,
  resolveScopeStops,
  resolveSelectedDayIso,
  resolveSelectedMonthStartIso,
  resolveTimeShortcut,
  resolveWeekStartIso,
  shiftIsoDate,
  shiftMonthStartIso,
  stepScope,
  suppressesTimeShortcut,
  timeScopes,
  type TimeScope,
} from "./zoom";

/** The design doc's own example week, which spans two months: Aug 31 - Sep 6, 2026. */
const days = [
  "2026-08-31",
  "2026-09-01",
  "2026-09-02",
  "2026-09-03",
  "2026-09-04",
  "2026-09-05",
  "2026-09-06",
].map((isoDate) => ({ isoDate }));

function keystroke(
  key: string,
  overrides: Partial<{
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    target: EventTarget | null;
  }> = {},
) {
  return { key, ctrlKey: false, metaKey: false, altKey: false, target: null, ...overrides };
}

describe("timeScopes", () => {
  it("runs zoomed-in to zoomed-out with three stops and no grid", () => {
    expect(timeScopes).toEqual(["day", "week", "month"]);
  });

  it("accepts only its own scopes and lenses", () => {
    expect(isTimeScope("week")).toBe(true);
    expect(isTimeScope("grid")).toBe(false);
    expect(isWeekLens("grid")).toBe(true);
    expect(isWeekLens("week")).toBe(false);
  });
});

describe("resolveScopeStops", () => {
  it("gives a tracked-only member every scope", () => {
    expect(resolveScopeStops([{ trackingMode: "TRACKED" }])).toEqual(timeScopes);
  });

  it("gives a hybrid member every scope", () => {
    expect(resolveScopeStops([{ trackingMode: "TRACKED" }, { trackingMode: "DECLARED" }])).toEqual(
      timeScopes,
    );
  });

  it("collapses a declared-only member to the month", () => {
    expect(resolveScopeStops([{ trackingMode: "DECLARED" }])).toEqual(declaredOnlyScopes);
  });

  it("does not treat a member with no assignments as declared-only", () => {
    expect(resolveScopeStops([])).toEqual(timeScopes);
  });
});

describe("clampScope and stepScope", () => {
  it("leaves a scope the member has alone and forces a declared-only member onto the month", () => {
    expect(clampScope("day", timeScopes)).toBe("day");
    expect(clampScope("day", declaredOnlyScopes)).toBe("month");
  });

  it("steps out toward the month and in toward the day, clamped at both ends", () => {
    expect(stepScope("day", "out", timeScopes)).toBe("week");
    expect(stepScope("week", "out", timeScopes)).toBe("month");
    expect(stepScope("month", "out", timeScopes)).toBe("month");
    expect(stepScope("month", "in", timeScopes)).toBe("week");
    expect(stepScope("day", "in", timeScopes)).toBe("day");
  });

  it("cannot step out of the scopes the member has", () => {
    expect(stepScope("month", "in", declaredOnlyScopes)).toBe("month");
  });
});

describe("mapLegacyZoom", () => {
  it("lands every old link where it used to go", () => {
    expect(mapLegacyZoom("day")).toEqual({ scope: "day", lens: null });
    expect(mapLegacyZoom("week")).toEqual({ scope: "week", lens: "agenda" });
    expect(mapLegacyZoom("grid")).toEqual({ scope: "week", lens: "grid" });
    expect(mapLegacyZoom("month")).toEqual({ scope: "month", lens: null });
  });

  it("ignores anything else", () => {
    expect(mapLegacyZoom(null)).toBeNull();
    expect(mapLegacyZoom("year")).toBeNull();
  });
});

describe("date arithmetic", () => {
  it("takes the month from the day, across a month-spanning week", () => {
    expect(resolveMonthStartIso("2026-08-31")).toBe("2026-08-01");
    expect(resolveMonthStartIso("2026-09-01")).toBe("2026-09-01");
  });

  it("steps a month in either direction and wraps the year", () => {
    expect(shiftMonthStartIso("2026-09-01", 1)).toBe("2026-10-01");
    expect(shiftMonthStartIso("2026-01-01", -1)).toBe("2025-12-01");
    expect(shiftMonthStartIso("2026-12-01", 1)).toBe("2027-01-01");
  });

  it("shifts a day across a month and a year boundary", () => {
    expect(shiftIsoDate("2026-08-31", 1)).toBe("2026-09-01");
    expect(shiftIsoDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftIsoDate("not-a-date", 1)).toBe("not-a-date");
  });

  it("finds the Monday of the week a day falls in", () => {
    expect(resolveWeekStartIso("2026-09-03")).toBe("2026-08-31");
    expect(resolveWeekStartIso("2026-08-31")).toBe("2026-08-31");
    expect(resolveWeekStartIso("2026-09-06")).toBe("2026-08-31");
  });

  it("picks the loaded month the selected day falls in, else the first loaded one", () => {
    expect(resolveSelectedMonthStartIso("2026-09-02", ["2026-08-01", "2026-09-01"])).toBe(
      "2026-09-01",
    );
    expect(resolveSelectedMonthStartIso("2026-10-02", ["2026-08-01", "2026-09-01"])).toBe(
      "2026-08-01",
    );
    expect(resolveSelectedMonthStartIso("2026-10-02", [])).toBe("2026-10-01");
  });
});

describe("resolveSelectedDayIso", () => {
  it("takes the param when it names a day of the visible week", () => {
    expect(resolveSelectedDayIso("2026-09-04", days, "2026-09-02")).toBe("2026-09-04");
  });

  it("falls back to today, then to the week start", () => {
    expect(resolveSelectedDayIso(null, days, "2026-09-02")).toBe("2026-09-02");
    expect(resolveSelectedDayIso(null, days, "2026-10-02")).toBe("2026-08-31");
  });

  it("ignores a day left over from another week", () => {
    expect(resolveSelectedDayIso("2026-09-10", days, "2026-09-02")).toBe("2026-09-02");
  });
});

describe("resolveTimeShortcut", () => {
  const stops: readonly TimeScope[] = timeScopes;

  it("jumps to a scope by number, bounded by the member's stops", () => {
    expect(resolveTimeShortcut(keystroke("1"), stops)).toEqual({ type: "scope", scope: "day" });
    expect(resolveTimeShortcut(keystroke("3"), stops)).toEqual({ type: "scope", scope: "month" });
    expect(resolveTimeShortcut(keystroke("4"), stops)).toBeNull();
    expect(resolveTimeShortcut(keystroke("2"), declaredOnlyScopes)).toBeNull();
  });

  it("steps with − and +", () => {
    expect(resolveTimeShortcut(keystroke("-"), stops)).toEqual({ type: "step", direction: "out" });
    expect(resolveTimeShortcut(keystroke("+"), stops)).toEqual({ type: "step", direction: "in" });
  });

  it("moves the period with J and K, and still with the brackets", () => {
    expect(resolveTimeShortcut(keystroke("k"), stops)).toEqual({
      type: "period",
      direction: "previous",
    });
    expect(resolveTimeShortcut(keystroke("J"), stops)).toEqual({
      type: "period",
      direction: "next",
    });
    expect(resolveTimeShortcut(keystroke("["), stops)).toEqual({
      type: "period",
      direction: "previous",
    });
    expect(resolveTimeShortcut(keystroke("]"), stops)).toEqual({
      type: "period",
      direction: "next",
    });
  });

  it("knows today, the lens, the composer, the timer, the sheet and escape", () => {
    expect(resolveTimeShortcut(keystroke("t"), stops)).toEqual({ type: "today" });
    expect(resolveTimeShortcut(keystroke("G"), stops)).toEqual({ type: "lens" });
    expect(resolveTimeShortcut(keystroke("n"), stops)).toEqual({ type: "compose" });
    expect(resolveTimeShortcut(keystroke("S"), stops)).toEqual({ type: "timer" });
    expect(resolveTimeShortcut(keystroke("?"), stops)).toEqual({ type: "help" });
    expect(resolveTimeShortcut(keystroke("Escape"), stops)).toEqual({ type: "escape" });
  });

  it("leaves the arrow keys to the grids", () => {
    expect(resolveTimeShortcut(keystroke("ArrowLeft"), stops)).toBeNull();
    expect(resolveTimeShortcut(keystroke("ArrowDown"), stops)).toBeNull();
  });

  it("does not fire with a browser modifier held", () => {
    expect(resolveTimeShortcut(keystroke("k", { metaKey: true }), stops)).toBeNull();
    expect(resolveTimeShortcut(keystroke("1", { ctrlKey: true }), stops)).toBeNull();
    expect(resolveTimeShortcut(keystroke("j", { altKey: true }), stops)).toBeNull();
  });

  it("does not fire while a field has the keystroke", () => {
    const input = document.createElement("input");
    expect(resolveTimeShortcut(keystroke("2", { target: input }), stops)).toBeNull();
  });
});

describe("suppressesTimeShortcut and hasOpenOverlay", () => {
  it("yields to text entry and to an open overlay that owns the keyboard", () => {
    const textarea = document.createElement("textarea");
    expect(suppressesTimeShortcut(textarea)).toBe(true);

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const inside = document.createElement("button");
    dialog.append(inside);
    expect(suppressesTimeShortcut(inside)).toBe(true);
  });

  it("leaves an ordinary button alone", () => {
    expect(suppressesTimeShortcut(document.createElement("button"))).toBe(false);
    expect(suppressesTimeShortcut(null)).toBe(false);
  });

  it("sees a dialog anywhere on the page", () => {
    const root = document.createElement("div");
    expect(hasOpenOverlay(root)).toBe(false);

    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    root.append(menu);
    expect(hasOpenOverlay(root)).toBe(true);
  });
});
