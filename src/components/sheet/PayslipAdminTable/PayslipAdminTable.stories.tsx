import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { PayslipAdminTable } from ".";
import type { PayslipAdminRow } from ".";

const rows = [
  {
    id: "1",
    person: "Lena Kovacs",
    email: "lena@example.com",
    month: "June 2026",
    status: "available",
    fileName: "payslip-june.pdf",
  },
  {
    id: "2",
    person: "Mark Chen",
    email: "mark@example.com",
    month: "June 2026",
    status: "missing",
  },
] satisfies PayslipAdminRow[];

const meta = {
  title: "Sheet/PayslipAdminTable",
  component: PayslipAdminTable,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    rows,
  },
} satisfies Meta<typeof PayslipAdminTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Interactive: Story = {
  args: {
    onPreview: fn(),
    onDownload: fn(),
    onUpload: fn(),
    onSortChange: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /sort by employee ascending/i }));
    await expect(args.onSortChange).toHaveBeenCalledWith({
      columnId: "person",
      direction: "ascending",
    });

    await userEvent.click(canvas.getByRole("button", { name: /preview lena kovacs payslip/i }));
    await expect(args.onPreview).toHaveBeenCalledWith(rows[0]);

    await userEvent.click(canvas.getByRole("button", { name: /download lena kovacs payslip/i }));
    await expect(args.onDownload).toHaveBeenCalledWith(rows[0]);

    await userEvent.click(canvas.getByRole("button", { name: /upload mark chen payslip/i }));
    await expect(args.onUpload).toHaveBeenCalledWith(rows[1]);
  },
};

export const Empty: Story = {
  args: {
    rows: [],
  },
};
