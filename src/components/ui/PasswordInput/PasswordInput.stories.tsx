import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { Field } from "../Field";
import { PasswordInput } from ".";

const meta = {
  title: "UI/PasswordInput",
  component: PasswordInput,
  args: {
    placeholder: "Password",
  },
} satisfies Meta<typeof PasswordInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ToggleVisibility: Story = {
  args: {
    defaultValue: "correct horse battery staple",
    onVisibilityChange: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    const input = canvas.getByDisplayValue("correct horse battery staple");
    await expect(input).toHaveAttribute("type", "password");
    await userEvent.click(canvas.getByRole("button", { name: /show password/i }));
    await expect(input).toHaveAttribute("type", "text");
    await expect(args.onVisibilityChange).toHaveBeenCalledWith(true);
  },
};

export const WithFieldError: Story = {
  render: () => (
    <div className="max-w-md">
      <Field id="password" label="Password" error="Password is required.">
        {({ id, describedBy, invalid }) => (
          <PasswordInput id={id} aria-describedby={describedBy} invalid={invalid} />
        )}
      </Field>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText(/^password$/i)).toHaveAttribute("aria-invalid", "true");
    await expect(canvas.getByRole("alert")).toHaveTextContent(/required/i);
  },
};
