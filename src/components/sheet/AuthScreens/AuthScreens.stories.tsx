import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

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

export const SignIn: Story = {
  args: {
    onSignIn: fn(),
    onMagicLink: fn(),
    onResetPassword: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText(/^password$/i), "CorrectHorse7!");
    await userEvent.click(canvas.getByRole("button", { name: /^sign in$/i }));
    await expect(args.onSignIn).toHaveBeenCalledWith({
      email: "lena@example.com",
      password: "CorrectHorse7!",
    });

    await userEvent.click(canvas.getByRole("button", { name: /email me a sign-in link/i }));
    await expect(args.onMagicLink).toHaveBeenCalledWith("lena@example.com");

    await userEvent.click(canvas.getByRole("button", { name: /^forgot\?$/i }));
    await expect(args.onResetPassword).toHaveBeenCalledWith("lena@example.com");
  },
};

export const TwoFactor: Story = {
  args: {
    mode: "two-factor",
    onVerifyCode: fn(),
    onVerificationModeChange: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("radio", { name: /backup code/i }));
    await expect(args.onVerificationModeChange).toHaveBeenCalledWith("backup_code");

    await userEvent.click(canvas.getByRole("textbox", { name: /verification code digit 1/i }));
    await userEvent.paste("222456");
    await userEvent.click(canvas.getByRole("button", { name: /verify code/i }));
    await expect(args.onVerifyCode).toHaveBeenCalledWith("222456", "backup_code");
  },
};

export const Invite: Story = {
  args: {
    mode: "invite",
    onInvitePasswordSetup: fn(),
    onInviteGoogle: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /set up password/i }));
    await expect(args.onInvitePasswordSetup).toHaveBeenCalled();

    await userEvent.click(canvas.getByRole("button", { name: /continue with google/i }));
    await expect(args.onInviteGoogle).toHaveBeenCalled();
  },
};

export const PasswordSetup: Story = {
  args: {
    mode: "password-setup",
    onPasswordSave: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByRole("progressbar", { name: /password strength/i })).toHaveAttribute(
      "aria-valuenow",
      "4",
    );
    await userEvent.click(canvas.getByRole("button", { name: /save password/i }));
    await expect(args.onPasswordSave).toHaveBeenCalledWith({ password: "CorrectHorse7!" });
  },
};

export const Passkey: Story = {
  args: {
    mode: "passkey",
    onPasskeySetup: fn(),
    onPasskeySkip: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /set up passkey/i }));
    await expect(args.onPasskeySetup).toHaveBeenCalled();

    await userEvent.click(canvas.getByRole("button", { name: /skip for now/i }));
    await expect(args.onPasskeySkip).toHaveBeenCalled();
  },
};

export const ResetSent: Story = {
  args: {
    mode: "reset-sent",
    onBackToSignIn: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByText(/we sent instructions/i)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: /back to sign in/i }));
    await expect(args.onBackToSignIn).toHaveBeenCalled();
  },
};

export const Done: Story = {
  args: {
    mode: "done",
    onContinue: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /continue to dashboard/i }));
    await expect(args.onContinue).toHaveBeenCalled();
  },
};
