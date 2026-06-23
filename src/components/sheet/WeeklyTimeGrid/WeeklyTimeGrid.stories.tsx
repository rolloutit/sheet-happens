import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { WeeklyTimeGrid } from ".";

const meta = {
  title: "Sheet/WeeklyTimeGrid",
  component: WeeklyTimeGrid,
  globals: {
    theme: "light",
    locale: "hu",
  },
} satisfies Meta<typeof WeeklyTimeGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Editable: Story = {};

export const Locked: Story = {
  args: {
    locked: true,
  },
};

export const WithTimer: Story = {
  args: {
    showTimer: true,
  },
};
