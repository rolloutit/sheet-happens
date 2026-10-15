import { describe, expect, it } from "vitest";

import {
  countLeaveWorkdays,
  eachDateValue,
  isWeekendDateValue,
  leaveRangesOverlap,
} from "./leave-days";

describe("eachDateValue", () => {
  it("lists every day of an inclusive range, across a month boundary", () => {
    expect(eachDateValue("2026-10-30", "2026-11-02")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("is empty for a reversed range", () => {
    expect(eachDateValue("2026-10-02", "2026-10-01")).toEqual([]);
  });
});

describe("isWeekendDateValue", () => {
  it("treats Saturday and Sunday as the weekend", () => {
    expect(isWeekendDateValue("2026-10-09")).toBe(false); // Friday
    expect(isWeekendDateValue("2026-10-10")).toBe(true);
    expect(isWeekendDateValue("2026-10-11")).toBe(true);
    expect(isWeekendDateValue("2026-10-12")).toBe(false);
  });
});

describe("countLeaveWorkdays", () => {
  it("counts Monday to Friday and skips the weekend", () => {
    expect(
      countLeaveWorkdays({ startDate: "2026-10-05", endDate: "2026-10-18", dayPart: "FULL" }),
    ).toEqual({ workdays: 10, skippedHolidays: 0 });
  });

  it("skips a public holiday that falls on a workday and reports it", () => {
    expect(
      countLeaveWorkdays({
        startDate: "2026-10-19",
        endDate: "2026-10-25",
        dayPart: "FULL",
        holidayDates: ["2026-10-23"],
      }),
    ).toEqual({ workdays: 4, skippedHolidays: 1 });
  });

  it("does not report a holiday that falls on a weekend as skipped", () => {
    expect(
      countLeaveWorkdays({
        startDate: "2026-10-26",
        endDate: "2026-11-01",
        dayPart: "FULL",
        holidayDates: new Set(["2026-11-01"]),
      }),
    ).toEqual({ workdays: 5, skippedHolidays: 0 });
  });

  it("counts a half day as 0.5", () => {
    expect(
      countLeaveWorkdays({ startDate: "2026-10-07", endDate: "2026-10-07", dayPart: "MORNING" }),
    ).toEqual({ workdays: 0.5, skippedHolidays: 0 });
  });

  it("is zero for a range that only covers a weekend", () => {
    expect(
      countLeaveWorkdays({ startDate: "2026-10-10", endDate: "2026-10-11", dayPart: "FULL" }),
    ).toEqual({ workdays: 0, skippedHolidays: 0 });
  });
});

describe("leaveRangesOverlap", () => {
  const full = (startDate: string, endDate: string) => ({
    startDate,
    endDate,
    dayPart: "FULL" as const,
  });

  it("detects intersecting and touching ranges", () => {
    expect(
      leaveRangesOverlap(full("2026-10-05", "2026-10-09"), full("2026-10-09", "2026-10-12")),
    ).toBe(true);
    expect(
      leaveRangesOverlap(full("2026-10-05", "2026-10-09"), full("2026-10-10", "2026-10-12")),
    ).toBe(false);
  });

  it("lets a morning and an afternoon share a day", () => {
    const morning = { startDate: "2026-10-07", endDate: "2026-10-07", dayPart: "MORNING" as const };
    const afternoon = { ...morning, dayPart: "AFTERNOON" as const };

    expect(leaveRangesOverlap(morning, afternoon)).toBe(false);
    expect(leaveRangesOverlap(morning, morning)).toBe(true);
    expect(leaveRangesOverlap(morning, full("2026-10-07", "2026-10-07"))).toBe(true);
  });
});
