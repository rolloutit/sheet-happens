import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn } from "storybook/test";

import type { TimeEntryFormValue } from "./TimeEntryForm.types";
import { TimeEntryForm } from ".";

const projects = [
  { value: "apollo", label: "Apollo Migration", meta: "Contract" },
  { value: "helix", label: "Helix Support", meta: "Retainer" },
];

const meta = {
  title: "Sheet/TimeEntryForm",
  component: TimeEntryForm,
  tags: ["autodocs"],
  args: {
    projects,
    value: {
      projectId: "apollo",
      date: new Date("2026-06-24T00:00:00"),
      hours: 6,
      description: "Invoice reconciliation",
      billable: true,
    },
    onSubmit: fn(),
    onValueChange: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof TimeEntryForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [value, setValue] = useState<TimeEntryFormValue>({
      projectId: "apollo",
      date: new Date("2026-06-24T00:00:00"),
      hours: 6,
      description: "Invoice reconciliation",
      billable: true,
    });

    return (
      <TimeEntryForm
        {...args}
        value={value}
        onValueChange={(nextValue) => {
          setValue(nextValue);
          args.onValueChange?.(nextValue);
        }}
      />
    );
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.clear(canvas.getByLabelText(/hours/i));
    await userEvent.type(canvas.getByLabelText(/hours/i), "7.5");
    await expect(args.onValueChange).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: /save entry/i }));
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "apollo", hours: 7.5 }),
    );
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
