import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Field } from "../Field";
import { Select } from ".";

const meta = {
  title: "UI/Select",
  component: Select,
  args: {
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
    <Field label="Status" hint="Native select for compact filters.">
      <Select {...args} />
    </Field>
  ),
};
