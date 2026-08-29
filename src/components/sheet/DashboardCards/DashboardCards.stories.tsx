import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ArrowUpRight, BarChart3, Timer } from "lucide-react";
import { expect, fn } from "storybook/test";

import { DashboardCards } from ".";

const meta = {
  title: "Sheet/DashboardCards",
  component: DashboardCards,
  globals: {
    theme: "dark",
    locale: "hu",
  },
  args: {
    name: "Léna",
    role: "contractor",
  },
} satisfies Meta<typeof DashboardCards>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Contractor: Story = {};

export const Admin: Story = {
  args: {
    name: "Márta",
    role: "admin",
  },
};

export const DataDrivenAdmin: Story = {
  args: {
    name: "Noémi",
    role: "admin",
    summary: "3 critical contractor records need attention before month close.",
    primaryAction: {
      label: "Open approval queue",
      icon: ArrowUpRight,
      variant: "cta",
      onClick: fn(),
    },
    secondaryAction: {
      label: "Open utilization report",
      icon: BarChart3,
      variant: "soft",
      onClick: fn(),
    },
    stats: [
      {
        label: "Logged hours",
        value: "946h",
        icon: Timer,
        trend: { label: "+4%", direction: "up" },
        sparkline: [42, 48, 51, 56, 61, 68, 72],
      },
      {
        label: "Rejected rows",
        value: "8",
        tone: "danger",
        helperText: "Needs review",
        sparkline: [2, 4, 3, 7, 5, 8, 8],
      },
    ],
    flaggedUsers: [
      { id: "balazs", name: "Balázs Varga", detail: "missing 3 days", severity: "danger" },
      { id: "reka", name: "Réka Szabó", detail: "invoice missing", severity: "warning" },
    ],
    selectedFlaggedUserIds: ["balazs"],
    onFlaggedUserSelectionChange: fn(),
    onRemindFlaggedUsers: fn(),
    statusSegments: [
      { id: "approved", label: "Approved", value: 18, tone: "success" },
      { id: "waiting", label: "Waiting", value: 6, tone: "warning" },
      { id: "blocked", label: "Blocked", value: 2, tone: "danger" },
    ],
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /open approval queue/i }));
    await expect(args.primaryAction?.onClick).toHaveBeenCalled();

    await userEvent.click(canvas.getByRole("checkbox", { name: /select réka szabó/i }));
    await expect(args.onFlaggedUserSelectionChange).toHaveBeenCalledWith(["balazs", "reka"]);

    await userEvent.click(canvas.getByRole("button", { name: /emlékeztető küldése/i }));
    await expect(args.onRemindFlaggedUsers).toHaveBeenCalledWith(["balazs"]);
  },
};

/**
 * The same dashboard in the light theme — its own export because the meta pins `theme: "dark"` and
 * a story-level global outranks the toolbar and the URL alike.
 *
 * No `play`: the interactions are asserted once on `DataDrivenAdmin` and re-running them here would
 * buy nothing. This story exists for the pixels, and it is where most of the theme-dependent
 * treatments meet — the hero's mesh, both stat-card tones with their corner glows and sparklines,
 * the flagged-user severities, and the distribution meter's three signal fills.
 */
export const DataDrivenAdminLight: Story = {
  args: DataDrivenAdmin.args,
  globals: {
    theme: "light",
    locale: "hu",
  },
};
