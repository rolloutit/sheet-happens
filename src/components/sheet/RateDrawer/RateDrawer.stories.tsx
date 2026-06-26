import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, within } from "storybook/test";

import { RateDrawer } from ".";

const rate = {
  id: "central",
  label: "Central rate",
  scope: "Default contractor rate",
  amount: 65,
  currency: "EUR",
  unit: "hour",
  effectiveFrom: "2026-01-01",
  status: "current",
} as const;

const meta = {
  title: "Sheet/RateDrawer",
  component: RateDrawer,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    rate,
    onSave: fn(),
  },
} satisfies Meta<typeof RateDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /edit rate/i }));
    const dialog = await screen.findByRole("dialog", { name: /central rate/i });
    await expect(within(dialog).getByDisplayValue("65")).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: /save rate/i }));
    await expect(args.onSave).toHaveBeenCalledWith(rate);
  },
};

export const Override: Story = {
  args: {
    rate: {
      ...rate,
      id: "apollo",
      label: "Apollo override",
      scope: "Apollo Migration",
      amount: 72,
      status: "override",
    },
  },
};
