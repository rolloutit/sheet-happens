import { describe, expect, it } from "vitest";

import {
  isZoomLevel,
  resolveSelectedDayIso,
  resolveZoomShortcut,
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

function keyEvent(key: string, overrides: Partial<Parameters<typeof resolveZoomShortcut>[0]> = {}) {
  return { key, ctrlKey: false, metaKey: false, altKey: false, target: null, ...overrides };
}

describe("zoomLevels", () => {
  it("runs zoomed-in to zoomed-out", () => {
    expect(zoomLevels).toEqual(["day", "week", "grid"]);
  });

  it("accepts only its own stops", () => {
    expect(isZoomLevel("week")).toBe(true);
    expect(isZoomLevel("month")).toBe(false);
    expect(isZoomLevel(null)).toBe(false);
  });
});

describe("stepZoomLevel", () => {
  it("steps out toward the grid and in toward the day", () => {
    expect(stepZoomLevel("day", "out")).toBe("week");
    expect(stepZoomLevel("week", "out")).toBe("grid");
    expect(stepZoomLevel("grid", "in")).toBe("week");
    expect(stepZoomLevel("week", "in")).toBe("day");
  });

  it("clamps at both ends rather than wrapping", () => {
    expect(stepZoomLevel("day", "in")).toBe("day");
    expect(stepZoomLevel("grid", "out")).toBe("grid");
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
    expect(resolveZoomShortcut(keyEvent("1"))).toEqual({ type: "level", level: "day" });
    expect(resolveZoomShortcut(keyEvent("2"))).toEqual({ type: "level", level: "week" });
    expect(resolveZoomShortcut(keyEvent("3"))).toEqual({ type: "level", level: "grid" });
  });

  it("has no stop for a number the axis does not have yet", () => {
    expect(resolveZoomShortcut(keyEvent("4"))).toBeNull();
    expect(resolveZoomShortcut(keyEvent("0"))).toBeNull();
  });

  it("steps, moves period, and goes to today", () => {
    expect(resolveZoomShortcut(keyEvent("-"))).toEqual({ type: "step", direction: "out" });
    expect(resolveZoomShortcut(keyEvent("+"))).toEqual({ type: "step", direction: "in" });
    expect(resolveZoomShortcut(keyEvent("["))).toEqual({ type: "period", direction: "previous" });
    expect(resolveZoomShortcut(keyEvent("]"))).toEqual({ type: "period", direction: "next" });
    expect(resolveZoomShortcut(keyEvent("t"))).toEqual({ type: "today" });
  });

  it("leaves the arrow keys to the grid", () => {
    expect(resolveZoomShortcut(keyEvent("ArrowRight"))).toBeNull();
    expect(resolveZoomShortcut(keyEvent("ArrowDown"))).toBeNull();
  });

  it("does not fire with a browser modifier held", () => {
    expect(resolveZoomShortcut(keyEvent("t", { metaKey: true }))).toBeNull();
    expect(resolveZoomShortcut(keyEvent("2", { ctrlKey: true }))).toBeNull();
    expect(resolveZoomShortcut(keyEvent("]", { altKey: true }))).toBeNull();
  });

  it("does not fire while a field has the keystroke", () => {
    const input = document.createElement("input");

    expect(resolveZoomShortcut(keyEvent("3", { target: input }))).toBeNull();
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
