import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { WeekAgenda } from ".";
import type { WeekAgendaDay, WeekAgendaEntry, WeekAgendaLabels } from "./WeekAgenda.types";

const projects = [
  { name: "Atlas Platform", color: "#37e3de" },
  { name: "Internal Ops", color: "#72df9a" },
  { name: "Nimbus", color: "#f2b8ff" },
];

function entry(
  id: string,
  projectIndex: number,
  overrides: Partial<WeekAgendaEntry> = {},
): WeekAgendaEntry {
  const project = projects[projectIndex % projects.length];

  return {
    id,
    projectName: project.name,
    projectColor: project.color,
    description: "Invoice reconciliation and import test",
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

/** The design doc's own example week, which spans two months: Aug 31 - Sep 6, 2026. */
const weekDates = [
  { isoDate: "2026-08-31", label: "Monday" },
  { isoDate: "2026-09-01", label: "Tuesday" },
  { isoDate: "2026-09-02", label: "Wednesday" },
  { isoDate: "2026-09-03", label: "Thursday" },
  { isoDate: "2026-09-04", label: "Friday" },
  { isoDate: "2026-09-05", label: "Saturday" },
  { isoDate: "2026-09-06", label: "Sunday" },
] as const;

function buildWeek(entriesPerDay: (dayIndex: number) => WeekAgendaEntry[]): WeekAgendaDay[] {
  return weekDates.map(({ isoDate, label }, dayIndex) => {
    const entries = entriesPerDay(dayIndex);

    return {
      isoDate,
      label,
      shortLabel: label.slice(0, 3),
      dayNumber: String(Number.parseInt(isoDate.slice(8), 10)),
      state: dayIndex === 2 ? "today" : dayIndex > 2 ? "future" : "normal",
      locked: false,
      totalMinutes: entries.reduce((sum, item) => sum + item.durationMinutes, 0),
      entries,
      canCopyPreviousDay: dayIndex > 0 && entriesPerDay(dayIndex - 1).length > 0,
    };
  });
}

const typicalWeek = buildWeek((dayIndex) => {
  if (dayIndex > 4) return [];
  if (dayIndex === 1) {
    return [
      entry(`d${dayIndex}-1`, 0, { startTime: "09:00", endTime: "11:30", timed: true }),
      entry(`d${dayIndex}-2`, 2, {
        description: "Rate table migration",
        durationMinutes: 330,
        warnings: ["Long continuous session"],
      }),
    ];
  }

  return [
    entry(`d${dayIndex}-1`, dayIndex, { durationMinutes: 480, adminModified: dayIndex === 0 }),
  ];
});

const denseWeek = buildWeek((dayIndex) =>
  dayIndex > 4
    ? []
    : Array.from({ length: 5 }, (_, index) =>
        entry(`d${dayIndex}-${index}`, index, {
          description: [
            "Sprint planning",
            "API endpoint implementation",
            "Code review",
            "Dev tooling improvements",
            "Database migration work",
          ][index],
          durationMinutes: 90,
        }),
      ),
);

const labels: WeekAgendaLabels = {
  openDay: (day) => `Open ${day.label}, ${day.dayNumber}`,
  expandDay: (day) => `Show ${day.label}`,
  capacity: (day) => `${day.totalMinutes / 60} h of 8 h`,
  over: "over 8 h",
  locked: "Locked by a submitted timesheet",
  today: "Today",
  columnEmpty: "Nothing logged",
  copyYesterday: "Copy yesterday",
  addEntry: (day) => `Add entry on ${day.label}`,
  emptyWeekTitle: "Nothing logged this week",
  emptyWeekDescription: "Add an entry, or bring last week's entries over.",
  addEntryPlain: "Add entry",
  duplicateLastWeek: "Duplicate last week",
  card: {
    edit: (item) => `Edit ${item.description}`,
    delete: (item) => `Delete ${item.description}`,
    continue: (item) => `Continue ${item.description}`,
    adminModified: "Changed by an administrator",
    timed: "Tracked with a timer",
    locked: "Locked by a submitted timesheet",
  },
  timer: { live: "Running now", stop: "Stop timer" },
};

const meta = {
  title: "Sheet/WeekAgenda",
  component: WeekAgenda,
  parameters: {
    layout: "padded",
  },
  args: {
    days: typicalWeek,
    selectedDayIso: "2026-09-02",
    capacityMinutes: 480,
    layout: "columns",
    locale: "en",
    durationDisplayFormat: "DECIMAL_HOURS",
    labels,
    canDuplicatePreviousWeek: true,
    onSelectDay: fn(),
    onOpenDay: fn(),
    onAddEntry: fn(),
    onEditEntry: fn(),
    onDeleteEntry: fn(),
    onContinueEntry: fn(),
    onCopyPreviousDay: fn(),
    onDuplicatePreviousWeek: fn(),
  },
} satisfies Meta<typeof WeekAgenda>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Five working days, one over the target, weekends empty and narrowed. */
export const TypicalWeek: Story = {
  play: async ({ args, canvas, userEvent }) => {
    const header = canvas.getByRole("button", { name: "Open Tuesday, 1" });
    await expect(header).toHaveTextContent("8 h");
    await userEvent.click(header);
    await expect(args.onOpenDay).toHaveBeenCalledWith("2026-09-01");
  },
};

/** The centred empty state with its two actions; every column still carries its `+`. */
export const EmptyWeek: Story = {
  args: {
    days: buildWeek(() => []),
  },
};

/** Twenty-five cards: the stagger caps at eight, the rest arrive at once. */
export const DenseWeek: Story = {
  args: {
    days: denseWeek,
    animateEntries: true,
  },
};

/** A live timer at the top of today's column. */
export const RunningTimer: Story = {
  args: {
    runningTimer: {
      projectName: "Atlas Platform",
      projectColor: "#37e3de",
      description: "Sprint planning",
      elapsedLabel: "0:42:13",
    },
    canContinue: false,
    onStopTimer: fn(),
  },
};

/** A submitted month: dashed columns, locked cards, no `+`. */
export const LockedWeek: Story = {
  args: {
    days: typicalWeek.map((day) => ({
      ...day,
      locked: true,
      entries: day.entries.map((item) => ({ ...item, locked: true })),
    })),
  },
};

export const PendingMutation: Story = {
  args: {
    disabled: true,
  },
};

export const TypicalWeekLight: Story = {
  globals: {
    theme: "light",
  },
};

/** Seven day rows, the selected one expanded — the phone's shape of the same week. */
export const MobileAccordion: Story = {
  args: {
    layout: "accordion",
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Show Thursday" }));
    await expect(args.onSelectDay).toHaveBeenCalledWith("2026-09-03");
  },
};
