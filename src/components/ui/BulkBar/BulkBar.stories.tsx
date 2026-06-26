import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

import { Button } from "../Button";
import { BulkBar } from ".";

const meta = {
  title: "UI/BulkBar",
  component: BulkBar,
  args: {
    selectedCount: 4,
    summary: "2 ready to approve, 2 already reviewed.",
    secondaryAction: <Button variant="ghost">Clear</Button>,
    primaryAction: <Button variant="cta">Approve selected</Button>,
  },
} satisfies Meta<typeof BulkBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    labels: {
      region: "Timesheet bulk actions",
      selected: (count) => `${count} selected timesheets`,
    },
  },
  play: async ({ canvas }) => {
    const region = canvas.getByRole("region", { name: /timesheet bulk actions/i });
    await expect(region).toHaveTextContent("4 selected timesheets");
    await expect(canvas.getByRole("button", { name: /approve selected/i })).toBeVisible();
  },
};

export const NoSelection: Story = {
  args: {
    selectedCount: 0,
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("region", { name: /bulk actions/i })).not.toBeInTheDocument();
  },
};
