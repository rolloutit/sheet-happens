import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

import { Field } from "../Field";
import { Checkbox } from ".";

const meta = {
  title: "UI/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  argTypes: {
    disabled: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <label className="flex items-center gap-3 font-ui text-sm">
      <Checkbox id="default-checkbox" {...args} />
      Select row
    </label>
  ),
  play: async ({ canvas, userEvent }) => {
    const checkbox = canvas.getByRole("checkbox", { name: /select row/i });
    await userEvent.click(checkbox);
    await expect(checkbox).toBeChecked();
  },
};

export const Checked: Story = {
  render: () => (
    <label className="flex items-center gap-3 font-ui text-sm">
      <Checkbox id="checked-checkbox" defaultChecked />
      Submitted timesheets only
    </label>
  ),
};

export const Disabled: Story = {
  render: () => (
    <label className="flex items-center gap-3 font-ui text-sm text-muted-foreground">
      <Checkbox id="disabled-checkbox" disabled />
      Locked period
    </label>
  ),
};

export const States: Story = {
  render: () => (
    <div className="grid gap-4">
      <label className="flex items-center gap-3 font-ui text-sm">
        <Checkbox id="state-empty" />
        Empty
      </label>
      <label className="flex items-center gap-3 font-ui text-sm">
        <Checkbox id="state-checked" defaultChecked />
        Checked
      </label>
      <label className="flex items-center gap-3 font-ui text-sm text-muted-foreground">
        <Checkbox id="state-disabled" disabled />
        Disabled
      </label>
      <label className="flex items-center gap-3 font-ui text-sm text-muted-foreground">
        <Checkbox id="state-disabled-checked" defaultChecked disabled />
        Disabled checked
      </label>
    </div>
  ),
};

export const FieldIntegrated: Story = {
  render: () => (
    <Field label="Submitted timesheets only" hint="Filters the review queue to submitted rows.">
      {({ id, describedBy, invalid }) => (
        <Checkbox id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
      )}
    </Field>
  ),
  play: async ({ canvas, userEvent }) => {
    const checkbox = canvas.getByRole("checkbox", { name: /submitted timesheets only/i });
    await expect(checkbox).toHaveAccessibleDescription(/filters the review queue/i);
    await userEvent.click(checkbox);
    await expect(checkbox).toBeChecked();
  },
};
