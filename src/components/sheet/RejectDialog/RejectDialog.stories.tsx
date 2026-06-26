import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, within } from "storybook/test";

import { RejectDialog } from ".";

const meta = {
  title: "Sheet/RejectDialog",
  component: RejectDialog,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    onReject: fn(),
  },
} satisfies Meta<typeof RejectDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /reject invoice/i }));
    const dialog = await screen.findByRole("dialog", { name: /reject invoice/i });
    await expect(within(dialog).getByRole("button", { name: /reject invoice/i })).toBeDisabled();
    await userEvent.type(
      within(dialog).getByLabelText(/reason/i),
      "Invoice total does not match the approved timesheet.",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: /reject invoice/i }));
    await expect(args.onReject).toHaveBeenCalledWith(
      "Invoice total does not match the approved timesheet.",
    );
  },
};

export const Prefilled: Story = {
  args: {
    defaultReason: "Missing invoice number.",
  },
};
