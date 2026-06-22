import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Lock } from "lucide-react";
import { expect, screen } from "storybook/test";

import { Button } from "@/src/components/ui/Button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from ".";

const meta = {
  title: "UI/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="soft" icon={Lock}>
            Locked action
          </Button>
        </TooltipTrigger>
        <TooltipContent>This action is locked after timesheet submission.</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.hover(canvas.getByRole("button", { name: /locked action/i }));
    const tooltipCopies = await screen.findAllByText(
      "This action is locked after timesheet submission.",
    );
    await expect(tooltipCopies[0]).toBeVisible();
  },
};

export const Side: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost">Why disabled?</Button>
        </TooltipTrigger>
        <TooltipContent side="right">Admins can reopen rejected periods.</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};
