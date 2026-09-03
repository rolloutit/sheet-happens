import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { WeekAgendaDay, WeekAgendaEntry, WeekAgendaLabels } from "./WeekAgenda.types";
import { WeekAgenda } from ".";

const labels: WeekAgendaLabels = {
  openDay: (day) => `Open ${day.label}`,
  expandDay: (day) => `Show ${day.label}`,
  columnEmpty: "Nothing logged",
  addEntry: (day) => `Add entry on ${day.label}`,
  editEntry: (entry) => `Edit ${entry.description}`,
  deleteEntry: (entry) => `Delete ${entry.description}`,
  adminModified: "Changed by an administrator",
};

function entry(overrides: Partial<WeekAgendaEntry> = {}): WeekAgendaEntry {
  return {
    id: "atlas-1",
    projectName: "Atlas Platform",
    projectColor: "#37e3de",
    description: "Invoice reconciliation",
    durationMinutes: 150,
    startTime: null,
    endTime: null,
    locked: false,
    warnings: [],
    adminModified: false,
    ...overrides,
  };
}

const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** The design doc's own example week, which spans two months: Aug 31 - Sep 6, 2026. */
const isoDates = [
  "2026-08-31",
  "2026-09-01",
  "2026-09-02",
  "2026-09-03",
  "2026-09-04",
  "2026-09-05",
  "2026-09-06",
];

function buildDays(entriesByIndex: Record<number, WeekAgendaEntry[]> = {}): WeekAgendaDay[] {
  return isoDates.map((isoDate, index) => {
    const entries = entriesByIndex[index] ?? [];

    return {
      isoDate,
      label: dayNames[index],
      shortLabel: dayNames[index].slice(0, 3),
      dayNumber: String(Number.parseInt(isoDate.slice(8), 10)),
      state: index === 2 ? "today" : index > 2 ? "future" : "normal",
      locked: false,
      totalMinutes: entries.reduce((sum, item) => sum + item.durationMinutes, 0),
      entries,
    };
  });
}

function renderWeek(props: Partial<React.ComponentProps<typeof WeekAgenda>> = {}) {
  const handlers = {
    onSelectDay: vi.fn(),
    onZoomToDay: vi.fn(),
    onAddEntry: vi.fn(),
    onEditEntry: vi.fn(),
    onDeleteEntry: vi.fn(),
  };

  render(
    <WeekAgenda
      days={buildDays({ 2: [entry()] })}
      selectedDayIso="2026-09-02"
      locale="en"
      durationDisplayFormat="DECIMAL_HOURS"
      labels={labels}
      {...handlers}
      {...props}
    />,
  );

  return handlers;
}

/**
 * jsdom loads no stylesheet, so the breakpoint that hides one of the two day headers is not in
 * play and both are in the document. That is what makes each shape separately testable here —
 * `[0]` is the columns header, `[1]` the accordion header.
 */
function dayHeaders(day: string) {
  return within(screen.getByRole("region", { name: day })).getAllByRole("button", {
    name: new RegExp(`(Open|Show) ${day}`),
  });
}

describe("WeekAgenda", () => {
  it("gives every day a region and a heading", () => {
    renderWeek();

    for (const day of dayNames) {
      expect(screen.getByRole("region", { name: day })).toBeInTheDocument();
    }

    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(dayNames.length * 2);
  });

  it("zooms into the day when its column header is pressed", async () => {
    const user = userEvent.setup();
    const { onZoomToDay, onSelectDay } = renderWeek();

    await user.click(dayHeaders("Thursday")[0]);

    expect(onZoomToDay).toHaveBeenCalledWith("2026-09-03");
    expect(onSelectDay).not.toHaveBeenCalled();
  });

  it("opens a collapsed day rather than zooming, in the accordion", async () => {
    const user = userEvent.setup();
    const { onSelectDay, onZoomToDay } = renderWeek();

    const [, accordionHeader] = dayHeaders("Thursday");
    expect(accordionHeader).toHaveAttribute("aria-expanded", "false");

    await user.click(accordionHeader);

    expect(onSelectDay).toHaveBeenCalledWith("2026-09-03");
    expect(onZoomToDay).not.toHaveBeenCalled();
  });

  it("zooms in from the open accordion day", async () => {
    const user = userEvent.setup();
    const { onZoomToDay } = renderWeek();

    const [, accordionHeader] = dayHeaders("Wednesday");
    expect(accordionHeader).toHaveAttribute("aria-expanded", "true");

    await user.click(accordionHeader);

    expect(onZoomToDay).toHaveBeenCalledWith("2026-09-02");
  });

  it("adds an entry to the column it was pressed in", async () => {
    const user = userEvent.setup();
    const { onAddEntry } = renderWeek();

    await user.click(screen.getByRole("button", { name: "Add entry on Friday" }));

    expect(onAddEntry).toHaveBeenCalledWith("2026-09-04");
  });

  it("lists entries per day and says so when a day has none", () => {
    renderWeek();

    const wednesday = within(screen.getByRole("region", { name: "Wednesday" }));
    expect(within(wednesday.getByRole("list")).getAllByRole("listitem")).toHaveLength(1);

    const monday = within(screen.getByRole("region", { name: "Monday" }));
    expect(monday.getByText("Nothing logged")).toBeInTheDocument();
    expect(monday.queryByRole("list")).not.toBeInTheDocument();
  });

  it("reports edit and delete per entry", async () => {
    const user = userEvent.setup();
    const item = entry();
    const { onEditEntry, onDeleteEntry } = renderWeek({ days: buildDays({ 2: [item] }) });

    await user.click(screen.getByRole("button", { name: "Edit Invoice reconciliation" }));
    await user.click(screen.getByRole("button", { name: "Delete Invoice reconciliation" }));

    expect(onEditEntry).toHaveBeenCalledWith(item);
    expect(onDeleteEntry).toHaveBeenCalledWith(item);
  });

  it("offers no edit, delete or add on a locked day", () => {
    renderWeek({
      days: buildDays({ 2: [entry({ locked: true })] }).map((day) => ({ ...day, locked: true })),
    });

    expect(screen.getByRole("button", { name: "Edit Invoice reconciliation" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete Invoice reconciliation" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add entry on Wednesday" })).toBeDisabled();
  });

  it("surfaces a warning and an admin correction on the card", () => {
    renderWeek({
      days: buildDays({
        2: [entry({ warnings: ["Long continuous session"], adminModified: true })],
      }),
    });

    expect(screen.getByRole("img", { name: "Long continuous session" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Changed by an administrator" })).toBeInTheDocument();
  });
});
