import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { DayColumnHeader } from ".";
import type { DayColumnHeaderDay } from "./DayColumnHeader.types";

const day: DayColumnHeaderDay = {
  isoDate: "2026-08-31",
  label: "Monday",
  shortLabel: "Mon",
  dayNumber: "31",
  state: "normal",
  locked: false,
  onLeave: false,
  totalMinutes: 510,
};

const labels = {
  capacity: "8.5 h of 8 h",
  over: "over 8 h",
  locked: "Locked by a submitted timesheet",
  onLeave: "On leave",
  today: "Today",
};

const meta = {
  title: "Sheet/DayColumnHeader",
  component: DayColumnHeader,
  parameters: { layout: "padded" },
  args: {
    day,
    variant: "column",
    capacityMinutes: 480,
    totalLabel: "8.5 h",
    label: "Open Monday, 31",
    labels,
    onPress: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-56 rounded-[var(--radius-lg)] border border-border bg-card">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DayColumnHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Over the target: the bar turns amber and the ⚠ says so beside the total. */
export const Column: Story = {
  play: async ({ args, canvas, userEvent }) => {
    const header = canvas.getByRole("button", { name: "Open Monday, 31" });
    await expect(canvas.getByRole("img", { name: "over 8 h" })).toBeInTheDocument();
    await userEvent.click(header);
    await expect(args.onPress).toHaveBeenCalled();
  },
};

export const ColumnToday: Story = {
  args: {
    day: { ...day, state: "today", totalMinutes: 240 },
    totalLabel: "4 h",
    labels: { ...labels, capacity: "4 h of 8 h" },
  },
};

export const ColumnFuture: Story = {
  args: {
    day: { ...day, state: "future", totalMinutes: 0 },
    totalLabel: "0 h",
    labels: { ...labels, capacity: "0 h of 8 h" },
  },
};

export const ColumnLocked: Story = {
  args: {
    day: { ...day, locked: true },
  },
};

/** A full-day leave: the palm tree where the chevron would be. */
export const ColumnOnLeave: Story = {
  args: {
    day: { ...day, onLeave: true, totalMinutes: 0 },
    totalLabel: "0 h",
    labels: { ...labels, capacity: "0 h of 8 h" },
  },
};

export const ChipOnLeave: Story = {
  args: {
    variant: "chip",
    label: "Select Monday",
    day: { ...day, onLeave: true, totalMinutes: 0 },
    totalLabel: "0 h",
    labels: { ...labels, capacity: "0 h of 8 h" },
  },
  decorators: [
    (Story) => (
      <div className="w-20">
        <Story />
      </div>
    ),
  ],
};

/** The ribbon stop: the same facts stacked, `aria-pressed` for the selection. */
export const Chip: Story = {
  args: { variant: "chip", label: "Select Monday", pressed: true },
  decorators: [
    (Story) => (
      <div className="w-20">
        <Story />
      </div>
    ),
  ],
};

/** The phone accordion's collapsed day. */
export const Row: Story = {
  args: { variant: "row", label: "Show Monday", expanded: false },
  decorators: [
    (Story) => (
      <div className="w-80 rounded-[var(--radius-lg)] border border-border bg-card">
        <Story />
      </div>
    ),
  ],
};

export const ColumnLight: Story = {
  globals: { theme: "light" },
};
