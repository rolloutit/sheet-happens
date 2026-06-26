import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

import { TimesheetStepper } from ".";

const meta = {
  title: "Sheet/TimesheetStepper",
  component: TimesheetStepper,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    status: "approved",
  },
} satisfies Meta<typeof TimesheetStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Approved: Story = {
  play: async ({ canvas }) => {
    const current = canvas
      .getByText("Approved")
      .parentElement?.querySelector("[aria-current='step']");
    await expect(current).toBeTruthy();
  },
};

export const Rejected: Story = {
  args: {
    status: "rejected",
  },
};

export const CustomSteps: Story = {
  args: {
    steps: [
      { id: "draft", label: "Draft", state: "done" },
      { id: "review", label: "Review", state: "current" },
      { id: "finance", label: "Finance", state: "locked" },
    ],
  },
};
