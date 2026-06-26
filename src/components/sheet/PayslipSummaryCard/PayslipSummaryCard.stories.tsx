import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Download, Eye } from "lucide-react";
import { expect, fn } from "storybook/test";

import { PayslipSummaryCard } from ".";

const meta = {
  title: "Sheet/PayslipSummaryCard",
  component: PayslipSummaryCard,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    title: "June 2026 payslip",
    status: "available",
    statusLabel: "Latest available",
    meta: "Published by payroll today.",
  },
} satisfies Meta<typeof PayslipSummaryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithActions: Story = {
  args: {
    secondaryAction: {
      label: "Preview",
      icon: Eye,
      variant: "soft",
      onClick: fn(),
    },
    primaryAction: {
      label: "Download",
      icon: Download,
      variant: "cta",
      onClick: fn(),
    },
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /^preview$/i }));
    await expect(args.secondaryAction?.onClick).toHaveBeenCalled();

    await userEvent.click(canvas.getByRole("button", { name: /^download$/i }));
    await expect(args.primaryAction?.onClick).toHaveBeenCalled();
  },
};

export const Missing: Story = {
  args: {
    title: "April 2026 payslip",
    status: "missing",
    meta: "Payroll has not published this payslip yet.",
  },
};
