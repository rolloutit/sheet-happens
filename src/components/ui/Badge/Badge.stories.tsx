import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Badge } from ".";

const meta = {
  title: "UI/Badge",
  component: Badge,
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge dot>Draft</Badge>
      <Badge tone="info" dot>
        Submitted
      </Badge>
      <Badge tone="success" dot>
        Active
      </Badge>
      <Badge tone="warning" dot>
        Missing
      </Badge>
      <Badge tone="danger" dot>
        Rejected
      </Badge>
      <Badge tone="cta">Contractor</Badge>
    </div>
  ),
};
