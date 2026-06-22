import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FileSearch, PartyPopper } from "lucide-react";

import { Button } from "@/src/components/ui/Button";
import { EmptyState } from ".";

const meta = {
  title: "Sheet/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  args: {
    icon: FileSearch,
    title: "No timesheets found",
    body: "Adjust the filters or create a new timesheet for this period.",
  },
  argTypes: {
    tone: {
      control: "select",
      options: ["default", "warm", "good"],
    },
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithAction: Story = {
  args: {
    tone: "warm",
    action: <Button variant="cta">Create timesheet</Button>,
  },
};

export const Success: Story = {
  args: {
    icon: PartyPopper,
    tone: "good",
    title: "Everything is submitted",
    body: "There are no missing entries for this week.",
  },
};
