import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { EntryCard, RunningEntryCard } from ".";
import type { EntryCardEntry } from "./EntryCard.types";

const entry: EntryCardEntry = {
  id: "entry-1",
  projectName: "Internal Ops & Tooling",
  projectColor: "#72df9a",
  description: "Internal dashboard updates",
  durationMinutes: 255,
  startTime: "09:00",
  endTime: "13:15",
  timed: false,
  locked: false,
  adminModified: false,
  warnings: [],
};

const labels = {
  edit: (item: EntryCardEntry) => `Edit ${item.description}`,
  delete: (item: EntryCardEntry) => `Delete ${item.description}`,
  continue: (item: EntryCardEntry) => `Continue ${item.description}`,
  adminModified: "Changed by an administrator",
  timed: "Tracked with a timer",
  locked: "Locked by a submitted timesheet",
};

const meta = {
  title: "Sheet/EntryCard",
  component: EntryCard,
  parameters: { layout: "padded" },
  args: {
    entry,
    durationLabel: "4.25 h",
    density: "compact",
    labels,
    onEdit: fn(),
    onDelete: fn(),
    onContinue: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EntryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The Week column card. Actions reveal on hover and focus, and are always in the tab order — which
 * is what the play test exercises: a keyboard user reaches Edit and Continue without ever hovering.
 */
export const Compact: Story = {
  play: async ({ args, canvas, userEvent }) => {
    const edit = canvas.getByRole("button", { name: "Edit Internal dashboard updates" });
    const next = canvas.getByRole("button", { name: "Continue Internal dashboard updates" });

    await userEvent.tab();
    await expect(edit).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "entry-1" }));

    await userEvent.tab();
    await expect(next).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onContinue).toHaveBeenCalled();
  },
};

/** The Day row: descriptions wrap, the meta line has room. */
export const Comfortable: Story = {
  args: {
    density: "comfortable",
    entry: {
      ...entry,
      description:
        "Internal dashboard updates — reworked the utilisation tiles and the empty states of the payroll view",
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[36rem]">
        <Story />
      </div>
    ),
  ],
};

export const TimerSourced: Story = {
  args: { entry: { ...entry, timed: true } },
};

export const Warning: Story = {
  args: { entry: { ...entry, durationMinutes: 510, warnings: ["Long continuous session"] } },
};

export const AdminModified: Story = {
  args: { entry: { ...entry, adminModified: true } },
};

export const Locked: Story = {
  args: { entry: { ...entry, locked: true } },
};

/** Continue is withheld while a timer is already running. */
export const TimerRunning: Story = {
  args: { canContinue: false },
};

export const JustSaved: Story = {
  args: { highlightToken: 1 },
};

export const Running: Story = {
  render: () => (
    <RunningEntryCard
      projectName="Atlas Platform"
      projectColor="#37e3de"
      description="Sprint planning"
      elapsedLabel="0:42:13"
      labels={{ live: "Running now", stop: "Stop timer" }}
      onStop={fn()}
    />
  ),
};

export const CompactLight: Story = {
  globals: { theme: "light" },
};
