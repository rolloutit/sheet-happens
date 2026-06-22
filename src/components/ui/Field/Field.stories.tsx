import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Input } from "@/src/components/ui/Input";
import { Textarea } from "@/src/components/ui/Textarea";
import { Field } from ".";

const meta = {
  title: "UI/Field",
  component: Field,
  tags: ["autodocs"],
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextInput: Story = {
  args: {
    label: "Project",
    children: null,
  },
  render: () => (
    <div className="max-w-md">
      <Field label="Project" htmlFor="project" required hint="Choose the project for this entry.">
        <Input id="project" placeholder="Internal tools" />
      </Field>
    </div>
  ),
};

export const Error: Story = {
  args: {
    label: "Hours",
    children: null,
  },
  render: () => (
    <div className="max-w-md">
      <Field label="Hours" htmlFor="hours" required error="Hours must be between 0 and 24.">
        <Input id="hours" invalid defaultValue="27" />
      </Field>
    </div>
  ),
};

export const TextArea: Story = {
  args: {
    label: "Description",
    children: null,
  },
  render: () => (
    <div className="max-w-md">
      <Field label="Description" htmlFor="description">
        <Textarea id="description" placeholder="What did you work on?" />
      </Field>
    </div>
  ),
};
