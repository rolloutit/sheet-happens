import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen } from "storybook/test";

import { UserMenu } from ".";

const meta = {
  title: "Layout/UserMenu",
  component: UserMenu,
  tags: ["autodocs"],
  args: {
    user: {
      name: "Varga David",
      email: "david@example.com",
      role: "Admin",
      initials: "VD",
    },
    onAction: fn(),
  },
} satisfies Meta<typeof UserMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /user menu/i }));
    await expect(screen.getByRole("menuitem", { name: /settings/i })).toBeVisible();
    await userEvent.click(screen.getByRole("menuitem", { name: /sign out/i }));
    await expect(args.onAction).toHaveBeenCalledWith("sign-out");
  },
};
