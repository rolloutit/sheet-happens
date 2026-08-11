import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

import { Field } from "../Field";
import { TimeInput } from ".";

const meta = {
  title: "UI/TimeInput",
  component: TimeInput,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          'A styling wrapper around the native `<input type="time">`, not a picker. Time entry is the highest-frequency interaction in the app, and the native control keeps segmented keyboard entry, OS-chosen 12/24-hour display, and the mobile time wheel.',
      },
    },
  },
} satisfies Meta<typeof TimeInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { defaultValue: "09:30", "aria-label": "Start time" },
};

export const Interval: Story = {
  render: () => (
    <div className="grid w-80 grid-cols-2 gap-3">
      <Field label="Start" htmlFor="start">
        <TimeInput id="start" defaultValue="09:30" />
      </Field>
      <Field label="End" htmlFor="end">
        <TimeInput id="end" defaultValue="17:00" />
      </Field>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText("Start")).toHaveValue("09:30");
  },
};

export const Invalid: Story = {
  render: () => (
    <Field label="End" error="End must be after start.">
      {({ id, describedBy, invalid }) => (
        <TimeInput id={id} aria-describedby={describedBy} invalid={invalid} defaultValue="08:00" />
      )}
    </Field>
  ),
};

export const Disabled: Story = {
  args: { defaultValue: "09:30", disabled: true, "aria-label": "Start time" },
};
