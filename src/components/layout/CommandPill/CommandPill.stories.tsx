import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { CommandPill } from ".";

const meta = {
  title: "Layout/CommandPill",
  component: CommandPill,
  tags: ["autodocs"],
  args: {
    onClick: fn(),
  },
} satisfies Meta<typeof CommandPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Go anywhere...",
    shortcut: "Cmd+K",
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /go anywhere/i }));
    await expect(args.onClick).toHaveBeenCalled();
  },
};

export const Upcoming: Story = {
  args: {
    label: "Jump to contractor, project, or report...",
    shortcut: "Cmd+K",
    status: "Soon",
    disabled: true,
  },
};
