import { describe, expect, it } from "vitest";

import { formatDurationForInput, parseDurationToMinutes } from "./duration";

describe("formatDurationForInput", () => {
  it("produces precise decimal values that parse back to the same minute", () => {
    const value = formatDurationForInput(203, "DECIMAL_HOURS");

    expect(value).toBe("3.38");
    expect(parseDurationToMinutes(value)).toBe(203);
  });

  it("produces locale-neutral colon values that parse back to the same minute", () => {
    const value = formatDurationForInput(203, "HOURS_MINUTES");

    expect(value).toBe("3:23");
    expect(parseDurationToMinutes(value)).toBe(203);
  });

  it("round-trips every minute of a day through both formats", () => {
    for (let minutes = 0; minutes <= 1440; minutes += 1) {
      for (const format of ["DECIMAL_HOURS", "HOURS_MINUTES"] as const) {
        const value = formatDurationForInput(minutes, format);
        expect(parseDurationToMinutes(value)).toBe(minutes);
      }
    }
  });
});

describe("parseDurationToMinutes", () => {
  it.each([
    ["", 0],
    ["   ", 0],
    ["0", 0],
    ["3.5", 210],
    ["3,5", 210],
    [".5", 30],
    [",5", 30],
    ["3:20", 200],
    // The quick composer's shorthand: hours, then bare minutes.
    ["2h30", 150],
    ["2h 30", 150],
    ["1hr5", 65],
    ["2h300", null],
    ["3:5", 185],
    ["03:05", 185],
    ["200m", 200],
    ["200 min", 200],
    ["200 minutes", 200],
    ["3h", 180],
    ["3 hr", 180],
    ["3 hours", 180],
    ["1.5h", 90],
    ["1,5h", 90],
    ["3h 20m", 200],
    ["3h20m", 200],
    ["3 h 20 m", 200],
    ["2 hours 5 minutes", 125],
    ["15m 2h", 135],
  ])("parses %j as %i minutes", (input, expected) => {
    expect(parseDurationToMinutes(input)).toBe(expected);
  });

  it.each([
    "-1",
    "-1h",
    "1h -5m",
    "1.5m",
    "3:60",
    "3:99",
    "3:20:10",
    "3abc",
    "3h abc",
    "hours",
    "m",
    "1d",
    "1,2,3",
    "1..5",
  ])("rejects invalid duration %j", (input) => {
    expect(parseDurationToMinutes(input)).toBeNull();
  });
});
