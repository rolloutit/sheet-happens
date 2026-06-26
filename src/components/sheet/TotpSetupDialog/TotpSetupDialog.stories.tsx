import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, within } from "storybook/test";

import { TotpSetupDialog } from ".";

const meta = {
  title: "Sheet/TotpSetupDialog",
  component: TotpSetupDialog,
  globals: {
    theme: "dark",
    locale: "hu",
  },
  args: {
    secret: "SH-2026-DEMO",
    onConfirm: fn(),
  },
} satisfies Meta<typeof TotpSetupDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /enable totp/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/6 digit code/i), "123456");
    await userEvent.click(within(dialog).getByRole("button", { name: /verify/i }));
    await expect(args.onConfirm).toHaveBeenCalledWith("123456");
  },
};

export const CustomCopy: Story = {
  args: {
    title: "Enable 2FA",
    confirmLabel: "Confirm code",
  },
};
