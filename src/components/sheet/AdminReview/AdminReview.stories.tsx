import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, within } from "storybook/test";

import { AdminReview } from ".";

const meta = {
  title: "Sheet/AdminReview",
  component: AdminReview,
  globals: {
    theme: "light",
    locale: "hu",
  },
} satisfies Meta<typeof AdminReview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const QueueAndDetail: Story = {};

export const DataDriven: Story = {
  args: {
    selectedIds: ["1"],
    onSelectedIdsChange: fn(),
    onRowOpen: fn(),
    onApproveSelected: fn(),
    onClearSelection: fn(),
    onRejectInvoice: fn(),
    rows: [
      {
        id: "1",
        person: "Lena Kovacs",
        period: "Jun 2026",
        project: "Apollo",
        status: "submitted",
        amount: "EUR 8,945",
      },
      {
        id: "2",
        person: "Mark Chen",
        period: "Jun 2026",
        project: "Helix",
        status: "missing",
        amount: "EUR 0",
        disabled: true,
      },
    ],
    diffItems: [
      { id: "hours", state: "match", label: "Hours", delta: "0.0h" },
      { id: "invoice", state: "mismatch", label: "Invoice total", delta: "+EUR 125" },
    ],
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /bulk approve/i }));
    await expect(args.onApproveSelected).toHaveBeenCalled();

    await userEvent.click(canvas.getByRole("checkbox", { name: /select lena kovacs/i }));
    await expect(args.onSelectedIdsChange).toHaveBeenCalledWith([]);

    await userEvent.click(canvas.getByRole("button", { name: /reject invoice/i }));
    const dialog = await screen.findByRole("dialog", { name: /reject invoice/i });
    await userEvent.type(within(dialog).getByLabelText(/reason/i), "Invoice total mismatch.");
    await userEvent.click(within(dialog).getByRole("button", { name: /reject invoice/i }));
    await expect(args.onRejectInvoice).toHaveBeenCalledWith("Invoice total mismatch.");
  },
};
