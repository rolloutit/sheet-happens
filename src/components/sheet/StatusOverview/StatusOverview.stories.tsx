import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ArrowUpRight } from "lucide-react";
import { expect } from "storybook/test";

import { Button } from "@/src/components/ui/Button";
import { StatusOverview } from ".";

const meta = {
  title: "Sheet/StatusOverview",
  component: StatusOverview,
  globals: {
    theme: "dark",
    locale: "hu",
  },
  args: {
    segments: [
      { id: "submitted", label: "Beküldve", value: 46, tone: "info" },
      { id: "approved", label: "Jóváhagyva", value: 32, tone: "success" },
      { id: "rejected", label: "Elutasítva", value: 12, tone: "danger" },
      { id: "missing", label: "Hiányzik", value: 10, tone: "neutral" },
    ],
    action: (
      <Button variant="ghost" size="sm" icon={ArrowUpRight}>
        Megnyitás
      </Button>
    ),
  },
} satisfies Meta<typeof StatusOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: /status distribution/i })).toBeVisible();
    await expect(canvas.getByText("Beküldve")).toBeVisible();
  },
};

export const RawValues: Story = {
  args: {
    valueFormatter: (value) => `${value} people`,
  },
};

export const Empty: Story = {
  args: {
    segments: [],
    empty: "No status data for the selected period.",
  },
};
