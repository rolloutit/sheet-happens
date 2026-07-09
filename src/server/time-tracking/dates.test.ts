import { describe, expect, it } from "vitest";

import {
  buildWeekDays,
  formatDateOnly,
  getMonday,
  getMonthStart,
  getMonthStartsInRange,
  getTodayIsoInTimezone,
  getWeekEnd,
  localIntervalToUtc,
  parseDateOnly,
} from "./dates";

describe("time tracking date helpers", () => {
  it("normalizes arbitrary dates to a Monday-starting week", () => {
    const wednesday = parseDateOnly("2026-07-08");
    const monday = getMonday(wednesday);

    expect(formatDateOnly(monday)).toBe("2026-07-06");
    expect(formatDateOnly(getWeekEnd(monday))).toBe("2026-07-12");
  });

  it("collects all month starts touched by a week", () => {
    const months = getMonthStartsInRange(parseDateOnly("2026-07-27"), parseDateOnly("2026-08-02"));

    expect(months.map(formatDateOnly)).toEqual(["2026-07-01", "2026-08-01"]);
  });

  it("marks today, future days, and locked months for grid days", () => {
    const days = buildWeekDays({
      weekStart: parseDateOnly("2026-07-06"),
      todayIso: "2026-07-08",
      lockedMonthStarts: new Set([formatDateOnly(getMonthStart(parseDateOnly("2026-07-06")))]),
    });

    expect(days.map((day) => day.state)).toEqual([
      "normal",
      "normal",
      "today",
      "future",
      "future",
      "future",
      "future",
    ]);
    expect(days.every((day) => day.locked)).toBe(true);
  });

  it("formats today in the member timezone", () => {
    const now = new Date("2026-07-08T22:30:00.000Z");

    expect(getTodayIsoInTimezone("Europe/Budapest", now)).toBe("2026-07-09");
    expect(getTodayIsoInTimezone("America/Los_Angeles", now)).toBe("2026-07-08");
  });

  it("converts local intervals to UTC using the member timezone", () => {
    const interval = localIntervalToUtc({
      localDate: parseDateOnly("2026-07-09"),
      startTime: "09:15",
      endTime: "10:45",
      timezone: "Europe/Budapest",
    });

    expect(interval.startedAt.toISOString()).toBe("2026-07-09T07:15:00.000Z");
    expect(interval.endedAt.toISOString()).toBe("2026-07-09T08:45:00.000Z");
    expect(interval.durationMinutes).toBe(90);
  });

  it("allows overnight local intervals", () => {
    const interval = localIntervalToUtc({
      localDate: parseDateOnly("2026-07-09"),
      startTime: "23:30",
      endTime: "00:15",
      timezone: "Europe/Budapest",
    });

    expect(interval.startedAt.toISOString()).toBe("2026-07-09T21:30:00.000Z");
    expect(interval.endedAt.toISOString()).toBe("2026-07-09T22:15:00.000Z");
    expect(interval.durationMinutes).toBe(45);
  });
});
