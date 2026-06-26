import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

import { Field } from "../Field";
import { Switch } from ".";

const meta = {
  title: "UI/Switch",
  component: Switch,
  tags: ["autodocs"],
  argTypes: {
    disabled: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <label className="flex items-center gap-3 font-ui text-sm">
      <Switch aria-label="Project active" {...args} />
      Project active
    </label>
  ),
  play: async ({ canvas, userEvent }) => {
    const toggle = canvas.getByRole("switch", { name: /project active/i });
    await userEvent.click(toggle);
    await expect(toggle).toBeChecked();
  },
};

export const On: Story = {
  render: () => (
    <label className="flex items-center gap-3 font-ui text-sm">
      <Switch aria-label="Weekly reminder" defaultChecked />
      Weekly reminder
    </label>
  ),
};

export const Disabled: Story = {
  render: () => (
    <label className="flex items-center gap-3 font-ui text-sm text-muted-foreground">
      <Switch aria-label="Locked notification rule" disabled />
      Locked notification rule
    </label>
  ),
};

export const States: Story = {
  render: () => (
    <div className="grid gap-4">
      <label className="flex items-center gap-3 font-ui text-sm">
        <Switch aria-label="Off state" />
        Off
      </label>
      <label className="flex items-center gap-3 font-ui text-sm">
        <Switch aria-label="On state" defaultChecked />
        On
      </label>
      <label className="flex items-center gap-3 font-ui text-sm text-muted-foreground">
        <Switch aria-label="Disabled off state" disabled />
        Disabled off
      </label>
      <label className="flex items-center gap-3 font-ui text-sm text-muted-foreground">
        <Switch aria-label="Disabled on state" defaultChecked disabled />
        Disabled on
      </label>
    </div>
  ),
};

export const FieldIntegrated: Story = {
  render: () => (
    <Field label="Weekly reminder" hint="Sends a reminder before Friday close.">
      {({ id, describedBy, invalid }) => (
        <Switch id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
      )}
    </Field>
  ),
  play: async ({ canvas, userEvent }) => {
    const toggle = canvas.getByRole("switch", { name: /weekly reminder/i });
    await expect(toggle).toHaveAccessibleDescription(/before friday close/i);
    await userEvent.click(toggle);
    await expect(toggle).toBeChecked();
  },
};
