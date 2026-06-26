import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Bell, ShieldCheck } from "lucide-react";
import { expect, fn } from "storybook/test";

import { NotificationPreferences } from ".";
import type { NotificationPreferenceItem } from ".";

const items = [
  {
    id: "weekly",
    label: "Weekly reminders",
    description: "Prompt users before the week closes.",
    enabled: true,
    icon: Bell,
  },
  {
    id: "month-end",
    label: "Month-end reminders",
    description: "Remind users before payroll lock.",
    enabled: false,
    icon: Bell,
  },
  {
    id: "workflow",
    label: "Workflow events",
    description: "Approval, rejection, upload, and payment events.",
    enabled: true,
    icon: ShieldCheck,
  },
] satisfies NotificationPreferenceItem[];

const meta = {
  title: "Sheet/NotificationPreferences",
  component: NotificationPreferences,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    items,
    cadenceValue: "fri",
  },
} satisfies Meta<typeof NotificationPreferences>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Interactive: Story = {
  args: {
    onPreferenceChange: fn(),
    onCadenceChange: fn(),
    onReset: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /reset/i }));
    await expect(args.onReset).toHaveBeenCalled();

    await userEvent.click(canvas.getByRole("switch", { name: /toggle month-end reminders/i }));
    await expect(args.onPreferenceChange).toHaveBeenCalledWith("month-end", true);

    await userEvent.click(canvas.getByRole("radio", { name: /mon/i }));
    await expect(args.onCadenceChange).toHaveBeenCalledWith("mon");
  },
};
