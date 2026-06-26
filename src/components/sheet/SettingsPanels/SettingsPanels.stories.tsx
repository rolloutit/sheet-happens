import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, within } from "storybook/test";

import { SettingsPanels } from ".";

const meta = {
  title: "Sheet/SettingsPanels",
  component: SettingsPanels,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    section: "profile",
  },
} satisfies Meta<typeof SettingsPanels>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Profile: Story = {};

export const Security: Story = {
  args: {
    section: "security",
  },
};

export const Notifications: Story = {
  args: {
    section: "notifications",
  },
};

export const Preferences: Story = {
  args: {
    section: "preferences",
  },
};

export const DataDrivenSecurity: Story = {
  args: {
    section: "security",
    onSectionChange: fn(),
    onSecurityMethodAction: fn(),
    totp: {
      onConfirm: fn(),
    },
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /preferences/i }));
    await expect(args.onSectionChange).toHaveBeenCalledWith("preferences");

    await userEvent.click(canvas.getByRole("button", { name: /^enable$/i }));
    await expect(args.onSecurityMethodAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: "totp" }),
    );

    await userEvent.click(canvas.getByRole("button", { name: /enable totp/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/6 digit code/i), "654321");
    await userEvent.click(within(dialog).getByRole("button", { name: /verify/i }));
    await expect(args.totp?.onConfirm).toHaveBeenCalledWith("654321");
  },
};

export const DataDrivenNotifications: Story = {
  args: {
    section: "notifications",
    notifications: {
      items: [
        { id: "weekly", label: "Weekly reminders", enabled: true },
        { id: "month-end", label: "Month-end reminders", enabled: false },
      ],
      onPreferenceChange: fn(),
      onCadenceChange: fn(),
      onReset: fn(),
    },
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("switch", { name: /toggle month-end reminders/i }));
    await expect(args.notifications?.onPreferenceChange).toHaveBeenCalledWith("month-end", true);

    await userEvent.click(canvas.getByRole("radio", { name: /mon/i }));
    await expect(args.notifications?.onCadenceChange).toHaveBeenCalledWith("mon");
  },
};
