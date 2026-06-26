import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { PayslipUploadPanel } from ".";

const meta = {
  title: "Sheet/PayslipUploadPanel",
  component: PayslipUploadPanel,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    selectedEmployee: "Lena Kovacs",
    selectedMonth: "June 2026",
    files: [{ id: "1", name: "lena-june.pdf", sizeLabel: "188 KB", status: "done" }],
  },
} satisfies Meta<typeof PayslipUploadPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Interactive: Story = {
  args: {
    onUpload: fn(),
    onFilesSelected: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /upload/i }));
    await expect(args.onUpload).toHaveBeenCalled();

    const file = new File(["payslip"], "mark-june.pdf", { type: "application/pdf" });
    await userEvent.upload(
      canvas.getByLabelText(/upload payslip pdf/i, { selector: "input" }),
      file,
    );
    await expect(args.onFilesSelected).toHaveBeenCalled();
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    files: [],
  },
};
