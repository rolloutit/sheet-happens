import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, screen, waitFor } from "storybook/test";

import { Button } from "@/src/components/ui/Button";
import { Popover, PopoverContent, PopoverTrigger } from ".";

const meta = {
  title: "UI/Popover",
  component: Popover,
  tags: ["autodocs"],
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="soft">Open filters</Button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="grid gap-2">
          <p className="font-ui text-sm font-semibold">Filters</p>
          <p className="text-sm leading-6 text-muted-foreground">
            Popovers are used for compact menus, filter controls, and picker surfaces.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /open filters/i }));
    await expect(screen.getByText("Filters")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("Filters")).not.toBeInTheDocument());
    await expect(canvas.getByRole("button", { name: /open filters/i })).toHaveFocus();
  },
};

export const AlignStart: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost">Project picker</Button>
      </PopoverTrigger>
      <PopoverContent align="start">
        <div className="grid gap-2">
          <button className="rounded-[var(--radius-md)] px-2 py-1 text-left text-sm hover:bg-secondary">
            Internal tools
          </button>
          <button className="rounded-[var(--radius-md)] px-2 py-1 text-left text-sm hover:bg-secondary">
            Client portal
          </button>
        </div>
      </PopoverContent>
    </Popover>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /project picker/i }));
    const internalTools = screen.getByRole("button", { name: /internal tools/i });
    const clientPortal = screen.getByRole("button", { name: /client portal/i });
    await expect(internalTools).toBeVisible();
    await expect(internalTools).toHaveFocus();
    await userEvent.tab();
    await expect(clientPortal).toHaveFocus();
  },
};
