import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BarChart3, Clock3, FolderKanban, UserRound } from "lucide-react";
import { expect, fn, screen } from "storybook/test";

import { Button } from "@/src/components/ui/Button";
import { CommandPalette } from ".";

const items = [
  {
    id: "time-entry",
    label: "Add time entry",
    description: "Open the entry form",
    group: "Actions",
    shortcut: "T",
    keywords: ["hours", "timesheet"],
    icon: Clock3,
  },
  {
    id: "apollo",
    label: "Apollo Migration",
    description: "Open project drawer",
    group: "Projects",
    icon: FolderKanban,
  },
  {
    id: "people-lena",
    label: "Lena Kovacs",
    description: "Contractor profile",
    group: "People",
    icon: UserRound,
  },
  {
    id: "reports",
    label: "Monthly report",
    description: "Go to reports",
    group: "Reports",
    icon: BarChart3,
  },
];

const meta = {
  title: "Layout/CommandPalette",
  component: CommandPalette,
  tags: ["autodocs"],
  args: {
    items,
    onSelect: fn(),
  },
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <CommandPalette
      {...args}
      trigger={
        <Button type="button" variant="soft">
          Open command palette
        </Button>
      }
    />
  ),
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /open command palette/i }));
    await userEvent.type(screen.getByRole("textbox", { name: /search commands/i }), "apollo");
    await userEvent.click(screen.getByRole("option", { name: /apollo migration/i }));
    await expect(args.onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "apollo" }));
  },
};

export const EmptySearch: Story = {
  args: {
    defaultOpen: true,
  },
  play: async ({ userEvent }) => {
    await userEvent.type(screen.getByRole("textbox", { name: /search commands/i }), "zzz");
    await expect(screen.getByRole("status")).toHaveTextContent(/no commands found/i);
  },
};
