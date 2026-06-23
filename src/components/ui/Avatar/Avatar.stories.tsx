import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Avatar } from ".";

const meta = {
  title: "UI/Avatar",
  component: Avatar,
  args: {
    name: "Lena Kovacs",
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar name="Ada Lovelace" size="sm" />
      <Avatar name="Ada Lovelace" size="md" tone="amber" />
      <Avatar name="Ada Lovelace" size="lg" tone="deep" />
      <Avatar name="Ada Lovelace" size="xl" tone="peach" />
    </div>
  ),
};

export const Stack: Story = {
  render: () => (
    <div className="flex -space-x-2">
      {["Lena Kovacs", "Mark Chen", "Sara Nagy", "Tamas Toth"].map((name, index) => (
        <Avatar
          key={name}
          name={name}
          tone={index % 2 === 0 ? "teal" : "amber"}
          className="ring-2 ring-background"
        />
      ))}
    </div>
  ),
};
