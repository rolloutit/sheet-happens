import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Input } from ".";

const meta = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
  argTypes: {
    invalid: {
      control: "boolean",
    },
    disabled: {
      control: "boolean",
    },
  },
  args: {
    placeholder: "Internal tools",
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = {
  args: {
    defaultValue: "Rollout platform",
  },
};

export const Invalid: Story = {
  args: {
    invalid: true,
    defaultValue: "27",
    "aria-label": "Invalid hours",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: "Locked value",
  },
};

export const Types: Story = {
  render: () => (
    <div className="grid max-w-md gap-3">
      <Input aria-label="Email" type="email" placeholder="name@example.com" />
      <Input aria-label="Hours" type="number" min={0} max={24} step={0.25} defaultValue={7.5} />
      <Input aria-label="Date" type="date" defaultValue="2026-06-21" />
      <Input aria-label="Time" type="time" defaultValue="09:00" />
    </div>
  ),
};
