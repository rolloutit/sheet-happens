import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AlertTriangle, CircleCheck, FileSpreadsheet } from "lucide-react";

import { ReportStatTile } from ".";

const meta = {
  title: "Sheet/ReportStatTile",
  component: ReportStatTile,
  globals: {
    theme: "dark",
    locale: "hu",
  },
  args: {
    label: "Hours",
    value: "418.5",
    helperText: "Current filter",
    tone: "info",
    icon: FileSpreadsheet,
  },
} satisfies Meta<typeof ReportStatTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Success: Story = {
  args: {
    label: "Approved",
    value: "24",
    helperText: "Ready for payroll",
    tone: "success",
    icon: CircleCheck,
  },
};

export const Warning: Story = {
  args: {
    label: "Edited rows",
    value: "3",
    helperText: "Needs review",
    tone: "warning",
    icon: AlertTriangle,
  },
};
