import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "../Button";
import { Field } from "../Field";
import { Input } from "../Input";
import { FormSection } from ".";

const meta = {
  title: "UI/FormSection",
  component: FormSection,
  tags: ["autodocs"],
} satisfies Meta<typeof FormSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProfileSection: Story = {
  args: {
    title: "Profile",
    children: null,
  },
  render: () => (
    <FormSection
      title="Profile"
      description="User-facing identity details for invoices and reports."
      actions={<Button variant="soft">Save section</Button>}
      className="max-w-xl"
    >
      <Field id="profile-name" label="Name">
        {({ id }) => <Input id={id} defaultValue="Varga David" />}
      </Field>
      <Field id="profile-email" label="Email">
        {({ id }) => <Input id={id} type="email" defaultValue="david@example.com" />}
      </Field>
    </FormSection>
  ),
};
