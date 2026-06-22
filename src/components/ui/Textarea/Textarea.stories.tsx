import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Textarea } from ".";

const meta = {
  title: "UI/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  args: {
    placeholder: "What did you work on?",
  },
  argTypes: {
    invalid: {
      control: "boolean",
    },
    disabled: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = {
  args: {
    defaultValue: "Implemented the timesheet approval queue and invoice diff view.",
  },
};

export const Invalid: Story = {
  args: {
    invalid: true,
    defaultValue: "",
    placeholder: "Description is required before submitting.",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: "This description belongs to a locked timesheet.",
  },
};
