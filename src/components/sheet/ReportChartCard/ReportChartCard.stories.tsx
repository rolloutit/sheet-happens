import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ReportChartCard } from ".";

const meta = {
  title: "Sheet/ReportChartCard",
  component: ReportChartCard,
  globals: {
    theme: "dark",
    locale: "hu",
  },
  args: {
    title: "Hours by day",
    data: [
      { label: "Mon", value: 40 },
      { label: "Tue", value: 68 },
      { label: "Wed", value: 52 },
      { label: "Thu", value: 80 },
      { label: "Fri", value: 64 },
    ],
    distribution: [
      { id: "apollo", label: "Apollo", value: 70 },
      { id: "helix", label: "Helix", value: 55 },
      { id: "internal", label: "Internal", value: 40 },
    ],
  },
} satisfies Meta<typeof ReportChartCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    data: [],
    distribution: [],
  },
};
