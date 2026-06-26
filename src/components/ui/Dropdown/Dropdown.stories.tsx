import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MoreHorizontal, Settings, User } from "lucide-react";
import { useState } from "react";
import { expect, screen, waitFor } from "storybook/test";

import { IconButton } from "../IconButton";
import {
  Dropdown,
  DropdownCheckboxItem,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownRadioGroup,
  DropdownRadioItem,
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
        <DropdownItem tone="danger">Sign out</DropdownItem>
      </DropdownContent>
    </Dropdown>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /open menu/i }));
    await expect(screen.getByRole("menu")).toBeVisible();
    await expect(screen.getByRole("menuitem", { name: /profile/i })).toBeVisible();
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    await expect(canvas.getByRole("button", { name: /open menu/i })).toHaveFocus();
  },
};

export const CheckboxAndRadioItems: Story = {
  render: () => {
    const [showArchived, setShowArchived] = useState(false);
    const [density, setDensity] = useState("comfortable");

    return (
      <Dropdown>
        <DropdownTrigger asChild>
          <IconButton icon={MoreHorizontal} label="Open table options" />
        </DropdownTrigger>
        <DropdownContent align="end">
          <DropdownLabel>Table options</DropdownLabel>
          <DropdownCheckboxItem
            checked={showArchived}
            onCheckedChange={setShowArchived}
            onSelect={(event) => event.preventDefault()}
          >
            Show archived
          </DropdownCheckboxItem>
          <DropdownSeparator />
          <DropdownRadioGroup value={density} onValueChange={setDensity}>
            <DropdownRadioItem value="compact" onSelect={(event) => event.preventDefault()}>
              Compact
            </DropdownRadioItem>
            <DropdownRadioItem value="comfortable" onSelect={(event) => event.preventDefault()}>
              Comfortable
            </DropdownRadioItem>
          </DropdownRadioGroup>
        </DropdownContent>
      </Dropdown>
    );
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /open table options/i }));
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: /show archived/i }));
    await expect(screen.getByRole("menuitemcheckbox", { name: /show archived/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await userEvent.click(screen.getByRole("menuitemradio", { name: /compact/i }));
    await expect(screen.getByRole("menuitemradio", { name: /compact/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  },
};
