import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { FormMessage } from ".";

const meta = {
  title: "UI/FormMessage",
  component: FormMessage,
  tags: ["autodocs"],
} satisfies Meta<typeof FormMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tones: Story = {
  render: () => (
    <div className="grid gap-2">
      <FormMessage tone="hint">This field is optional.</FormMessage>
      <FormMessage tone="success">Saved automatically.</FormMessage>
      <FormMessage tone="error">Hours must be between 0 and 24.</FormMessage>
    </div>
  ),
};
