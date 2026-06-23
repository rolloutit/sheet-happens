import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SettingsPanels } from ".";

const meta = {
  title: "Sheet/SettingsPanels",
  component: SettingsPanels,
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
