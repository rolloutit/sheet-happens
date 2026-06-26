import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Plus } from "lucide-react";
import { expect, fn } from "storybook/test";

import { ChipButton } from ".";

const meta = {
  title: "UI/ChipButton",
  component: ChipButton,
  args: {
    children: "Project Apollo",
  },
} satisfies Meta<typeof ChipButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <ChipButton>Project Apollo</ChipButton>
      <ChipButton selected>Selected filter</ChipButton>
      <ChipButton variant="dashed" leading={<Plus className="size-3" aria-hidden="true" />}>
        Add project
      </ChipButton>
      <ChipButton variant="warning">Missing rate</ChipButton>
      <ChipButton removable>Design team</ChipButton>
    </div>
  ),
};

export const Removable: Story = {
  args: {
    children: "Design team",
    selected: true,
    removeLabel: "Remove Design team",
    onRemove: fn(),
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /remove design team/i }));
    await expect(args.onRemove).toHaveBeenCalled();
  },
};
