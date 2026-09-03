import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { DayAgenda } from ".";
import type { DayAgendaEntry } from "./DayAgenda.types";

const entries: DayAgendaEntry[] = [
  {
    id: "atlas",
    projectName: "Atlas Platform",
    projectColor: "#37e3de",
    description: "Invoice reconciliation and import test",
    durationMinutes: 150,
    startTime: "09:00",
    endTime: "11:30",
    sourceLabel: "Timer",
    locked: false,
    warnings: [],
    adminNotice: null,
  },
  {
    id: "ops",
    projectName: "Internal Ops",
    projectColor: "#72df9a",
    description: "Rate table migration",
    durationMinutes: 330,
    startTime: null,
    endTime: null,
    sourceLabel: "Form",
    locked: false,
    warnings: ["Long continuous session"],
    adminNotice: {
      changedBy: "Changed by Anna Kovács on 2 Sep 2026, 10:15.",
      reason: "Reason: duration corrected against the signed timesheet.",
    },
  },
];

const meta = {
  title: "Sheet/DayAgenda",
  component: DayAgenda,
  args: {
    isoDate: "2026-09-02",
    dayState: "today",
    totalMinutes: 480,
    capacityMinutes: 480,
    entries,
    locale: "en",
    durationDisplayFormat: "DECIMAL_HOURS",
    labels: {
      durationMode: "Duration",
      futureDay: "This is a future date. Entries are allowed, but they stay flagged.",
      overCapacity: "The selected day has more than 8 logged hours.",
      emptyTitle: "No entries on this day",
      emptyDescription: "Start a timer or add an entry for the selected project and day.",
      addEntry: "Add entry",
      editEntry: (entry) => `Edit ${entry.description}`,
      deleteEntry: (entry) => `Delete ${entry.description}`,
    },
    onAddEntry: fn(),
    onEditEntry: fn(),
    onDeleteEntry: fn(),
  },
} satisfies Meta<typeof DayAgenda>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /edit invoice reconciliation/i }));
    await expect(args.onEditEntry).toHaveBeenCalledWith(entries[0]);
  },
};

export const Empty: Story = {
  args: {
    entries: [],
    totalMinutes: 0,
  },
};

export const OverCapacity: Story = {
  args: {
    totalMinutes: 600,
  },
};

export const FutureDay: Story = {
  args: {
    dayState: "future",
  },
};

export const LockedDay: Story = {
  args: {
    entries: entries.map((entry) => ({ ...entry, locked: true })),
  },
};

export const PendingMutation: Story = {
  args: {
    disabled: true,
  },
};

export const DefaultLight: Story = {
  globals: { theme: "light" },
};

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};
