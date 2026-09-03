import { describe, expect, it } from "vitest";

import {
  formatCount,
  formatDateLabel,
  formatDateTime,
  formatDecimalHours,
  formatHours,
  formatHoursWithUnit,
  formatList,
  formatMonthLabel,
  formatMonthName,
  formatMoney,
  formatPeriodRange,
  formatRate,
  formatTimestamp,
  formatWeekdayLabel,
} from "./index";

/**
 * The expected strings below were captured from the pre-refactor implementations
 * (`report-pdf.ts`, `app/admin/reports/page.tsx`, `app/admin/timesheets/formatting.ts`,
 * `app/timesheets/page.tsx`) so this module is a behaviour-preserving replacement.
 *
 * ICU separates grouped digits and currency codes with a no-break space, spelled out here
 * so the expectations are not two invisible characters apart from what they assert.
 */
const NBSP = " ";

describe("formatHours", () => {
  it("renders bare decimal hours capped at two decimals", () => {
    expect(formatHours(180, "en")).toBe("3");
    expect(formatHours(150, "en")).toBe("2.5");
    expect(formatHours(150, "hu")).toBe("2,5");
    expect(formatHours(0, "en")).toBe("0");
  });

  it("drops decimals for whole hours only in the unit variant", () => {
    expect(formatHoursWithUnit(180, "en")).toBe("3 h");
    expect(formatHoursWithUnit(150, "en")).toBe("2.5 h");
    expect(formatHoursWithUnit(150, "hu")).toBe("2,5 h");
    expect(formatHoursWithUnit(0, "en")).toBe("0 h");
  });

  it("caps at two decimals — no sub-minute-resolution digits", () => {
    expect(formatHoursWithUnit(100, "en")).toBe("1.67 h");
    expect(formatHoursWithUnit(203, "en")).toBe("3.38 h");
  });

  it("renders locale-neutral colon durations for the hour-minute preference", () => {
    expect(formatHoursWithUnit(203, "en", "HOURS_MINUTES")).toBe("3:23");
    expect(formatHoursWithUnit(203, "hu", "HOURS_MINUTES")).toBe("3:23");
    expect(formatHours(45, "en", "HOURS_MINUTES")).toBe("0:45");
    expect(formatHours(180, "hu", "HOURS_MINUTES")).toBe("3:00");
    expect(formatHours(0, "en", "HOURS_MINUTES")).toBe("0:00");
  });
});

describe("formatDecimalHours", () => {
  it("always renders decimal at a pinned two fraction digits, regardless of preference", () => {
    expect(formatDecimalHours(180, "en")).toBe("3.00 h");
    expect(formatDecimalHours(203, "en")).toBe("3.38 h");
    expect(formatDecimalHours(0, "en")).toBe("0.00 h");
    expect(formatDecimalHours(150, "hu")).toBe("2,50 h");
  });

  it("rounds at display, not in the data — a total need not equal its parts summed", () => {
    // Two 55-minute entries: each displays as 0.92 h, but the true total (110 min) is 1.83 h,
    // not 1.84 h. This is the same behaviour every major time tracker ships (Toggl, Clockify,
    // Harvest) — totals are computed from the underlying minutes and rounded once, never by
    // summing already-rounded display strings.
    const partA = formatDecimalHours(55, "en");
    const partB = formatDecimalHours(55, "en");
    const total = formatDecimalHours(55 + 55, "en");

    expect(partA).toBe("0.92 h");
    expect(partB).toBe("0.92 h");
    expect(total).toBe("1.83 h");
  });
});

describe("formatCount", () => {
  it("groups thousands per locale", () => {
    expect(formatCount(1, "en")).toBe("1");
    expect(formatCount(1234, "en")).toBe("1,234");
    // Hungarian needs two grouping digits, so four-digit counts stay unbroken.
    expect(formatCount(1234, "hu")).toBe("1234");
    expect(formatCount(12345, "hu")).toBe(`12${NBSP}345`);
  });
});

describe("formatMoney", () => {
  it("defaults to the locale currency symbol", () => {
    expect(formatMoney("300.00", "EUR", "en")).toBe("€300.00");
    // Hungarian spells EUR out even in symbol mode.
    expect(formatMoney("300.00", "EUR", "hu")).toBe(`300,00${NBSP}EUR`);
  });

  it("spells out the code when asked", () => {
    expect(formatMoney("300.00", "EUR", "en", { display: "code" })).toBe(`EUR${NBSP}300.00`);
    // HUF carries no minor unit, so it renders without decimals.
    expect(formatMoney("300.00", "HUF", "hu", { display: "code" })).toBe(`300${NBSP}HUF`);
  });

  it("formats rates with the code and an hourly suffix", () => {
    expect(formatRate("100.00", "EUR", "en")).toBe("100 EUR/h");
    expect(formatRate("100.50", "EUR", "hu")).toBe("100,5 EUR/h");
  });
});

describe("formatDateLabel", () => {
  it("renders a medium calendar date", () => {
    expect(formatDateLabel("2026-07-12", "en")).toBe("Jul 12, 2026");
    expect(formatDateLabel("2026-07-12", "hu")).toBe("2026. júl. 12.");
  });

  it("omits the year in short style", () => {
    expect(formatDateLabel("2026-07-12", "en", { style: "short" })).toBe("Jul 12");
  });

  it("names the weekday in full style, for calendar day buttons", () => {
    expect(formatDateLabel("2026-07-12", "en", { style: "full" })).toBe("Sunday, July 12, 2026");
    expect(formatDateLabel("2026-07-12", "hu", { style: "full" })).toBe(
      "2026. július 12., vasárnap",
    );
  });

  it("pins UTC so a date-only value never shifts a day", () => {
    // Without the pin this renders Dec 31, 2025 on any host west of UTC.
    expect(formatDateLabel("2026-01-01", "en")).toBe("Jan 1, 2026");
  });

  it("renders a period range", () => {
    expect(formatPeriodRange("2026-07-01", "2026-07-31", "en")).toBe("Jul 1, 2026 - Jul 31, 2026");
    expect(formatPeriodRange("2026-07-01", "2026-07-31", "hu")).toBe(
      "2026. júl. 1. - 2026. júl. 31.",
    );
  });

  it("renders a month label", () => {
    expect(formatMonthLabel("2026-07-01", "en")).toBe("July 2026");
    expect(formatMonthLabel("2026-07-01", "hu")).toBe("2026. július");
  });
});

describe("calendar chrome", () => {
  /** Monday 2026-06-22 through Sunday 2026-06-28 — the calendar grid is Monday-first. */
  const week = [
    "2026-06-22",
    "2026-06-23",
    "2026-06-24",
    "2026-06-25",
    "2026-06-26",
    "2026-06-27",
    "2026-06-28",
  ];

  it("renders unique weekday abbreviations in both locales", () => {
    expect(week.map((day) => formatWeekdayLabel(day, "en"))).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
    expect(week.map((day) => formatWeekdayLabel(day, "hu"))).toEqual([
      "H",
      "K",
      "Sze",
      "Cs",
      "P",
      "Szo",
      "V",
    ]);
  });

  /**
   * The calendar header uses `short`, not `narrow`, because Hungarian narrow collapses both
   * Szerda and Szombat to `Sz` — two identical column headers in a seven-column grid.
   */
  it("keeps narrow weekdays out of the header by documenting the collision", () => {
    const narrow = week.map((day) => formatWeekdayLabel(day, "hu", { style: "narrow" }));

    expect(new Set(narrow).size).toBeLessThan(narrow.length);
    expect(new Set(week.map((day) => formatWeekdayLabel(day, "hu"))).size).toBe(7);
  });

  it("renders a bare month name without the year", () => {
    expect(formatMonthName("2026-07-01", "en")).toBe("Jul");
    expect(formatMonthName("2026-07-01", "hu")).toBe("júl.");
    expect(formatMonthName("2026-07-01", "en", { style: "long" })).toBe("July");
    expect(formatMonthName("2026-07-01", "hu", { style: "long" })).toBe("július");
  });
});

describe("instants", () => {
  it("renders an explicit zero-padded date-time", () => {
    expect(formatDateTime(new Date("2026-07-31T12:00:00.000Z"), "en", { timeZone: "UTC" })).toBe(
      "Jul 31, 2026, 12:00 PM",
    );
    expect(formatDateTime("2026-07-31T12:00:00.000Z", "hu", { timeZone: "UTC" })).toBe(
      "2026. júl. 31. 12:00",
    );
  });

  it("renders the Budapest wall clock when asked", () => {
    expect(
      formatDateTime(new Date("2026-07-31T12:00:00.000Z"), "en", { timeZone: "Europe/Budapest" }),
    ).toBe("Jul 31, 2026, 02:00 PM");
  });

  it("renders a styled timestamp and a placeholder when absent", () => {
    expect(formatTimestamp("2026-07-31T12:00:00.000Z", "en", { timeZone: "UTC" })).toBe(
      "Jul 31, 2026, 12:00 PM",
    );
    expect(formatTimestamp(null, "en")).toBe("-");
  });
});

describe("formatList", () => {
  it("names several values with the locale's own last separator", () => {
    expect(formatList(["Apollo", "Helix", "Internal"], "en")).toBe("Apollo, Helix, and Internal");
    expect(formatList(["Apollo", "Helix", "Belső"], "hu")).toBe("Apollo, Helix és Belső");
  });

  it("names a single value with no separator at all", () => {
    expect(formatList(["Apollo"], "en")).toBe("Apollo");
    expect(formatList(["Apollo"], "hu")).toBe("Apollo");
  });

  it("returns nothing for an empty list, so the caller can fall back", () => {
    expect(formatList([], "en")).toBe("");
  });
});
