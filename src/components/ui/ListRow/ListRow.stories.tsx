import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CalendarDays } from "lucide-react";
import { expect, fn } from "storybook/test";

import { Badge } from "../Badge";
import { ListRow } from ".";

const meta = {
  title: "UI/ListRow",
  component: ListRow,
  args: {
    leading: <CalendarDays className="size-5 text-accent" aria-hidden="true" />,
    title: "June 2026 timesheet",
    meta: "132.5 hours · EUR 8,945",
    trailing: <Badge tone="info">Submitted</Badge>,
  },
} satisfies Meta<typeof ListRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Clickable: Story = {
  args: {
    selected: true,
    actionLabel: "Open June 2026 timesheet",
    onClick: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    const row = canvas.getByRole("button", { name: /open june 2026 timesheet/i });
    await expect(row).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(row);
    await expect(args.onClick).toHaveBeenCalled();
  },
};
