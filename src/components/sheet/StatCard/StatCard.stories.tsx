import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AlertCircle, Clock3 } from "lucide-react";
import { expect } from "storybook/test";

import { StatCard } from ".";

const meta = {
  title: "Sheet/StatCard",
  component: StatCard,
  globals: {
    theme: "dark",
    locale: "hu",
  },
  args: {
    label: "Rögzített órák",
    value: "1284h",
    icon: Clock3,
    trend: { label: "+8%", direction: "up", "aria-label": "Hours increased by 8 percent" },
    sparkline: { points: [30, 48, 35, 64, 58, 82, 72], "aria-label": "Hours trend" },
  },
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("1284h")).toBeVisible();
    await expect(canvas.getByRole("img", { name: /hours trend/i })).toBeVisible();
  },
};

export const Warning: Story = {
  args: {
    label: "Hiányzó napok",
    value: "17",
    icon: AlertCircle,
    tone: "warning",
    helperText: "Figyelmet igényel",
    sparkline: [26, 24, 23, 20, 19, 18, 17],
  },
};

export const Loading: Story = {
  args: {
    loading: true,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Rögzített órák").closest("[aria-busy='true']")).toBeTruthy();
  },
};

export const EmptySparkline: Story = {
  args: {
    sparkline: { points: [], "aria-label": "Empty hours trend" },
  },
};
