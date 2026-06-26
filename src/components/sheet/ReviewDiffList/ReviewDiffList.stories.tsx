import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

import { Button } from "@/src/components/ui/Button";
import { ReviewDiffList } from ".";

const meta = {
  title: "Sheet/ReviewDiffList",
  component: ReviewDiffList,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    items: [
      { id: "hours", state: "match", label: "Hours", delta: "0.0h" },
      { id: "rate", state: "match", label: "Rate", delta: "EUR 0" },
      { id: "invoice", state: "mismatch", label: "Invoice total", delta: "+EUR 125" },
    ],
    totals: [
      { id: "timesheet", label: "Timesheet total", value: "EUR 8,945" },
      { id: "invoice", label: "Invoice total", value: "EUR 9,070", tone: "warning" },
    ],
  },
} satisfies Meta<typeof ReviewDiffList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Hours")).toBeVisible();
    await expect(canvas.getByText("+EUR 125")).toBeVisible();
    await expect(canvas.getByText("EUR 9,070")).toBeVisible();
  },
};

export const WithFooter: Story = {
  args: {
    footer: (
      <Button type="button" variant="danger" size="sm">
        Reject invoice
      </Button>
    ),
  },
};
