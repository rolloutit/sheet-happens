import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { DashboardCards } from ".";

const meta = {
  title: "Sheet/DashboardCards",
  component: DashboardCards,
  args: {
    name: "Lena",
    role: "contractor",
  },
} satisfies Meta<typeof DashboardCards>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Contractor: Story = {};

export const Admin: Story = {
  args: {
    name: "Marta",
    role: "admin",
  },
};
