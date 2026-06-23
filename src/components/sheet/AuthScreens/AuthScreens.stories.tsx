import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AuthScreens } from ".";

const meta = {
  title: "Sheet/AuthScreens",
  component: AuthScreens,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    mode: "sign-in",
  },
} satisfies Meta<typeof AuthScreens>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignIn: Story = {};

export const TwoFactor: Story = {
  args: {
    mode: "two-factor",
  },
};

export const PasswordSetup: Story = {
  args: {
    mode: "password-setup",
  },
};

export const Done: Story = {
  args: {
    mode: "done",
  },
};
