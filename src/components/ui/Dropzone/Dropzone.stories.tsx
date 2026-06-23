import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Dropzone } from ".";

const meta = {
  title: "UI/Dropzone",
  component: Dropzone,
  args: {
    label: "Upload invoice PDF",
    description: "Drag a PDF here or browse from your computer.",
    accept: "application/pdf",
    files: [{ id: "1", name: "invoice-2026-06.pdf", sizeLabel: "248 KB", status: "done" }],
  },
} satisfies Meta<typeof Dropzone>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: {
    disabled: true,
    description: "Invoice upload becomes available after approval.",
  },
};
