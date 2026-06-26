import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { InfoPageEditor } from ".";

const value = {
  title: "Contractor handbook",
  slug: "contractor-handbook",
  status: "draft" as const,
  body: "# Welcome\nUse this page for rollout notes.\n\n## Timesheets\n- Submit by the last workday.\n- Upload invoices after approval.",
};

const meta = {
  title: "Sheet/InfoPageEditor",
  component: InfoPageEditor,
  tags: ["autodocs"],
  args: {
    value,
    onValueChange: fn(),
    onSave: fn(),
    onPublish: fn(),
  },
} satisfies Meta<typeof InfoPageEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.clear(canvas.getByLabelText(/^title$/i));
    await userEvent.type(canvas.getByLabelText(/^title$/i), "Updated handbook");
    await expect(args.onValueChange).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: /save draft/i }));
    await expect(args.onSave).toHaveBeenCalled();
  },
};

export const Preview: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("tab", { name: /preview/i }));
    await expect(canvas.getByRole("heading", { name: /contractor handbook/i })).toBeVisible();
  },
};
