import type { Meta, StoryObj } from "@storybook/nextjs-vite";

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
};
