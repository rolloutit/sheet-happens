import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, waitFor } from "storybook/test";

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

function dispatchFileEvent(target: HTMLElement, type: "dragover" | "drop", files: File[] = []) {
  const dataTransfer = new DataTransfer();
  files.forEach((file) => dataTransfer.items.add(file));
  const event = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer });
  target.dispatchEvent(event);
}

export const Default: Story = {};

export const Disabled: Story = {
  args: {
    disabled: true,
    description: "Invoice upload becomes available after approval.",
  },
};

export const Uploading: Story = {
  args: {
    files: [
      {
        id: "1",
        name: "invoice-2026-06.pdf",
        sizeLabel: "248 KB",
        status: "uploading",
        progress: 64,
      },
    ],
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("progressbar", { name: /invoice.*progress/i })).toHaveAttribute(
      "aria-valuenow",
      "64",
    );
  },
};

export const Error: Story = {
  args: {
    error: "Only PDF invoices can be uploaded.",
    files: [{ id: "1", name: "invoice.txt", sizeLabel: "2 KB", status: "error" }],
  },
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText(/upload invoice pdf/i, { selector: "input" });
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(canvas.getByRole("alert")).toHaveTextContent(/only pdf/i);
  },
};

export const DragAndAcceptValidation: Story = {
  args: {
    files: [],
    onFilesSelected: fn(),
    onFilesRejected: fn(),
  },
  play: async ({ args, canvas }) => {
    const dropTarget = canvas.getByText(/upload invoice pdf/i).closest("label");
    if (!dropTarget) throw new globalThis.Error("Dropzone label was not found");

    const accepted = new File(["%PDF"], "invoice.pdf", { type: "application/pdf" });
    const rejected = new File(["notes"], "invoice.txt", { type: "text/plain" });

    dispatchFileEvent(dropTarget, "dragover");
    await waitFor(() => expect(dropTarget).toHaveAttribute("data-dragging", "true"));

    dispatchFileEvent(dropTarget, "drop", [accepted, rejected]);
    await waitFor(() => expect(dropTarget).not.toHaveAttribute("data-dragging"));
    await expect(args.onFilesSelected).toHaveBeenCalledWith([accepted]);
    await expect(args.onFilesRejected).toHaveBeenCalledWith([rejected]);
  },
};
