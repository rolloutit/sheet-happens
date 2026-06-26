import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, screen } from "storybook/test";

import { Field } from "../Field";
import { Select } from ".";

const meta = {
  title: "UI/Select",
  component: Select,
  args: {
    label: "Status",
    placeholder: "Choose status",
    options: [
      { value: "submitted", label: "Submitted" },
      { value: "approved", label: "Approved" },
      { value: "paid", label: "Paid" },
    ],
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InField: Story = {
  render: (args) => (
    <Field id="status" label="Status" hint="Radix select for compact filters.">
      {({ id, describedBy }) => <Select {...args} id={id} aria-describedby={describedBy} />}
    </Field>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("combobox", { name: /status/i }));
    await expect(screen.getByRole("option", { name: /approved/i })).toBeVisible();
    await userEvent.click(screen.getByRole("option", { name: /approved/i }));
    await expect(canvas.getByRole("combobox", { name: /status/i })).toHaveTextContent(/approved/i);
  },
};

export const DisabledOption: Story = {
  args: {
    defaultValue: "submitted",
    options: [
      { value: "submitted", label: "Submitted" },
      { value: "approved", label: "Approved", disabled: true },
      { value: "paid", label: "Paid" },
    ],
  },
};
