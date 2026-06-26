import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen } from "storybook/test";

import { PreferenceControls } from ".";

const timezoneOptions = [
  { value: "Europe/Budapest", label: "Europe/Budapest", meta: "Detected" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "America/New York" },
];

const meta = {
  title: "Sheet/PreferenceControls",
  component: PreferenceControls,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    timezoneValue: "Europe/Budapest",
    timezoneOptions,
    languageValue: "en",
  },
} satisfies Meta<typeof PreferenceControls>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Interactive: Story = {
  args: {
    onAvatarChange: fn(),
    onTimezoneChange: fn(),
    onLanguageChange: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /change/i }));
    await expect(args.onAvatarChange).toHaveBeenCalled();

    await userEvent.click(canvas.getByRole("combobox", { name: /timezone/i }));
    await userEvent.click(screen.getByRole("option", { name: /^utc$/i }));
    await expect(args.onTimezoneChange).toHaveBeenCalledWith("UTC");

    await userEvent.click(canvas.getByRole("radio", { name: /hu/i }));
    await expect(args.onLanguageChange).toHaveBeenCalledWith("hu");
  },
};
