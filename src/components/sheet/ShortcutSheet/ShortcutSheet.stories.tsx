import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn } from "storybook/test";

import { Button } from "../../ui/Button";
import { ShortcutSheet } from ".";

const groups = [
  {
    id: "view",
    title: "View",
    rows: [
      { keys: ["1"], label: "Day" },
      { keys: ["2"], label: "Week" },
      { keys: ["3"], label: "Month" },
      { keys: ["−"], label: "Zoom out" },
      { keys: ["+"], label: "Zoom in" },
      { keys: ["Esc"], label: "Zoom out one step" },
      { keys: ["G"], label: "Grid layout of the week" },
    ],
  },
  {
    id: "move",
    title: "Move",
    rows: [
      { keys: ["K", "["], label: "Previous week" },
      { keys: ["J", "]"], label: "Next week" },
      { keys: ["T"], label: "Today" },
    ],
  },
  {
    id: "add",
    title: "Add",
    rows: [
      { keys: ["N"], label: "New entry on the selected day" },
      { keys: ["?"], label: "This sheet" },
      { keys: ["⌘K"], label: "Command palette" },
    ],
  },
  {
    id: "timer",
    title: "Timer",
    rows: [{ keys: ["S"], label: "Start or stop the timer" }],
  },
];

const labels = {
  title: "Keyboard shortcuts",
  description: "Every move on this page has a key. None of them fire while you type.",
  close: "Close",
  keyHeader: "Key",
  actionHeader: "Action",
};

function Demo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="soft" onClick={() => setOpen(true)}>
        Open shortcuts
      </Button>
      <ShortcutSheet open={open} onOpenChange={setOpen} groups={groups} labels={labels} />
    </>
  );
}

const meta = {
  title: "Sheet/ShortcutSheet",
  component: ShortcutSheet,
  args: {
    open: true,
    onOpenChange: fn(),
    groups,
    labels,
  },
} satisfies Meta<typeof ShortcutSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const FromTrigger: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Open shortcuts" }));
    const { screen } = await import("storybook/test");
    await expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    await expect(screen.getAllByRole("table")).toHaveLength(4);
  },
};

export const OpenLight: Story = {
  globals: { theme: "light" },
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
