import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn } from "storybook/test";

import { ReviewQueueTable } from ".";
import type { ReviewQueueRow } from "./ReviewQueueTable.types";

const rows: ReviewQueueRow[] = [
  {
    id: "1",
    person: "Lena Kovacs",
    period: "Jun 2026",
    project: "Apollo",
    status: "submitted",
    amount: "EUR 8,945",
  },
  {
    id: "2",
    person: "Mark Chen",
    period: "Jun 2026",
    project: "Helix",
    status: "missing",
    amount: "EUR 0",
    disabled: true,
  },
  {
    id: "3",
    person: "Sara Nagy",
    period: "Jun 2026",
    project: "Internal",
    status: "approved",
    amount: "EUR 6,280",
  },
];

const meta = {
  title: "Sheet/ReviewQueueTable",
  component: ReviewQueueTable,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    rows,
  },
} satisfies Meta<typeof ReviewQueueTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ControlledSelection: Story = {
  render: (args) => {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    return (
      <ReviewQueueTable {...args} selectedIds={selectedIds} onSelectedIdsChange={setSelectedIds} />
    );
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("checkbox", { name: /select sara nagy/i }));
    await expect(canvas.getByRole("checkbox", { name: /select sara nagy/i })).toBeChecked();
    await userEvent.click(canvas.getByRole("checkbox", { name: /select all submitted rows/i }));
    await expect(canvas.getByRole("checkbox", { name: /select lena kovacs/i })).toBeChecked();
    await expect(canvas.getByRole("checkbox", { name: /select sara nagy/i })).toBeChecked();
  },
};

export const SortAndOpen: Story = {
  args: {
    selectedIds: ["1"],
    sort: { columnId: "person", direction: "ascending" },
    onSortChange: fn(),
    onRowOpen: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /sort by amount ascending/i }));
    await expect(args.onSortChange).toHaveBeenCalledWith({
      columnId: "amount",
      direction: "ascending",
    });

    await userEvent.click(canvas.getByRole("button", { name: /open lena kovacs/i }));
    await expect(args.onRowOpen).toHaveBeenCalledWith(rows[0]);
  },
};

export const Empty: Story = {
  args: {
    rows: [],
  },
};
