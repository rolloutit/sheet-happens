import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LazyMotion, domMax } from "motion/react";
import { describe, expect, it, vi } from "vitest";

import type { WeekAgendaDay, WeekAgendaEntry, WeekAgendaLabels } from "./WeekAgenda.types";
import { WeekAgenda } from ".";

const labels: WeekAgendaLabels = {
  openDay: (day) => `Open ${day.label}, ${day.dayNumber}`,
  expandDay: (day) => `Show ${day.label}`,
  capacity: (day) => `${day.totalMinutes / 60} h of 8 h`,
  over: "over 8 h",
  locked: "Locked",
  onLeave: "On leave",
  today: "Today",
  columnEmpty: "Nothing logged",
  copyYesterday: "Copy yesterday",
  addEntry: (day) => `Add entry on ${day.label}`,
  emptyWeekTitle: "Nothing logged this week",
  emptyWeekDescription: "Add an entry, or bring last week over.",
  addEntryPlain: "Add entry",
  duplicateLastWeek: "Duplicate last week",
  card: {
    edit: (entry) => `Edit ${entry.description}`,
    delete: (entry) => `Delete ${entry.description}`,
    continue: (entry) => `Continue ${entry.description}`,
    adminModified: "Changed by an administrator",
    timed: "Tracked with a timer",
    locked: "Locked by a submitted timesheet",
  },
  timer: { live: "Running now", stop: "Stop timer" },
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
    timed: false,
    locked: false,
    adminModified: false,
    warnings: [],
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

function buildDays(
  entriesByIndex: Record<number, WeekAgendaEntry[]> = {},
  overrides: Partial<WeekAgendaDay> = {},
): WeekAgendaDay[] {
  return isoDates.map((isoDate, index) => {
    const entries = entriesByIndex[index] ?? [];

    return {
      isoDate,
      label: dayNames[index],
      shortLabel: dayNames[index].slice(0, 3),
      dayNumber: String(Number.parseInt(isoDate.slice(8), 10)),
      state: index === 2 ? "today" : index > 2 ? "future" : "normal",
      locked: false,
      onLeave: false,
      totalMinutes: entries.reduce((sum, item) => sum + item.durationMinutes, 0),
      entries,
      canCopyPreviousDay: index > 0 && (entriesByIndex[index - 1]?.length ?? 0) > 0,
      ...overrides,
    };
  });
}

type Props = React.ComponentProps<typeof WeekAgenda>;

function renderWeek(props: Partial<Props> = {}) {
  const handlers = {
    onSelectDay: vi.fn(),
    onOpenDay: vi.fn(),
    onAddEntry: vi.fn(),
    onEditEntry: vi.fn(),
    onDeleteEntry: vi.fn(),
    onContinueEntry: vi.fn(),
    onCopyPreviousDay: vi.fn(),
    onDuplicatePreviousWeek: vi.fn(),
  };

  render(
    <WeekAgenda
      days={buildDays({ 2: [entry()] })}
      selectedDayIso="2026-09-02"
      capacityMinutes={480}
      layout="columns"
      locale="en"
      durationDisplayFormat="DECIMAL_HOURS"
      labels={labels}
      {...handlers}
      {...props}
    />,
  );

  return handlers;
}

describe("WeekAgenda", () => {
  it("gives every day a region with one header that says the day, its number and its total", () => {
    renderWeek();

    for (const day of dayNames) {
      expect(screen.getByRole("region", { name: day })).toBeInTheDocument();
    }

    const wednesday = within(screen.getByRole("region", { name: "Wednesday" }));
    const header = wednesday.getByRole("button", { name: "Open Wednesday, 2" });

    expect(header).toHaveTextContent("Wed");
    expect(header).toHaveTextContent("2");
    expect(header).toHaveTextContent("2.5 h");
    expect(header).toHaveAttribute("aria-current", "date");
    expect(wednesday.getAllByRole("heading", { level: 2 })).toHaveLength(1);
  });

  it("opens the day when its column header is pressed", async () => {
    const user = userEvent.setup();
    const handlers = renderWeek();

    await user.click(screen.getByRole("button", { name: "Open Thursday, 3" }));

    expect(handlers.onOpenDay).toHaveBeenCalledWith("2026-09-03");
    expect(handlers.onSelectDay).not.toHaveBeenCalled();
  });

  it("marks a day over its target in words as well as colour", () => {
    renderWeek({ days: buildDays({ 1: [entry({ id: "long", durationMinutes: 600 })] }) });

    const tuesday = within(screen.getByRole("region", { name: "Tuesday" }));
    expect(tuesday.getByRole("img", { name: "over 8 h" })).toBeInTheDocument();
    expect(tuesday.getByRole("button", { name: "Open Tuesday, 1" })).toHaveTextContent("10 h");
  });

  describe("the accordion", () => {
    it("opens a collapsed day rather than zooming, and zooms in from the open one", async () => {
      const user = userEvent.setup();
      const handlers = renderWeek({ layout: "accordion" });

      const thursday = screen.getByRole("button", { name: "Show Thursday" });
      expect(thursday).toHaveAttribute("aria-expanded", "false");
      await user.click(thursday);
      expect(handlers.onSelectDay).toHaveBeenCalledWith("2026-09-03");
      expect(handlers.onOpenDay).not.toHaveBeenCalled();

      const wednesday = screen.getByRole("button", { name: "Open Wednesday, 2" });
      expect(wednesday).toHaveAttribute("aria-expanded", "true");
      await user.click(wednesday);
      expect(handlers.onOpenDay).toHaveBeenCalledWith("2026-09-02");
    });

    it("keeps only the selected day's panel in the document flow", () => {
      renderWeek({ layout: "accordion" });

      // jsdom loads no stylesheet, so the collapse is asserted by the class that carries it.
      const panelOf = (day: string) =>
        within(screen.getByRole("region", { name: day })).getByRole("button", {
          name: `Add entry on ${day}`,
        }).parentElement;

      expect(panelOf("Wednesday")).not.toHaveClass("hidden");
      expect(panelOf("Monday")).toHaveClass("hidden");
    });
  });

  it("adds an entry to the column it was pressed in", async () => {
    const user = userEvent.setup();
    const handlers = renderWeek();

    await user.click(screen.getByRole("button", { name: "Add entry on Friday" }));

    expect(handlers.onAddEntry).toHaveBeenCalledWith("2026-09-04");
  });

  it("lists entries per day and says so once when a day has none", () => {
    renderWeek({ days: buildDays({ 1: [entry({ id: "a" }), entry({ id: "b" })] }) });

    expect(
      within(screen.getByRole("region", { name: "Tuesday" })).getAllByRole("listitem"),
    ).toHaveLength(2);
    expect(
      within(screen.getByRole("region", { name: "Thursday" })).getByText("Nothing logged"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Nothing logged this week")).not.toBeInTheDocument();
  });

  it("reports edit, delete and continue per entry, scoped to its day", async () => {
    const user = userEvent.setup();
    const handlers = renderWeek();
    const wednesday = within(screen.getByRole("region", { name: "Wednesday" }));

    await user.click(wednesday.getByRole("button", { name: "Edit Invoice reconciliation" }));
    await user.click(wednesday.getByRole("button", { name: "Delete Invoice reconciliation" }));
    await user.click(wednesday.getByRole("button", { name: "Continue Invoice reconciliation" }));

    expect(handlers.onEditEntry).toHaveBeenCalledWith(expect.objectContaining({ id: "atlas-1" }));
    expect(handlers.onDeleteEntry).toHaveBeenCalledWith(expect.objectContaining({ id: "atlas-1" }));
    expect(handlers.onContinueEntry).toHaveBeenCalledWith(
      expect.objectContaining({ id: "atlas-1" }),
    );
  });

  it("withholds Continue while a timer is already running", () => {
    renderWeek({ canContinue: false });

    expect(
      screen.queryByRole("button", { name: "Continue Invoice reconciliation" }),
    ).not.toBeInTheDocument();
  });

  it("offers Copy yesterday only on an empty day whose yesterday holds something", async () => {
    const user = userEvent.setup();
    const handlers = renderWeek({ days: buildDays({ 1: [entry()] }) });

    const wednesday = within(screen.getByRole("region", { name: "Wednesday" }));
    await user.click(wednesday.getByRole("button", { name: "Copy yesterday" }));
    expect(handlers.onCopyPreviousDay).toHaveBeenCalledWith("2026-09-02");

    const friday = within(screen.getByRole("region", { name: "Friday" }));
    expect(friday.queryByRole("button", { name: "Copy yesterday" })).not.toBeInTheDocument();
  });

  it("offers no edit, delete or add on a locked day", () => {
    renderWeek({
      days: buildDays({ 2: [entry({ locked: true })] }, { locked: true }),
    });

    const wednesday = within(screen.getByRole("region", { name: "Wednesday" }));
    expect(wednesday.getByRole("button", { name: "Edit Invoice reconciliation" })).toBeDisabled();
    expect(wednesday.getByRole("button", { name: "Delete Invoice reconciliation" })).toBeDisabled();
    expect(
      wednesday.queryByRole("button", { name: "Add entry on Wednesday" }),
    ).not.toBeInTheDocument();
  });

  it("marks a leave day and offers no add or copy on it", () => {
    renderWeek({
      days: buildDays({ 1: [entry()] }).map((day, index) =>
        index === 2 ? { ...day, onLeave: true } : day,
      ),
    });

    const wednesday = within(screen.getByRole("region", { name: "Wednesday" }));
    expect(wednesday.getByRole("img", { name: "On leave" })).toBeInTheDocument();
    expect(
      wednesday.queryByRole("button", { name: "Add entry on Wednesday" }),
    ).not.toBeInTheDocument();
    expect(wednesday.queryByRole("button", { name: "Copy yesterday" })).not.toBeInTheDocument();

    const thursday = within(screen.getByRole("region", { name: "Thursday" }));
    expect(thursday.getByRole("button", { name: "Add entry on Thursday" })).toBeInTheDocument();
  });

  it("surfaces a warning, a timer glyph and an admin correction on the card", () => {
    renderWeek({
      days: buildDays({
        2: [entry({ warnings: ["Long continuous session"], adminModified: true, timed: true })],
      }),
    });

    const wednesday = within(screen.getByRole("region", { name: "Wednesday" }));
    expect(wednesday.getByRole("img", { name: "Long continuous session" })).toBeInTheDocument();
    expect(wednesday.getByRole("img", { name: "Changed by an administrator" })).toBeInTheDocument();
    expect(wednesday.getByRole("img", { name: "Tracked with a timer" })).toBeInTheDocument();
  });

  it("shows the empty week once, in the middle, with its two actions", async () => {
    const user = userEvent.setup();
    const handlers = renderWeek({ days: buildDays(), canDuplicatePreviousWeek: true });

    expect(screen.getByText("Nothing logged this week")).toBeInTheDocument();
    expect(screen.queryByText("Nothing logged")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Duplicate last week" }));
    expect(handlers.onDuplicatePreviousWeek).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Add entry" }));
    expect(handlers.onAddEntry).toHaveBeenCalledWith("2026-09-02");
    // Every column still has its own `+`, so the structural contract holds on an empty week too.
    expect(screen.getByRole("button", { name: "Add entry on Sunday" })).toBeInTheDocument();
  });

  it("puts the running timer at the top of today's column", () => {
    renderWeek({
      runningTimer: {
        projectName: "Atlas Platform",
        projectColor: "#37e3de",
        description: "Sprint planning",
        elapsedLabel: "0:42:13",
      },
      onStopTimer: vi.fn(),
    });

    const wednesday = within(screen.getByRole("region", { name: "Wednesday" }));
    expect(wednesday.getByRole("status")).toHaveTextContent("0:42:13");
    expect(wednesday.getByRole("button", { name: "Stop timer" })).toBeInTheDocument();
  });

  /**
   * The scope animates on `/time` and nowhere else, so the component has to be legible in both
   * worlds: wrapped in the `LazyMotion` boundary that `TimeZoomShell` puts around it, and bare —
   * which is how Storybook, the visual baselines and every test above render it. `m` components
   * degrade to plain DOM with no feature bundle in scope, so the same tree comes out either way.
   */
  describe("with and without the motion feature bundle", () => {
    it("renders the same week bare as it does inside LazyMotion", () => {
      const days = buildDays({ 1: [entry({ id: "a" })], 2: [entry({ id: "b" })] });
      const props = {
        days,
        selectedDayIso: "2026-09-02",
        capacityMinutes: 480,
        layout: "columns",
        locale: "en",
        durationDisplayFormat: "DECIMAL_HOURS",
        labels,
        onSelectDay: vi.fn(),
        onOpenDay: vi.fn(),
        onAddEntry: vi.fn(),
        onEditEntry: vi.fn(),
        onDeleteEntry: vi.fn(),
      } satisfies Props;

      const bare = render(<WeekAgenda {...props} />);
      const bareRegions = screen.getAllByRole("region").length;
      const bareItems = screen.getAllByRole("listitem").length;
      bare.unmount();

      render(
        <LazyMotion features={domMax}>
          <WeekAgenda {...props} />
        </LazyMotion>,
      );

      expect(screen.getAllByRole("region")).toHaveLength(bareRegions);
      expect(screen.getAllByRole("listitem")).toHaveLength(bareItems);
    });

    it("still lists every entry when the cards animate in", () => {
      render(
        <LazyMotion features={domMax}>
          <WeekAgenda
            days={buildDays({ 2: Array.from({ length: 12 }, (_, i) => entry({ id: `e${i}` })) })}
            selectedDayIso="2026-09-02"
            capacityMinutes={480}
            layout="columns"
            locale="en"
            durationDisplayFormat="DECIMAL_HOURS"
            labels={labels}
            animateEntries
            onSelectDay={vi.fn()}
            onOpenDay={vi.fn()}
            onAddEntry={vi.fn()}
            onEditEntry={vi.fn()}
            onDeleteEntry={vi.fn()}
          />
        </LazyMotion>,
      );

      const wednesday = within(screen.getByRole("region", { name: "Wednesday" }));

      // Every card is in the tree from the first frame; the stagger is a delay, not a gate.
      expect(within(wednesday.getByRole("list")).getAllByRole("listitem")).toHaveLength(12);
    });
  });
});
