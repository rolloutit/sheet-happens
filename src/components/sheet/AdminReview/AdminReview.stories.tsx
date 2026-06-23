import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AdminReview } from ".";

const meta = {
  title: "Sheet/AdminReview",
  component: AdminReview,
} satisfies Meta<typeof AdminReview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const QueueAndDetail: Story = {};
