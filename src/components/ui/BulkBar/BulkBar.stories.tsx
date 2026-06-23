import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "../Button";
import { BulkBar } from ".";

const meta = {
  title: "UI/BulkBar",
  component: BulkBar,
  args: {
    selectedCount: 4,
    summary: "2 ready to approve, 2 already reviewed.",
    secondaryAction: <Button variant="ghost">Clear</Button>,
    primaryAction: <Button variant="cta">Approve selected</Button>,
  },
} satisfies Meta<typeof BulkBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
