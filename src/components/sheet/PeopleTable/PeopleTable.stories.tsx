import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { PeopleTable } from ".";
import type { PersonTableRow } from "./PeopleTable.types";

const rows: PersonTableRow[] = [
  {
    id: "1",
    name: "Lena Kovacs",
    email: "lena@example.com",
    profile: "Contractor",
    state: "active",
    currency: "EUR",
  },
  {
    id: "2",
    name: "Mark Chen",
    email: "mark@example.com",
    profile: "Employee",
    state: "inactive",
    currency: "HUF",
  },
];

const meta = {
  title: "Sheet/PeopleTable",
  component: PeopleTable,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    rows,
  },
} satisfies Meta<typeof PeopleTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onEdit: fn(),
    onDelete: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /edit lena kovacs/i }));
    await expect(args.onEdit).toHaveBeenCalledWith(rows[0]);
    await userEvent.click(canvas.getByRole("button", { name: /delete mark chen/i }));
    await expect(args.onDelete).toHaveBeenCalledWith(rows[1]);
  },
};

export const Sortable: Story = {
  args: {
    sort: { columnId: "name", direction: "ascending" },
    onSortChange: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /sort by currency ascending/i }));
    await expect(args.onSortChange).toHaveBeenCalledWith({
      columnId: "currency",
      direction: "ascending",
    });
  },
};

export const Empty: Story = {
  args: {
    rows: [],
  },
};
