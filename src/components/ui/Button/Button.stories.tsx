import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Check, Plus } from "lucide-react";
import { expect } from "storybook/test";

import { Button } from ".";

const meta = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  args: {
    children: "Primary action",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "cta", "soft", "ghost", "danger", "link"],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg", "icon"],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button variant="primary">Primary</Button>
      <Button variant="cta">CTA</Button>
      <Button variant="soft">Soft</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="link">Link button</Button>
    </div>
  ),
};

export const WithIcon: Story = {
  args: {
    icon: Plus,
    children: "Add entry",
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    children: "Saving",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    icon: Check,
    children: "Approved",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /approved/i })).toBeDisabled();
  },
};

export const AsLink: Story = {
  render: () => (
    <Button asChild variant="link">
      <a href="/reports">Open reports</a>
    </Button>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("link", { name: /open reports/i })).toHaveAttribute(
      "href",
      "/reports",
    );
  },
};
