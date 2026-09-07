import { describe, expect, it } from "vitest";

import {
  addUtcDays,
  addUtcMonths,
  clampDateValue,
  compareDateValues,
  dateValueToMonthValue,
  isDateValue,
  isMonthValue,
  isoWeekNumber,
  monthValueToDateValue,
  parseDateValue,
  startOfUtcDay,
  startOfUtcMonth,
  todayDateValue,
  toDateValue,
  toMonthValue,
} from "./date-values";

describe("isDateValue", () => {
  it("accepts real calendar dates", () => {
    expect(isDateValue("2026-06-24")).toBe(true);
    expect(isDateValue("2024-02-29")).toBe(true);
  });

  it("rejects dates that pass the shape but not the calendar", () => {
    expect(isDateValue("2026-02-30")).toBe(false);
    expect(isDateValue("2026-13-01")).toBe(false);
    expect(isDateValue("2025-02-29")).toBe(false);
  });

  it("rejects anything that is not zero-padded YYYY-MM-DD", () => {
    expect(isDateValue("")).toBe(false);
    expect(isDateValue("2026-3-5")).toBe(false);
    expect(isDateValue("2026-06-24T00:00:00Z")).toBe(false);
    expect(isDateValue("24/06/2026")).toBe(false);
  });
});

describe("isMonthValue", () => {
  it("accepts YYYY-MM with a real month", () => {
    expect(isMonthValue("2026-01")).toBe(true);
    expect(isMonthValue("2026-12")).toBe(true);
  });

  it("rejects out-of-range months and wrong shapes", () => {
    expect(isMonthValue("2026-00")).toBe(false);
    expect(isMonthValue("2026-13")).toBe(false);
    expect(isMonthValue("2026-6")).toBe(false);
    expect(isMonthValue("2026-06-01")).toBe(false);
    expect(isMonthValue("")).toBe(false);
  });
});

describe("parseDateValue", () => {
  it("returns a UTC-midnight Date", () => {
    const parsed = parseDateValue("2026-06-24");

    expect(parsed?.toISOString()).toBe("2026-06-24T00:00:00.000Z");
  });

  it("returns undefined rather than throwing on bad input", () => {
    expect(parseDateValue("2026-02-30")).toBeUndefined();
    expect(parseDateValue("")).toBeUndefined();
  });
});

describe("toDateValue", () => {
  it("round-trips through parseDateValue", () => {
    expect(toDateValue(parseDateValue("2026-06-24")!)).toBe("2026-06-24");
  });

  /**
   * The pickers hand these strings straight into Zod schemas that compare them as raw
   * strings (`validTo <= validFrom`), so a single-digit month would sort wrong.
   */
  it("zero-pads every field", () => {
    expect(toDateValue(new Date(Date.UTC(2026, 2, 5)))).toBe("2026-03-05");
    expect(toDateValue(new Date(Date.UTC(999, 0, 1)))).toBe("0999-01-01");
  });

  it("reads the UTC calendar day, not the host's", () => {
    // 00:30 UTC is still the previous evening in any zone west of UTC.
    expect(toDateValue(new Date("2026-06-24T00:30:00.000Z"))).toBe("2026-06-24");
  });
});

describe("toMonthValue and the month/date widening pair", () => {
  it("narrows a Date to YYYY-MM", () => {
    expect(toMonthValue(new Date(Date.UTC(2026, 5, 24)))).toBe("2026-06");
  });

  it("widens and narrows between the two wire formats", () => {
    expect(monthValueToDateValue("2026-06")).toBe("2026-06-01");
    expect(dateValueToMonthValue("2026-06-24")).toBe("2026-06");
  });
});

describe("UTC arithmetic", () => {
  it("truncates to midnight", () => {
    expect(toDateValue(startOfUtcDay(new Date("2026-06-24T13:45:12.000Z")))).toBe("2026-06-24");
    expect(startOfUtcDay(new Date("2026-06-24T13:45:12.000Z")).toISOString()).toBe(
      "2026-06-24T00:00:00.000Z",
    );
  });

  it("truncates to the first of the month", () => {
    expect(toDateValue(startOfUtcMonth(parseDateValue("2026-06-24")!))).toBe("2026-06-01");
  });

  it("adds days across month and year boundaries", () => {
    expect(toDateValue(addUtcDays(parseDateValue("2026-06-30")!, 1))).toBe("2026-07-01");
    expect(toDateValue(addUtcDays(parseDateValue("2026-01-01")!, -1))).toBe("2025-12-31");
  });

  it("adds days across a DST transition without drifting", () => {
    // Europe/Budapest springs forward on 2026-03-29; UTC arithmetic must not notice.
    expect(toDateValue(addUtcDays(parseDateValue("2026-03-28")!, 1))).toBe("2026-03-29");
    expect(toDateValue(addUtcDays(parseDateValue("2026-03-29")!, 1))).toBe("2026-03-30");
  });

  it("clamps the day when adding months", () => {
    expect(toDateValue(addUtcMonths(parseDateValue("2026-01-31")!, 1))).toBe("2026-02-28");
    expect(toDateValue(addUtcMonths(parseDateValue("2024-01-31")!, 1))).toBe("2024-02-29");
    expect(toDateValue(addUtcMonths(parseDateValue("2026-03-15")!, -1))).toBe("2026-02-15");
    expect(toDateValue(addUtcMonths(parseDateValue("2026-12-15")!, 1))).toBe("2027-01-15");
  });
});

describe("todayDateValue", () => {
  it("reads the calendar day in the requested zone", () => {
    // 23:30 UTC is already the next day in Budapest (UTC+2 in June).
    const instant = new Date("2026-06-24T23:30:00.000Z");

    expect(todayDateValue("UTC", instant)).toBe("2026-06-24");
    expect(todayDateValue("Europe/Budapest", instant)).toBe("2026-06-25");
    expect(todayDateValue("America/Los_Angeles", instant)).toBe("2026-06-24");
  });

  it("zero-pads single-digit months and days", () => {
    expect(todayDateValue("UTC", new Date("2026-03-05T12:00:00.000Z"))).toBe("2026-03-05");
  });
});

describe("compareDateValues", () => {
  it("orders chronologically", () => {
    expect(compareDateValues("2026-06-24", "2026-06-25")).toBe(-1);
    expect(compareDateValues("2026-06-25", "2026-06-24")).toBe(1);
    expect(compareDateValues("2026-06-24", "2026-06-24")).toBe(0);
  });

  it("sorts a list the same way the dates do", () => {
    const values = ["2026-12-01", "2025-01-31", "2026-01-02", "2026-01-10"];

    expect([...values].sort(compareDateValues)).toEqual([
      "2025-01-31",
      "2026-01-02",
      "2026-01-10",
      "2026-12-01",
    ]);
  });
});

describe("clampDateValue", () => {
  it("pulls values inside an inclusive window", () => {
    expect(clampDateValue("2026-06-01", "2026-06-10", "2026-06-20")).toBe("2026-06-10");
    expect(clampDateValue("2026-06-30", "2026-06-10", "2026-06-20")).toBe("2026-06-20");
    expect(clampDateValue("2026-06-15", "2026-06-10", "2026-06-20")).toBe("2026-06-15");
  });

  it("treats the bounds as inclusive", () => {
    expect(clampDateValue("2026-06-10", "2026-06-10", "2026-06-20")).toBe("2026-06-10");
    expect(clampDateValue("2026-06-20", "2026-06-10", "2026-06-20")).toBe("2026-06-20");
  });

  it("ignores omitted bounds", () => {
    expect(clampDateValue("2026-06-01", undefined, "2026-06-20")).toBe("2026-06-01");
    expect(clampDateValue("2026-06-30", "2026-06-10", undefined)).toBe("2026-06-30");
    expect(clampDateValue("2026-06-30")).toBe("2026-06-30");
  });
});

describe("isoWeekNumber", () => {
  it("counts the design doc's example week as ISO week 36", () => {
    expect(isoWeekNumber("2026-08-31")).toBe(36);
    expect(isoWeekNumber("2026-09-06")).toBe(36);
  });

  it("puts the first days of a year in the previous year's last week when ISO says so", () => {
    // 2027-01-01 is a Friday: it belongs to week 53 of 2026.
    expect(isoWeekNumber("2027-01-01")).toBe(53);
    expect(isoWeekNumber("2027-01-04")).toBe(1);
  });

  it("starts week 1 on the Monday of the week holding January 4th", () => {
    expect(isoWeekNumber("2025-12-29")).toBe(1);
    expect(isoWeekNumber("2026-01-04")).toBe(1);
    expect(isoWeekNumber("2026-01-05")).toBe(2);
  });
});
