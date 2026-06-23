import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Skeleton } from ".";

const meta = {
  title: "UI/Skeleton",
  component: Skeleton,
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  render: () => (
    <div className="grid gap-4">
      <Skeleton variant="card" />
      <Skeleton variant="table" lines={3} />
      <Skeleton variant="chart" />
    </div>
  ),
};
