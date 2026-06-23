import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { WeeklyTimeGrid } from ".";

const meta = {
  title: "Sheet/WeeklyTimeGrid",
  component: WeeklyTimeGrid,
} satisfies Meta<typeof WeeklyTimeGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = {};

export const Locked: Story = {
  args: {
    locked: true,
  },
};
