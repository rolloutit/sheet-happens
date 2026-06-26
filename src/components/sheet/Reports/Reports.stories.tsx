import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, within } from "storybook/test";

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

export const DataDriven: Story = {
  args: {
    mode: "internal",
    periodValue: "week",
    projectValue: "apollo",
    view: "user",
    stats: [
      { label: "Hours", value: "160", helperText: "Selected week", tone: "info" },
      { label: "Billable", value: "EUR 10,400", helperText: "Approved rows", tone: "success" },
      { label: "Edited rows", value: "2", helperText: "Needs review", tone: "warning" },
    ],
    chartData: [
      { label: "Mon", value: 8 },
      { label: "Tue", value: 9 },
      { label: "Wed", value: 7.5 },
      { label: "Thu", value: 10 },
      { label: "Fri", value: 8 },
    ],
    distribution: [
      { id: "delivery", label: "Delivery", value: 62 },
      { id: "support", label: "Support", value: 38 },
    ],
    documentRows: [
      { id: "delivery", label: "Delivery", value: "99h" },
      { id: "support", label: "Support", value: "61h" },
      { id: "internal-cost", label: "Internal cost", value: "EUR 10,400", internalOnly: true },
    ],
    rows: [
      { id: "1", project: "Apollo", user: "Lena Kovacs", hours: 99, amount: "EUR 6,435" },
      { id: "2", project: "Apollo", user: "Mark Chen", hours: 61, amount: "EUR 3,965" },
    ],
    onViewChange: fn(),
    onExport: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("radio", { name: /project/i }));
    await expect(args.onViewChange).toHaveBeenCalledWith("project");

    await userEvent.click(canvas.getByRole("button", { name: /export/i }));
    const dialog = await screen.findByRole("dialog");
    await expect(within(dialog).getByText(/internal cost/i)).toBeVisible();

    await userEvent.click(within(dialog).getByRole("button", { name: /export csv/i }));
    await expect(args.onExport).toHaveBeenCalledWith("csv");
  },
};
