import { describe, expect, it } from "vitest";

import { buildHeatWeeks, countWorkdays, heatStep } from "./MonthHeatNavigator.model";

describe("buildHeatWeeks", () => {
  /** September 2026 starts on a Tuesday and ends on a Wednesday: five rows, both ends padded. */
  const weeks = buildHeatWeeks({
    monthStart: "2026-09-01",
    todayIso: "2026-09-16",
    totals: [
      { isoDate: "2026-09-01", minutes: 390, entryCount: 2 },
      { isoDate: "2026-09-02", minutes: 480, entryCount: 1 },
      { isoDate: "2026-09-15", minutes: 120, entryCount: 1 },
    ],
  });

  it("lays the month out Monday-first in rows of seven, padded outside the month", () => {
    expect(weeks).toHaveLength(5);
    expect(weeks[0]?.weekStart).toBe("2026-08-31");
    expect(weeks[0]?.days.map((day) => day.inMonth)).toEqual([
      false,
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(weeks[4]?.days.map((day) => day.inMonth)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it("numbers the weeks by ISO and sums only the days inside the month", () => {
    expect(weeks[0]?.weekNumber).toBe(36);
    expect(weeks[0]?.totalMinutes).toBe(870);
    expect(weeks[2]?.totalMinutes).toBe(120);
  });

  it("marks today, the past and the future, and the weekend", () => {
    const today = weeks[2]?.days.find((day) => day.isoDate === "2026-09-16");
    const yesterday = weeks[2]?.days.find((day) => day.isoDate === "2026-09-15");
    const tomorrow = weeks[2]?.days.find((day) => day.isoDate === "2026-09-17");
    const saturday = weeks[2]?.days.find((day) => day.isoDate === "2026-09-19");

    expect(today?.state).toBe("today");
    expect(yesterday?.state).toBe("past");
    expect(tomorrow?.state).toBe("future");
    expect(saturday?.workday).toBe(false);
    expect(today?.workday).toBe(true);
  });

  it("fills in zero for a day with nothing logged", () => {
    const empty = weeks[1]?.days[0];

    expect(empty).toMatchObject({ isoDate: "2026-09-07", minutes: 0, entryCount: 0 });
  });
});

describe("countWorkdays", () => {
  it("counts the month's Monday-to-Friday days against the ones that hold something", () => {
    const weeks = buildHeatWeeks({
      monthStart: "2026-09-01",
      todayIso: "2026-09-30",
      totals: [
        { isoDate: "2026-09-01", minutes: 60, entryCount: 1 },
        { isoDate: "2026-09-05", minutes: 60, entryCount: 1 }, // a Saturday, not a workday
      ],
    });

    expect(countWorkdays(weeks)).toEqual({ workdays: 22, logged: 1 });
  });
});

describe("heatStep", () => {
  it("has four steps of the 8h target plus nothing", () => {
    expect(heatStep(0, 480)).toBe(0);
    expect(heatStep(60, 480)).toBe(1);
    expect(heatStep(120, 480)).toBe(1);
    expect(heatStep(240, 480)).toBe(2);
    expect(heatStep(300, 480)).toBe(3);
    expect(heatStep(480, 480)).toBe(4);
    expect(heatStep(600, 480)).toBe(4);
  });
});
