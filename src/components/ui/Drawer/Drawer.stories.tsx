import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, screen, waitFor } from "storybook/test";

import { Button } from "../Button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from ".";

const meta = {
  title: "UI/Drawer",
  component: DrawerContent,
} satisfies Meta<typeof DrawerContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ProjectDrawer: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="soft">Open drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-xl font-semibold">Apollo Migration</DrawerTitle>
          <DrawerDescription className="text-sm text-muted-foreground">
            Project settings, members, timeline, and rate sources.
          </DrawerDescription>
        </DrawerHeader>
        <div className="rounded-[var(--radius-lg)] border border-border bg-card p-4 text-sm text-muted-foreground">
          Drawer content area
        </div>
        <DrawerFooter>
          <Button variant="ghost">Cancel</Button>
          <Button variant="cta">Save changes</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /open drawer/i }));
    await expect(screen.getByRole("dialog")).toBeVisible();
    await expect(screen.getByText(/drawer content area/i)).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(canvas.getByRole("button", { name: /open drawer/i })).toHaveFocus();
  },
};

export const BottomDrawer: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="soft">Open bottom drawer</Button>
      </DrawerTrigger>
      <DrawerContent side="bottom">
        <DrawerHeader>
          <DrawerTitle className="text-xl font-semibold">Bulk action</DrawerTitle>
          <DrawerDescription className="text-sm text-muted-foreground">
            Confirm the selected timesheet actions.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <Button variant="ghost">Cancel</Button>
          <Button variant="cta">Apply</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
};

export const LeftDrawer: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="soft">Open left drawer</Button>
      </DrawerTrigger>
      <DrawerContent side="left">
        <DrawerHeader>
          <DrawerTitle className="text-xl font-semibold">Navigation</DrawerTitle>
          <DrawerDescription className="text-sm text-muted-foreground">
            A left-side drawer variant for mobile navigation.
          </DrawerDescription>
        </DrawerHeader>
        <div className="rounded-[var(--radius-lg)] border border-border bg-card p-4 text-sm text-muted-foreground">
          Left drawer content
        </div>
      </DrawerContent>
    </Drawer>
  ),
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /open left drawer/i }));
    await expect(screen.getByRole("dialog")).toBeVisible();
    await expect(screen.getByText(/left drawer content/i)).toBeVisible();
  },
};
