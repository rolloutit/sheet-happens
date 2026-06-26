import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { TweaksPanel } from ".";

const meta = {
  title: "Sheet/TweaksPanel",
  component: TweaksPanel,
  globals: {
    theme: "light",
    locale: "hu",
  },
  parameters: {
    layout: "fullscreen",
  },
  args: {
    onApply: fn(),
    onReset: fn(),
    onValueChange: fn(),
    onOpenChange: fn(),
  },
} satisfies Meta<typeof TweaksPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /use #ffc68b/i }));
    await expect(args.onValueChange).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: /apply preview/i }));
    await expect(args.onApply).toHaveBeenCalled();
  },
};

export const Closed: Story = {
  args: {
    open: false,
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /tweaks/i }));
    await expect(args.onOpenChange).toHaveBeenCalledWith(true);
  },
};
