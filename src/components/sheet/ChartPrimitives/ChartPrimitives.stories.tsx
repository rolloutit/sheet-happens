import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

import { ChartFrame, DistributionBarList, TrendChart } from ".";

const meta = {
  title: "Sheet/ChartPrimitives",
  component: ChartFrame,
  tags: ["autodocs"],
} satisfies Meta<typeof ChartFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Trend: Story = {
  args: {
    title: "Utilization trend",
    children: null,
  },
  render: () => (
    <ChartFrame title="Utilization trend" description="Billable hours across recent weeks">
      <TrendChart
        title="Utilization trend"
        data={[
          { label: "W21", value: 74 },
          { label: "W22", value: 82 },
          { label: "W23", value: 68 },
          { label: "W24", value: 91 },
        ]}
        valueLabel="Utilization"
      />
    </ChartFrame>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: /utilization trend chart/i })).toBeVisible();
  },
};

export const Distribution: Story = {
  args: {
    title: "Project distribution",
    children: null,
  },
  render: () => (
    <ChartFrame title="Project distribution">
      <DistributionBarList
        items={[
          { id: "apollo", label: "Apollo", value: 72, detail: "72h", tone: "primary" },
          { id: "helix", label: "Helix", value: 18, detail: "18h", tone: "success" },
          { id: "admin", label: "Admin", value: 6, detail: "6h", tone: "warning" },
        ]}
        totalLabel="96 hours"
      />
    </ChartFrame>
  ),
};

export const Empty: Story = {
  args: {
    title: "Empty chart",
    children: null,
  },
  render: () => (
    <ChartFrame title="Empty chart" hasData={false} empty="No values for this filter.">
      <TrendChart title="Empty chart" data={[]} />
    </ChartFrame>
  ),
};
