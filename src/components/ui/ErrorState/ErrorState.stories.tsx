import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Button } from "../Button";
import { ErrorState } from ".";

const meta = {
  title: "UI/ErrorState",
  component: ErrorState,
  args: {
    title: "Report export failed",
    message: "The document could not be generated. Try again or contact an administrator.",
    code: "EXP-502",
  },
} satisfies Meta<typeof ErrorState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    action: <Button variant="soft">Retry</Button>,
  },
};

export const Warning: Story = {
  args: {
    tone: "warning",
    title: "Future entries detected",
    message: "Some rows are in the future and will be locked until the date arrives.",
  },
};
