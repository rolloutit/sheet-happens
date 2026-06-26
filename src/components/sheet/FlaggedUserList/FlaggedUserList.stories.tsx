import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn } from "storybook/test";

import { FlaggedUserList } from ".";
import type { FlaggedUserItem } from "./FlaggedUserList.types";

const users: FlaggedUserItem[] = [
  { id: "anna", name: "Kovács Anna", detail: "2 hiányzó nap", severity: "warning" },
  { id: "bence", name: "Tóth Bence", detail: "számla nélkül", severity: "danger" },
  { id: "eszter", name: "Nagy Eszter", detail: "jóváhagyásra vár", severity: "info" },
];

const meta = {
  title: "Sheet/FlaggedUserList",
  component: FlaggedUserList,
  globals: {
    theme: "dark",
    locale: "hu",
  },
  args: {
    items: users,
    labels: {
      selectAll: "Select all flagged users",
      remind: "Remind selected",
      sent: "Reminder sent",
      selected: (count) => `${count} selected`,
    },
  },
} satisfies Meta<typeof FlaggedUserList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ControlledSelection: Story = {
  args: {
    onRemind: fn(),
  },
  render: (args) => {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    return (
      <FlaggedUserList {...args} selectedIds={selectedIds} onSelectedIdsChange={setSelectedIds} />
    );
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("checkbox", { name: /select all flagged users/i }));
    await expect(canvas.getByText("3 selected")).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: /remind selected/i }));
    await expect(args.onRemind).toHaveBeenCalledWith(["anna", "bence", "eszter"]);
  },
};

export const ReminderSent: Story = {
  args: {
    selectedIds: ["anna"],
    reminderSent: true,
  },
};

export const Empty: Story = {
  args: {
    items: [],
    labels: {
      empty: "No users need attention.",
    },
  },
};
