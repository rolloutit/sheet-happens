import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen } from "storybook/test";

import { TimeBreakdownDialog } from ".";

const rows = [
  {
    id: "apollo",
    label: "Apollo Migration",
    hours: 28,
    amount: "EUR 2,240",
    tone: "success" as const,
  },
  { id: "helix", label: "Helix Support", hours: 6, amount: "EUR 420" },
  { id: "admin", label: "Internal admin", hours: 2, tone: "warning" as const },
];

const meta = {
  title: "Sheet/TimeBreakdownDialog",
  component: TimeBreakdownDialog,
  tags: ["autodocs"],
  args: {
    rows,
    totalAmount: "EUR 2,660",
    onExport: fn(),
  },
} satisfies Meta<typeof TimeBreakdownDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /view breakdown/i }));
    await expect(screen.getByRole("dialog")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: /export/i }));
    await expect(args.onExport).toHaveBeenCalled();
  },
};
