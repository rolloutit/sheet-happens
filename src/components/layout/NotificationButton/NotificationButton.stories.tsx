import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen } from "storybook/test";

import { NotificationButton } from ".";

const notifications = [
  {
    id: "missing-friday",
    title: "Friday is missing",
    body: "Lena Kovacs has no submitted hours for Friday.",
    time: "2 min",
    tone: "warning" as const,
  },
  {
    id: "invoice-ready",
    title: "Invoice ready",
    body: "Apollo Migration invoice is ready for review.",
    time: "1 h",
    tone: "info" as const,
    read: true,
  },
];

const meta = {
  title: "Layout/NotificationButton",
  component: NotificationButton,
  tags: ["autodocs"],
  args: {
    notifications,
    onNotificationSelect: fn(),
    onMarkAllRead: fn(),
    onViewAll: fn(),
  },
} satisfies Meta<typeof NotificationButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unread: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /notifications/i }));
    await expect(screen.getByRole("menu")).toBeVisible();
    await userEvent.click(screen.getByText(/friday is missing/i));
    await expect(args.onNotificationSelect).toHaveBeenCalledWith("missing-friday");
  },
};

export const Empty: Story = {
  args: {
    notifications: [],
    unreadCount: 0,
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /notifications/i }));
    await expect(screen.getByRole("status")).toHaveTextContent(/no notifications/i);
  },
};
