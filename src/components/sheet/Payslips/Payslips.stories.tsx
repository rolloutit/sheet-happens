import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Payslips } from ".";

const meta = {
  title: "Sheet/Payslips",
  component: Payslips,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    role: "employee",
  },
} satisfies Meta<typeof Payslips>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Employee: Story = {};

export const Admin: Story = {
  args: {
    role: "admin",
  },
};
