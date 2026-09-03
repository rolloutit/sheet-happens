import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { WeekAgenda } from ".";
import type { WeekAgendaDay, WeekAgendaEntry } from "./WeekAgenda.types";

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
    locked: false,
    warnings: [],
    adminModified: false,
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
    };
  });
}

const typicalWeek = buildWeek((dayIndex) => {
  if (dayIndex > 4) return [];
  if (dayIndex === 1) {
    return [
      entry(`d${dayIndex}-1`, 0, { startTime: "09:00", endTime: "11:30" }),
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

const labels = {
  openDay: (day: WeekAgendaDay) => `Open ${day.label}`,
  expandDay: (day: WeekAgendaDay) => `Show ${day.label}`,
  columnEmpty: "Nothing logged",
  addEntry: (day: WeekAgendaDay) => `Add entry on ${day.label}`,
  editEntry: (item: WeekAgendaEntry) => `Edit ${item.description}`,
  deleteEntry: (item: WeekAgendaEntry) => `Delete ${item.description}`,
  adminModified: "Changed by an administrator",
};

const meta = {
  title: "Sheet/WeekAgenda",
  component: WeekAgenda,
  args: {
    days: typicalWeek,
    selectedDayIso: "2026-09-02",
    locale: "en",
    durationDisplayFormat: "DECIMAL_HOURS",
    labels,
    onSelectDay: fn(),
    onZoomToDay: fn(),
    onAddEntry: fn(),
    onEditEntry: fn(),
    onDeleteEntry: fn(),
  },
} satisfies Meta<typeof WeekAgenda>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TypicalWeek: Story = {
  play: async ({ args, canvas, userEvent }) => {
    // L2 → L1: the day header is the zoom, and you land on that day. Asserted on the open day,
    // whose header reads the same way at both widths — the collapsed ones only exist on mobile.
    await userEvent.click(canvas.getByRole("button", { name: "Open Wednesday" }));
    await expect(args.onZoomToDay).toHaveBeenCalledWith("2026-09-02");
  },
};

export const EmptyWeek: Story = {
  args: {
    days: buildWeek(() => []),
  },
};

export const DenseWeek: Story = {
  args: {
    days: buildWeek((dayIndex) =>
      Array.from({ length: 6 }, (_, index) =>
        entry(`dense-${dayIndex}-${index}`, index, {
          description: `Sprint ${index + 1} review and follow-up notes`,
          durationMinutes: 75,
          startTime: `0${index + 8}:00`.slice(-5),
          endTime: `0${index + 9}:15`.slice(-5),
        }),
      ),
    ),
  },
};

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
  globals: { theme: "light" },
};

/**
 * Seven columns do not fit a phone, so the level degrades to an accordion with the selected day
 * open. The two clicks that shape it — a collapsed day opens, the open one zooms in — are asserted
 * in `WeekAgenda.test.tsx`, where the width is not the browser's to choose.
 */
export const MobileAccordion: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};
