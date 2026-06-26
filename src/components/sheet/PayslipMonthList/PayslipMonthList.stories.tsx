import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { PayslipMonthList } from ".";
import type { PayslipMonthItem } from ".";

const items = [
  {
    id: "june-2026",
    month: "June 2026",
    status: "available",
    fileName: "payslip-june.pdf",
  },
  {
    id: "may-2026",
    month: "May 2026",
    status: "available",
    fileName: "payslip-may.pdf",
  },
  {
    id: "april-2026",
    month: "April 2026",
    status: "missing",
    meta: "Payroll has not published this payslip yet.",
  },
] satisfies PayslipMonthItem[];

const meta = {
  title: "Sheet/PayslipMonthList",
  component: PayslipMonthList,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    items,
    selectedId: "june-2026",
  },
} satisfies Meta<typeof PayslipMonthList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Interactive: Story = {
  args: {
    onPreview: fn(),
    onDownload: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /preview june 2026 payslip/i }));
    await expect(args.onPreview).toHaveBeenCalledWith(items[0]);

    await userEvent.click(canvas.getByRole("button", { name: /download may 2026 payslip/i }));
    await expect(args.onDownload).toHaveBeenCalledWith(items[1]);
  },
};

export const Empty: Story = {
  args: {
    items: [],
  },
};
