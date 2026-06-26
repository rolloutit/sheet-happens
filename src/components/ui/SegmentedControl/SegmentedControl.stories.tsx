import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect } from "storybook/test";

import { SegmentedControl } from ".";

const meta = {
  title: "UI/SegmentedControl",
  component: SegmentedControl,
  args: {
    label: "Period",
    value: "week",
    items: [
      { value: "day", label: "Day" },
      { value: "week", label: "Week" },
    ],
  },
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState("week");

    return (
      <SegmentedControl
        label="Period"
        value={value}
        onValueChange={setValue}
        items={[
          { value: "day", label: "Day" },
          { value: "week", label: "Week", count: 5 },
          { value: "month", label: "Month" },
        ]}
      />
    );
  },
  play: async ({ canvas, userEvent }) => {
    const group = canvas.getByRole("radiogroup", { name: /period/i });
    const week = canvas.getByRole("radio", { name: /week/i });
    const month = canvas.getByRole("radio", { name: /month/i });

    await expect(group).toHaveAttribute("aria-orientation", "horizontal");
    await expect(week).toHaveAttribute("aria-checked", "true");
    week.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(month).toHaveAttribute("aria-checked", "true");
  },
};

export const DisabledItem: Story = {
  render: () => {
    const [value, setValue] = useState("active");

    return (
      <SegmentedControl
        label="Review filter"
        value={value}
        onValueChange={setValue}
        items={[
          { value: "active", label: "Active" },
          { value: "locked", label: "Locked", disabled: true },
          { value: "archived", label: "Archived" },
        ]}
      />
    );
  },
};

export const Vertical: Story = {
  render: () => {
    const [value, setValue] = useState("profile");

    return (
      <SegmentedControl
        label="Settings section"
        orientation="vertical"
        value={value}
        onValueChange={setValue}
        items={[
          { value: "profile", label: "Profile" },
          { value: "security", label: "Security" },
          { value: "notifications", label: "Notifications" },
        ]}
      />
    );
  },
  play: async ({ canvas, userEvent }) => {
    const profile = canvas.getByRole("radio", { name: /profile/i });
    profile.focus();
    await userEvent.keyboard("{ArrowDown}");
    await expect(canvas.getByRole("radio", { name: /security/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  },
};

export const FullWidthMobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
  render: () => {
    const [value, setValue] = useState("week");

    return (
      <SegmentedControl
        label="Mobile period"
        width="full"
        value={value}
        onValueChange={setValue}
        items={[
          { value: "day", label: "Day" },
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
        ]}
      />
    );
  },
};
