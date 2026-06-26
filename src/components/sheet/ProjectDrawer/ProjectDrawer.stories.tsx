import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, within } from "storybook/test";

import { ProjectDrawer } from ".";

const project = {
  id: "apollo",
  name: "Apollo Migration",
  description: "Client delivery · Active",
  active: true,
  dateRange: "Jan 2026 to Dec 2026",
  tags: ["Frontend", "Backend", "+3 more"],
  members: [
    { id: "1", name: "Lena Kovacs" },
    { id: "2", name: "Mark Chen" },
  ],
  notes: "Migration squad with mixed rate sources.",
  rateSource: "Project override",
};

const meta = {
  title: "Sheet/ProjectDrawer",
  component: ProjectDrawer,
  globals: {
    theme: "light",
    locale: "hu",
  },
  args: {
    project,
    onActiveChange: fn(),
    onSave: fn(),
  },
} satisfies Meta<typeof ProjectDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /open project/i }));
    const dialog = await screen.findByRole("dialog", { name: /apollo migration/i });
    await expect(within(dialog).getByText(/project override/i)).toBeVisible();
    await userEvent.click(within(dialog).getByRole("switch", { name: /active project/i }));
    await expect(args.onActiveChange).toHaveBeenCalledWith(false);
    await userEvent.click(within(dialog).getByRole("button", { name: /save changes/i }));
    await expect(args.onSave).toHaveBeenCalledWith(project);
  },
};

export const Inactive: Story = {
  args: {
    project: {
      ...project,
      active: false,
      name: "Helix Support",
      rateSource: "Central rate",
    },
  },
};
