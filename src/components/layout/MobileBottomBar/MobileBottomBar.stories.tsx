import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BarChart3, CalendarDays, Clock3, LayoutDashboard } from "lucide-react";
import { useState } from "react";
import { expect } from "storybook/test";

import { MobileBottomBar } from ".";

const items = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "time", label: "Time", icon: Clock3 },
  { id: "timesheets", label: "Sheets", icon: CalendarDays, badge: 2 },
  { id: "reports", label: "Reports", icon: BarChart3 },
];

const meta = {
  title: "Layout/MobileBottomBar",
  component: MobileBottomBar,
  tags: ["autodocs"],
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
} satisfies Meta<typeof MobileBottomBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items,
    current: "time",
  },
  render: () => {
    const [current, setCurrent] = useState("time");

    return (
      <div className="min-h-48">
        <MobileBottomBar items={items} current={current} onNavigate={setCurrent} />
      </div>
    );
  },
  play: async ({ canvas, userEvent }) => {
    const reports = canvas.getByRole("button", { name: /reports/i });
    await userEvent.click(reports);
    await expect(reports).toHaveAttribute("aria-current", "page");
  },
};
