import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, waitFor } from "storybook/test";

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
    // The menu is a Radix portal: it mounts a tick after the click, so a one-shot `getBy*` can
    // read the DOM before it lands. Clicking the `menuitem` rather than the text inside it also
    // keeps the locator on the element that actually owns `onSelect`.
    await expect(await screen.findByRole("menu")).toBeVisible();
    await userEvent.click(await screen.findByRole("menuitem", { name: /friday is missing/i }));

    // Selecting an unread notification awaits a PATCH to /api/notifications before it calls back,
    // and that request has no handler in Storybook — it has to fail first. How long that takes
    // depends on how loaded the run is, so the assertion has to retry rather than read the spy
    // once: this passed in isolation and failed in the full suite.
    await waitFor(() => expect(args.onNotificationSelect).toHaveBeenCalledWith("missing-friday"));
  },
};

export const Empty: Story = {
  args: {
    notifications: [],
    unreadCount: 0,
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /notifications/i }));
    await expect(await screen.findByRole("status")).toHaveTextContent(/no notifications/i);
  },
};
