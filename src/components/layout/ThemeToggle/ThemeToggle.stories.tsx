import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, screen } from "storybook/test";

import { ThemeToggle } from ".";

const meta = {
  title: "Layout/ThemeToggle",
  component: ThemeToggle,
  tags: ["autodocs"],
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /theme/i }));

    const menu = await screen.findByRole("menu");
    await expect(menu).toBeVisible();

    // Assert on the control's own state, not on documentElement: `test-storybook` runs stories in
    // a single page, so the class is shared with every story that follows.
    await userEvent.click(screen.getByRole("menuitemradio", { name: /light/i }));

    await userEvent.click(canvas.getByRole("button", { name: /theme/i }));
    await expect(screen.getByRole("menuitemradio", { name: /light/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    // Leave the shared page on the toolbar default so the next story starts clean.
    await userEvent.click(screen.getByRole("menuitemradio", { name: /dark/i }));
  },
};

export const Ghost: Story = {
  args: {
    variant: "ghost",
  },
};

export const Small: Story = {
  args: {
    size: "sm",
  },
};
