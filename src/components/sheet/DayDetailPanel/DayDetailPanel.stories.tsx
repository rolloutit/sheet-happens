import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { DayDetailPanel } from ".";

const entries = [
  {
    id: "apollo",
    projectName: "Apollo Migration",
    projectColor: "#37e3de",
    hours: 6,
    note: "Invoice reconciliation and import test.",
    billable: true,
    status: "submitted" as const,
  },
  {
    id: "admin",
    projectName: "Internal admin",
    projectColor: "#72df9a",
    hours: 2,
    billable: false,
  },
];

const meta = {
  title: "Sheet/DayDetailPanel",
  component: DayDetailPanel,
  tags: ["autodocs"],
  args: {
    dateLabel: "Wednesday, June 24",
    entries,
    onAddEntry: fn(),
    onEditEntry: fn(),
    onDeleteEntry: fn(),
  },
} satisfies Meta<typeof DayDetailPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /edit apollo migration/i }));
    await expect(args.onEditEntry).toHaveBeenCalledWith(entries[0]);
  },
};

export const Empty: Story = {
  args: {
    entries: [],
  },
};
