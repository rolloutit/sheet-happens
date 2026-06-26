import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Fingerprint, KeyRound, Mail, QrCode } from "lucide-react";
import { expect, fn } from "storybook/test";

import { SecurityMethodList } from ".";
import type { SecurityMethod } from ".";

const methods = [
  {
    id: "password",
    label: "Password",
    description: "Used for email sign-in.",
    state: "set",
    icon: KeyRound,
    actionLabel: "Change",
  },
  {
    id: "google",
    label: "Google",
    description: "Connected single sign-on provider.",
    state: "connected",
    icon: Mail,
    actionLabel: "Manage",
  },
  {
    id: "totp",
    label: "TOTP",
    description: "Use an authenticator app for 2FA.",
    state: "not_enabled",
    icon: QrCode,
    actionLabel: "Enable",
  },
  {
    id: "passkeys",
    label: "Passkeys",
    description: "Fast device-bound sign-in.",
    state: "recommended",
    icon: Fingerprint,
    actionLabel: "Add",
  },
] satisfies SecurityMethod[];

const meta = {
  title: "Sheet/SecurityMethodList",
  component: SecurityMethodList,
  globals: {
    theme: "dark",
    locale: "hu",
  },
  args: {
    methods,
  },
} satisfies Meta<typeof SecurityMethodList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Interactive: Story = {
  args: {
    onMethodAction: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /enable/i }));
    await expect(args.onMethodAction).toHaveBeenCalledWith(methods[2]);
  },
};
