import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StatusPill, timesheetStatuses } from ".";

const meta = {
  title: "Sheet/StatusPill",
  component: StatusPill,
  tags: ["autodocs"],
  argTypes: {
    status: {
      control: "select",
      options: timesheetStatuses,
    },
    density: {
      control: "select",
      options: ["compact", "comfortable"],
    },
  },
  args: {
    status: "submitted",
  },
} satisfies Meta<typeof StatusPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {timesheetStatuses.map((status) => (
        <StatusPill key={status} status={status} />
      ))}
    </div>
  ),
};

export const Compact: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {timesheetStatuses.map((status) => (
        <StatusPill key={status} status={status} density="compact" />
      ))}
    </div>
  ),
};

// The nine states carry nine hues, and four of them are re-derived per theme rather than reused, so
// "all of them, in the other polarity" is the story that would catch a family that only works in
// dark. Pinned to light because the addon default is dark.
export const AllStatusesLight: Story = {
  parameters: { globals: { theme: "light" } },
  render: () => (
    <div className="flex flex-wrap gap-2">
      {timesheetStatuses.map((status) => (
        <StatusPill key={status} status={status} />
      ))}
    </div>
  ),
};
