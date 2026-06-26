import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FileUp } from "lucide-react";
import { expect, fn } from "storybook/test";

import { TimesheetSummaryCard } from ".";

const meta = {
  title: "Sheet/TimesheetSummaryCard",
  component: TimesheetSummaryCard,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    title: "June 2026 timesheet",
    status: "approved",
    meta: "132.5 hours · EUR 8,945 estimated amount",
    action: {
      label: "Upload invoice",
      icon: FileUp,
      onClick: fn(),
    },
  },
} satisfies Meta<typeof TimesheetSummaryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /upload invoice/i }));
    await expect(args.action?.onClick).toHaveBeenCalled();
  },
};

export const Rejected: Story = {
  args: {
    status: "rejected",
    action: undefined,
  },
};
