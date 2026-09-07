import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { HeatDay, HeatWeek } from "./MonthHeatNavigator.types";
import { buildHeatWeeks, MonthHeatNavigator } from ".";

const weeks = buildHeatWeeks({
  monthStart: "2026-09-01",
  todayIso: "2026-09-16",
  totals: [
    { isoDate: "2026-09-01", minutes: 390, entryCount: 2 },
    { isoDate: "2026-09-15", minutes: 120, entryCount: 1 },
  ],
});

const labels = {
  grid: "Days of September 2026",
  openWeek: (week: HeatWeek) => `Open week ${week.weekNumber}`,
  weekRow: (week: HeatWeek) => `W${week.weekNumber}`,
  cell: (day: HeatDay) => `${day.isoDate}, ${day.minutes / 60} hours`,
  empty: (day: HeatDay) => `${day.isoDate}, nothing logged`,
  future: (day: HeatDay) => `${day.isoDate}, in the future`,
  outside: (day: HeatDay) => `${day.isoDate}, outside this month`,
  detail: (day: HeatDay) => `${day.minutes / 60} h · ${day.entryCount} entries`,
  locked: "Locked",
  legendLogged: "Logged",
  legendEmpty: "Nothing logged",
  legendFuture: "Future",
};

function renderNavigator() {
  const handlers = { onSelectDay: vi.fn(), onSelectWeek: vi.fn() };

  render(
    <MonthHeatNavigator
      weeks={weeks}
      weekdayLabels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}
      selectedWeekStart="2026-09-14"
      selectedDayIso="2026-09-16"
      capacityMinutes={480}
      formatMinutes={(minutes) => `${minutes / 60} h`}
      labels={labels}
      {...handlers}
    />,
  );

  return handlers;
}

describe("MonthHeatNavigator", () => {
  it("is a grid of rows with a week header and a named cell per day of the month", () => {
    renderNavigator();

    const grid = screen.getByRole("grid", { name: "Days of September 2026" });
    expect(within(grid).getAllByRole("row")).toHaveLength(6);
    expect(screen.getByRole("gridcell", { name: "2026-09-01, 6.5 hours" })).toBeInTheDocument();
    expect(
      screen.getByRole("gridcell", { name: "2026-09-02, nothing logged" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: "2026-09-17, in the future" })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: "2026-09-16, nothing logged" })).toHaveAttribute(
      "aria-current",
      "date",
    );
  });

  it("opens a day from a cell and a week from its header", async () => {
    const user = userEvent.setup();
    const handlers = renderNavigator();

    await user.click(screen.getByRole("gridcell", { name: "2026-09-02, nothing logged" }));
    await user.click(screen.getByRole("button", { name: "Open week 38" }));

    expect(handlers.onSelectDay).toHaveBeenCalledWith("2026-09-02");
    expect(handlers.onSelectWeek).toHaveBeenCalledWith("2026-09-14");
  });

  it("moves focus between cells with the arrow keys", async () => {
    const user = userEvent.setup();
    renderNavigator();

    screen.getByRole("gridcell", { name: "2026-09-01, 6.5 hours" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("gridcell", { name: "2026-09-02, nothing logged" })).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("gridcell", { name: "2026-09-09, nothing logged" })).toHaveFocus();
  });

  it("names the days outside the month without making them pressable", () => {
    renderNavigator();

    // August 31 sits in the first row but belongs to another month.
    const outside = screen.getByRole("gridcell", { name: "2026-08-31, outside this month" });
    expect(outside.tagName).toBe("SPAN");
    expect(screen.queryByRole("button", { name: /2026-08-31/ })).not.toBeInTheDocument();
  });
});
