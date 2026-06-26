import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, waitFor } from "storybook/test";

import { Field } from "../Field";
import { CodeInput } from ".";

const meta = {
  title: "UI/CodeInput",
  component: CodeInput,
  args: {
    label: "Verification code",
  },
} satisfies Meta<typeof CodeInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Filled: Story = {
  args: {
    defaultValue: "234567",
  },
};

export const Interactive: Story = {
  args: {
    onValueChange: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    const first = canvas.getByRole("textbox", { name: /verification code digit 1/i });
    await userEvent.click(first);
    await userEvent.paste("123456");
    await expect(args.onValueChange).toHaveBeenLastCalledWith("123456");
    await waitFor(() =>
      expect(canvas.getByRole("textbox", { name: /verification code digit 6/i })).toHaveFocus(),
    );
  },
};

export const WithFieldError: Story = {
  render: () => (
    <div className="max-w-sm">
      <Field id="totp" label="Verification code" error="Code is expired.">
        {({ describedBy, invalid }) => (
          <CodeInput label="Verification code" aria-describedby={describedBy} invalid={invalid} />
        )}
      </Field>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("textbox", { name: /verification code digit 1/i }),
    ).toHaveAttribute("aria-invalid", "true");
    await expect(canvas.getByRole("alert")).toHaveTextContent(/expired/i);
  },
};
