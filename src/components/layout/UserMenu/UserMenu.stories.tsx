import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, waitFor } from "storybook/test";

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

    const settings = await screen.findByRole("menuitem", { name: /settings/i });
    const signOut = screen.getByRole("menuitem", { name: /sign out/i });

    await expect(settings).toBeVisible();
    // The destructive action sits in its own group, one divider below the safe ones.
    await expect(settings.nextElementSibling).toHaveAttribute("role", "separator");
    await expect(settings.nextElementSibling).toBe(signOut.previousElementSibling);

    await userEvent.click(screen.getByRole("menuitem", { name: /my rates/i }));
    await expect(args.onAction).toHaveBeenCalledWith("my-rates");
  },
};

export const SignOutConfirmed: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /user menu/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /sign out/i }));

    const dialog = await screen.findByRole("dialog");
    // Selecting the item only asks; nothing has fired yet.
    await expect(args.onAction).not.toHaveBeenCalled();
    await expect(dialog).toHaveTextContent(/sign out\?/i);

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await expect(args.onAction).toHaveBeenCalledWith("sign-out");
  },
};

export const SignOutCancelled: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /user menu/i }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /sign out/i }));

    await screen.findByRole("dialog");
    await userEvent.click(screen.getByRole("button", { name: /stay signed in/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await expect(args.onAction).not.toHaveBeenCalled();
  },
};
