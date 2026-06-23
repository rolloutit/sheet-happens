import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Reports } from ".";

const meta = {
  title: "Sheet/Reports",
  component: Reports,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    mode: "cost-free",
  },
} satisfies Meta<typeof Reports>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CostFree: Story = {};

export const Internal: Story = {
  args: {
    mode: "internal",
  },
};
