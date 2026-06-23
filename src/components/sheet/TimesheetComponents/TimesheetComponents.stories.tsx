import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TimesheetComponents } from ".";

const meta = {
  title: "Sheet/TimesheetComponents",
  component: TimesheetComponents,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    status: "approved",
  },
} satisfies Meta<typeof TimesheetComponents>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Approved: Story = {};

export const Rejected: Story = {
  args: {
    status: "rejected",
  },
};

export const Paid: Story = {
  args: {
    status: "paid",
  },
};
