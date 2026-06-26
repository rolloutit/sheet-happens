import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { Button } from "@/src/components/ui/Button";
import { ReviewActionBar } from ".";

const meta = {
  title: "Sheet/ReviewActionBar",
  component: ReviewActionBar,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    selectedCount: 2,
    onClear: fn(),
    onApprove: fn(),
    rejectAction: (
      <Button type="button" variant="danger">
        Bulk reject
      </Button>
    ),
  },
} satisfies Meta<typeof ReviewActionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByRole("region", { name: /admin review actions/i })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: /bulk approve/i }));
    await expect(args.onApprove).toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: /clear/i }));
    await expect(args.onClear).toHaveBeenCalled();
  },
};

export const Empty: Story = {
  args: {
    selectedCount: 0,
  },
};
