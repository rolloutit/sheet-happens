import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { MonthRow } from ".";

const meta = {
  title: "Sheet/MonthRow",
  component: MonthRow,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    month: "June 2026",
    meta: "132.5h · EUR 8,945",
    status: "submitted",
  },
} satisfies Meta<typeof MonthRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Clickable: Story = {
  args: {
    actionLabel: "Open June 2026 timesheet",
    onClick: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /open june 2026 timesheet/i }));
    await expect(args.onClick).toHaveBeenCalled();
  },
};
