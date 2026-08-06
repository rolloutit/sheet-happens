import { describe, expect, it } from "vitest";

import {
  formatCount,
  formatDateLabel,
  formatDateTime,
  formatHours,
  formatHoursWithUnit,
  formatMonthLabel,
  formatMoney,
  formatPeriodRange,
  formatRate,
  formatTimestamp,
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
  it("renders bare hours with up to two decimals", () => {
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

  it("rounds to two decimals rather than exposing float noise", () => {
    expect(formatHoursWithUnit(100, "en")).toBe("1.67 h");
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
