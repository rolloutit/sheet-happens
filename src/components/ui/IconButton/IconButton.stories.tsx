import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Bell, Pencil, Trash2 } from "lucide-react";

import { IconButton } from ".";

const meta = {
  title: "UI/IconButton",
  component: IconButton,
  args: {
    icon: Bell,
    label: "Notifications",
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const States: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <IconButton icon={Bell} label="Notifications" dot />
      <IconButton icon={Pencil} label="Edit" active />
      <IconButton icon={Trash2} label="Delete" variant="danger" />
      <IconButton icon={Bell} label="Disabled" disabled />
    </div>
  ),
};
