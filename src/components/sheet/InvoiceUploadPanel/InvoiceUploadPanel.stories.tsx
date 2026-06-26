import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { InvoiceUploadPanel } from ".";

const meta = {
  title: "Sheet/InvoiceUploadPanel",
  component: InvoiceUploadPanel,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    enabled: true,
    files: [{ id: "invoice", name: "invoice-june.pdf", sizeLabel: "248 KB", status: "done" }],
  },
} satisfies Meta<typeof InvoiceUploadPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Enabled: Story = {
  args: {
    onFilesSelected: fn(),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("list", { name: /upload invoice files/i })).toBeVisible();
    await expect(canvas.getByText("invoice-june.pdf")).toBeVisible();
  },
};

export const Locked: Story = {
  args: {
    enabled: false,
    files: [],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Approval required")).toBeVisible();
  },
};
