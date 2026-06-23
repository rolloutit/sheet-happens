import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MoreHorizontal, Settings, User } from "lucide-react";

import { IconButton } from "../IconButton";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from ".";

const meta = {
  title: "UI/Dropdown",
  component: DropdownContent,
} satisfies Meta<typeof DropdownContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UserMenu: Story = {
  render: () => (
    <Dropdown>
      <DropdownTrigger asChild>
        <IconButton icon={MoreHorizontal} label="Open menu" />
      </DropdownTrigger>
      <DropdownContent align="end">
        <DropdownLabel>Account</DropdownLabel>
        <DropdownItem>
          <User className="size-4" aria-hidden="true" />
          Profile
        </DropdownItem>
        <DropdownItem>
          <Settings className="size-4" aria-hidden="true" />
          Settings
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem className="text-destructive">Sign out</DropdownItem>
      </DropdownContent>
    </Dropdown>
  ),
};
