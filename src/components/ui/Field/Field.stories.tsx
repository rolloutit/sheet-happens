import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

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
      <Field id="project" label="Project" required hint="Choose the project for this entry.">
        {({ id, describedBy, required }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            required={required}
            placeholder="Internal tools"
          />
        )}
      </Field>
    </div>
  ),
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText(/project/i);
    await expect(input).toHaveAttribute("aria-describedby");
    await expect(input).toBeRequired();
  },
};

export const Error: Story = {
  args: {
    label: "Hours",
    children: null,
  },
  render: () => (
    <div className="max-w-md">
      <Field id="hours" label="Hours" required error="Hours must be between 0 and 24.">
        {({ id, describedBy, invalid, required }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            required={required}
            defaultValue="27"
          />
        )}
      </Field>
    </div>
  ),
  play: async ({ canvas }) => {
    const input = canvas.getByLabelText(/hours/i);
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(canvas.getByRole("alert")).toHaveTextContent(/between 0 and 24/i);
  },
};

export const TextArea: Story = {
  args: {
    label: "Description",
    children: null,
  },
  render: () => (
    <div className="max-w-md">
      <Field id="description" label="Description">
        {({ id }) => <Textarea id={id} placeholder="What did you work on?" />}
      </Field>
    </div>
  ),
};
