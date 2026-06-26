import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, within } from "storybook/test";

import { SubmitTimesheetDialog } from ".";

const meta = {
  title: "Sheet/SubmitTimesheetDialog",
  component: SubmitTimesheetDialog,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    details: "132.5 hours · EUR 8,945 estimated amount",
    onConfirm: fn(),
  },
} satisfies Meta<typeof SubmitTimesheetDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /submit timesheet/i }));
    const dialog = await screen.findByRole("dialog", { name: /submit timesheet/i });
    await expect(dialog).toBeVisible();
    await userEvent.click(within(dialog).getByRole("button", { name: /submit timesheet/i }));
    await expect(args.onConfirm).toHaveBeenCalled();
  },
};
