import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { UserCircle } from "lucide-react";
import { expect, fn } from "storybook/test";

import { ProfileSettingsPanel } from ".";

const meta = {
  title: "Sheet/ProfileSettingsPanel",
  component: ProfileSettingsPanel,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    name: "Lena Kovacs",
    subtitle: "Contractor - EUR - Apollo Migration",
    fields: [
      { id: "email", label: "Email", value: "lena@example.com" },
      { id: "role", label: "Role", value: "Contractor" },
    ],
  },
} satisfies Meta<typeof ProfileSettingsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithAction: Story = {
  args: {
    action: {
      label: "Request change",
      icon: UserCircle,
      onClick: fn(),
    },
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /request change/i }));
    await expect(args.action?.onClick).toHaveBeenCalled();
  },
};
