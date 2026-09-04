import { describe, expect, it } from "vitest";

import {
  clampZoomLevel,
  declaredOnlyZoomStops,
  isZoomLevel,
  resolveMonthStartIso,
  resolveSelectedDayIso,
  resolveSelectedMonthStartIso,
  resolveWeekStartIso,
  resolveZoomShortcut,
  resolveZoomStops,
  shiftMonthStartIso,
  stepZoomLevel,
  suppressesZoomShortcut,
  zoomLevels,
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

/** The two months that week touches, which is what `/time` ships alongside it. */
const loadedMonths = ["2026-08-01", "2026-09-01"];

function keyEvent(key: string, overrides: Partial<Parameters<typeof resolveZoomShortcut>[0]> = {}) {
  return { key, ctrlKey: false, metaKey: false, altKey: false, target: null, ...overrides };
}

describe("zoomLevels", () => {
  it("runs zoomed-in to zoomed-out", () => {
    expect(zoomLevels).toEqual(["day", "week", "grid", "month"]);
  });

  it("accepts only its own stops", () => {
    expect(isZoomLevel("week")).toBe(true);
    expect(isZoomLevel("month")).toBe(true);
    expect(isZoomLevel("year")).toBe(false);
    expect(isZoomLevel(null)).toBe(false);
  });
});

describe("resolveZoomStops", () => {
  it("gives a tracked-only member every stop", () => {
    expect(resolveZoomStops([{ trackingMode: "TRACKED" }, { trackingMode: "TRACKED" }])).toEqual(
      zoomLevels,
    );
  });

  it("gives a hybrid member every stop", () => {
    expect(resolveZoomStops([{ trackingMode: "TRACKED" }, { trackingMode: "DECLARED" }])).toEqual(
      zoomLevels,
    );
  });

  it("collapses a declared-only member to the month", () => {
    expect(resolveZoomStops([{ trackingMode: "DECLARED" }])).toEqual(declaredOnlyZoomStops);
  });

  it("does not treat a member with no assignments as declared-only", () => {
    expect(resolveZoomStops([])).toEqual(zoomLevels);
  });
});

describe("clampZoomLevel", () => {
  it("leaves a stop the member has alone", () => {
    expect(clampZoomLevel("grid", zoomLevels)).toBe("grid");
  });

  it("forces a declared-only member onto the month whatever the URL says", () => {
    expect(clampZoomLevel("week", declaredOnlyZoomStops)).toBe("month");
    expect(clampZoomLevel("grid", declaredOnlyZoomStops)).toBe("month");
    expect(clampZoomLevel("month", declaredOnlyZoomStops)).toBe("month");
  });
});

describe("stepZoomLevel", () => {
  it("steps out toward the month and in toward the day", () => {
    expect(stepZoomLevel("day", "out", zoomLevels)).toBe("week");
    expect(stepZoomLevel("week", "out", zoomLevels)).toBe("grid");
    expect(stepZoomLevel("grid", "out", zoomLevels)).toBe("month");
    expect(stepZoomLevel("month", "in", zoomLevels)).toBe("grid");
    expect(stepZoomLevel("week", "in", zoomLevels)).toBe("day");
  });

  it("clamps at both ends rather than wrapping", () => {
    expect(stepZoomLevel("day", "in", zoomLevels)).toBe("day");
    expect(stepZoomLevel("month", "out", zoomLevels)).toBe("month");
  });

  it("cannot step out of the stops the member has", () => {
    expect(stepZoomLevel("month", "in", declaredOnlyZoomStops)).toBe("month");
    expect(stepZoomLevel("month", "out", declaredOnlyZoomStops)).toBe("month");
  });
});

/**
 * §11's rule, on the week that makes it matter. Deriving the month from `week` would put all seven
 * of these days in August; six of them are September.
 */
describe("resolveMonthStartIso", () => {
  it("takes the month from the day, across a month-spanning week", () => {
    expect(days.map((day) => resolveMonthStartIso(day.isoDate))).toEqual([
      "2026-08-01",
      "2026-09-01",
      "2026-09-01",
      "2026-09-01",
      "2026-09-01",
      "2026-09-01",
      "2026-09-01",
    ]);
  });

  it("disagrees with the week start for six days of that week", () => {
    const fromWeek = resolveMonthStartIso(days[0].isoDate);

    expect(days.filter((day) => resolveMonthStartIso(day.isoDate) !== fromWeek)).toHaveLength(6);
  });
});

describe("resolveSelectedMonthStartIso", () => {
  it("picks the loaded month the selected day falls in", () => {
    expect(resolveSelectedMonthStartIso("2026-08-31", loadedMonths)).toBe("2026-08-01");
    expect(resolveSelectedMonthStartIso("2026-09-01", loadedMonths)).toBe("2026-09-01");
  });

  it("falls back to the first loaded month when the day's month never arrived", () => {
    expect(resolveSelectedMonthStartIso("2026-11-14", loadedMonths)).toBe("2026-08-01");
  });

  it("derives the month anyway when nothing was loaded", () => {
    expect(resolveSelectedMonthStartIso("2026-11-14", [])).toBe("2026-11-01");
  });
});

describe("shiftMonthStartIso", () => {
  it("steps a month in either direction", () => {
    expect(shiftMonthStartIso("2026-09-01", -1)).toBe("2026-08-01");
    expect(shiftMonthStartIso("2026-09-01", 1)).toBe("2026-10-01");
  });

  it("wraps the year at both ends", () => {
    expect(shiftMonthStartIso("2026-01-01", -1)).toBe("2025-12-01");
    expect(shiftMonthStartIso("2026-12-01", 1)).toBe("2027-01-01");
  });

  it("keeps landing on the first, including into a shorter month", () => {
    expect(shiftMonthStartIso("2026-03-01", -1)).toBe("2026-02-01");
    expect(shiftMonthStartIso("2024-01-01", 1)).toBe("2024-02-01");
  });
});

describe("resolveWeekStartIso", () => {
  it("finds the Monday of the week a day falls in", () => {
    for (const day of days) {
      expect(resolveWeekStartIso(day.isoDate)).toBe("2026-08-31");
    }
  });

  it("puts the 1st of a month in the week that contains it", () => {
    // Sep 1 2026 is a Tuesday, so the month opens mid-week — the case §11's `[` / `]` rule needs.
    expect(resolveWeekStartIso("2026-09-01")).toBe("2026-08-31");
    // Nov 1 2026 is a Sunday, the latest a month can start in its week.
    expect(resolveWeekStartIso("2026-11-01")).toBe("2026-10-26");
    // Jun 1 2026 is itself a Monday.
    expect(resolveWeekStartIso("2026-06-01")).toBe("2026-06-01");
  });
});

describe("resolveSelectedDayIso", () => {
  it("takes the param when it names a day of the visible week", () => {
    expect(resolveSelectedDayIso("2026-09-03", days, "2026-09-02")).toBe("2026-09-03");
  });

  it("falls back to today when the param is absent", () => {
    expect(resolveSelectedDayIso(null, days, "2026-09-02")).toBe("2026-09-02");
  });

  it("falls back to the week start when today is another week", () => {
    expect(resolveSelectedDayIso(null, days, "2026-09-20")).toBe("2026-08-31");
  });

  it("ignores a day left over from another week", () => {
    expect(resolveSelectedDayIso("2026-07-14", days, "2026-09-20")).toBe("2026-08-31");
  });
});

describe("resolveZoomShortcut", () => {
  it("jumps to a stop by number", () => {
    expect(resolveZoomShortcut(keyEvent("1"), zoomLevels)).toEqual({ type: "level", level: "day" });
    expect(resolveZoomShortcut(keyEvent("2"), zoomLevels)).toEqual({
      type: "level",
      level: "week",
    });
    expect(resolveZoomShortcut(keyEvent("3"), zoomLevels)).toEqual({
      type: "level",
      level: "grid",
    });
    expect(resolveZoomShortcut(keyEvent("4"), zoomLevels)).toEqual({
      type: "level",
      level: "month",
    });
  });

  it("has no stop for a number the axis does not have", () => {
    expect(resolveZoomShortcut(keyEvent("5"), zoomLevels)).toBeNull();
    expect(resolveZoomShortcut(keyEvent("0"), zoomLevels)).toBeNull();
  });

  it("offers a declared-only member no level they do not have", () => {
    expect(resolveZoomShortcut(keyEvent("1"), declaredOnlyZoomStops)).toEqual({
      type: "level",
      level: "month",
    });
    expect(resolveZoomShortcut(keyEvent("2"), declaredOnlyZoomStops)).toBeNull();
  });

  it("steps, moves period, and goes to today", () => {
    expect(resolveZoomShortcut(keyEvent("-"), zoomLevels)).toEqual({
      type: "step",
      direction: "out",
    });
    expect(resolveZoomShortcut(keyEvent("+"), zoomLevels)).toEqual({
      type: "step",
      direction: "in",
    });
    expect(resolveZoomShortcut(keyEvent("["), zoomLevels)).toEqual({
      type: "period",
      direction: "previous",
    });
    expect(resolveZoomShortcut(keyEvent("]"), zoomLevels)).toEqual({
      type: "period",
      direction: "next",
    });
    expect(resolveZoomShortcut(keyEvent("t"), zoomLevels)).toEqual({ type: "today" });
  });

  it("leaves the arrow keys to the grid", () => {
    expect(resolveZoomShortcut(keyEvent("ArrowRight"), zoomLevels)).toBeNull();
    expect(resolveZoomShortcut(keyEvent("ArrowDown"), zoomLevels)).toBeNull();
  });

  it("does not fire with a browser modifier held", () => {
    expect(resolveZoomShortcut(keyEvent("t", { metaKey: true }), zoomLevels)).toBeNull();
    expect(resolveZoomShortcut(keyEvent("2", { ctrlKey: true }), zoomLevels)).toBeNull();
    expect(resolveZoomShortcut(keyEvent("]", { altKey: true }), zoomLevels)).toBeNull();
  });

  it("does not fire while a field has the keystroke", () => {
    const input = document.createElement("input");

    expect(resolveZoomShortcut(keyEvent("3", { target: input }), zoomLevels)).toBeNull();
  });
});

describe("suppressesZoomShortcut", () => {
  it("yields to text entry", () => {
    for (const tagName of ["input", "textarea", "select"]) {
      expect(suppressesZoomShortcut(document.createElement(tagName))).toBe(true);
    }
  });

  it("yields to an open overlay that owns the keyboard", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const button = document.createElement("button");
    dialog.append(button);

    expect(suppressesZoomShortcut(button)).toBe(true);
  });

  it("leaves an ordinary button alone", () => {
    expect(suppressesZoomShortcut(document.createElement("button"))).toBe(false);
    expect(suppressesZoomShortcut(null)).toBe(false);
  });
});
