import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

import { DocumentPreview } from ".";

const rows = [
  { id: "apollo", label: "Apollo Migration", value: "112h" },
  { id: "helix", label: "Helix Support", value: "48h" },
  { id: "internal-cost", label: "Internal cost", value: "EUR 7,280", internalOnly: true },
];

const meta = {
  title: "Sheet/DocumentPreview",
  component: DocumentPreview,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    title: "June 2026",
    mode: "cost-free",
    rows,
  },
} satisfies Meta<typeof DocumentPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CostFree: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/apollo migration/i)).toBeVisible();
    await expect(canvas.queryByText(/internal cost/i)).not.toBeInTheDocument();
  },
};

export const Internal: Story = {
  args: {
    mode: "internal",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/internal cost/i)).toBeVisible();
  },
};
