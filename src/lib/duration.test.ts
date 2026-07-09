import { describe, expect, it } from "vitest";

import { parseDurationToMinutes } from "./duration";

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
