import { describe, expect, it } from "vitest";

import {
  getPayslipMonthOptions,
  getPayslipMonthPage,
  getPayslipMonthWindow,
} from "./payslip-month-options";

const NOW = new Date("2026-08-23T12:00:00.000Z");

describe("getPayslipMonthOptions", () => {
  it.each([
    { locale: "en", label: "August 2026", shortLabel: "Aug" },
    { locale: "hu", label: "2026. augusztus", shortLabel: "aug." },
  ])("keeps the year separate from the localized $locale month", (expected) => {
    const [month] = getPayslipMonthOptions(expected.locale, NOW);

    expect(month).toEqual({
      value: "2026-08",
      label: expected.label,
      shortLabel: expected.shortLabel,
      yearLabel: "2026",
    });
  });

  it("rolls back across year boundaries", () => {
    const months = getPayslipMonthOptions("en", NOW);

    expect(months).toHaveLength(24);
    expect(months[7]).toMatchObject({ value: "2026-01", yearLabel: "2026" });
    expect(months[8]).toMatchObject({ value: "2025-12", yearLabel: "2025" });
  });

  it("returns twelve months per page", () => {
    const months = getPayslipMonthWindow("en", "2026-08", 1);

    expect(months).toHaveLength(12);
    expect(months[0]).toMatchObject({ value: "2025-08" });
    expect(months[11]).toMatchObject({ value: "2024-09" });
  });

  it.each([
    ["2026-08", 0],
    ["2025-09", 0],
    ["2025-08", 1],
    ["2024-09", 1],
    ["2024-08", 2],
  ])("places %s on page %i", (targetMonth, expectedPage) => {
    expect(getPayslipMonthPage("2026-08", targetMonth)).toBe(expectedPage);
  });
});
