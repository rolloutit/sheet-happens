import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "../Button";
import { LockedState } from ".";

const meta = {
  title: "UI/LockedState",
  component: LockedState,
  args: {
    title: "Timesheet locked",
    reason: "Submitted timesheets cannot be edited while they are waiting for admin review.",
    meta: "Submitted Jun 21, 2026",
  },
} satisfies Meta<typeof LockedState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithAction: Story = {
  args: {
    action: (
      <Button variant="soft" size="sm">
        View review
      </Button>
    ),
  },
};
