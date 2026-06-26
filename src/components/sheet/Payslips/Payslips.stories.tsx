import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { Payslips } from ".";

const meta = {
  title: "Sheet/Payslips",
  component: Payslips,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    role: "employee",
  },
} satisfies Meta<typeof Payslips>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Employee: Story = {};

export const Admin: Story = {
  args: {
    role: "admin",
  },
};

export const DataDrivenEmployee: Story = {
  args: {
    role: "employee",
    selectedPayslipId: "june-2026",
    viewer: {
      state: "ready",
      fileName: "payslip-june.pdf",
      onOpen: fn(),
      onDownload: fn(),
    },
    onPreviewPayslip: fn(),
    onDownloadPayslip: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /^preview$/i }));
    await expect(args.onPreviewPayslip).toHaveBeenCalledWith(
      expect.objectContaining({ id: "june-2026" }),
    );

    await userEvent.click(canvas.getByRole("button", { name: /download may 2026 payslip/i }));
    await expect(args.onDownloadPayslip).toHaveBeenCalledWith(
      expect.objectContaining({ id: "may-2026" }),
    );
  },
};

export const DataDrivenAdmin: Story = {
  args: {
    role: "admin",
    viewer: {
      state: "ready",
      fileName: "lena-june.pdf",
    },
    onUpload: fn(),
    onAdminPreview: fn(),
    onAdminUpload: fn(),
    onAdminSortChange: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /^upload$/i }));
    await expect(args.onUpload).toHaveBeenCalled();

    await userEvent.click(canvas.getByRole("button", { name: /preview lena kovacs payslip/i }));
    await expect(args.onAdminPreview).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }));

    await userEvent.click(canvas.getByRole("button", { name: /upload mark chen payslip/i }));
    await expect(args.onAdminUpload).toHaveBeenCalledWith(expect.objectContaining({ id: "2" }));

    await userEvent.click(canvas.getByRole("button", { name: /sort by employee ascending/i }));
    await expect(args.onAdminSortChange).toHaveBeenCalledWith({
      columnId: "person",
      direction: "ascending",
    });
  },
};
