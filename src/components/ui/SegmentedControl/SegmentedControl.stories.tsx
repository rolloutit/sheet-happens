import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LayoutGrid, List } from "lucide-react";
import { LazyMotion, domMax } from "motion/react";
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

/**
 * The `/time` scope control: a thumb that travels rather than a pill that lights up, and each
 * segment carrying its key as a muted chip. Wrapped in the same feature boundary `/time` uses,
 * because the slide is a layout animation and does nothing without one.
 */
export const SlidingIndicator: Story = {
  render: () => {
    const [value, setValue] = useState("week");

    return (
      <LazyMotion features={domMax}>
        <SegmentedControl
          label="View"
          indicator="slide"
          indicatorId="story-scope-thumb"
          value={value}
          onValueChange={setValue}
          items={[
            { value: "day", label: "Day", shortcut: "1" },
            { value: "week", label: "Week", shortcut: "2" },
            { value: "month", label: "Month", shortcut: "3" },
          ]}
        />
      </LazyMotion>
    );
  },
  play: async ({ canvas, userEvent }) => {
    const week = canvas.getByRole("radio", { name: "Week" });
    const month = canvas.getByRole("radio", { name: "Month" });

    // The chip is decoration: the radio is still named by its label alone.
    await expect(week).toHaveAttribute("aria-checked", "true");
    await expect(week.querySelector("[data-indicator]")).not.toBeNull();

    await userEvent.click(month);

    await expect(month).toHaveAttribute("aria-checked", "true");
    await expect(month.querySelector("[data-indicator]")).not.toBeNull();
    await expect(week.querySelector("[data-indicator]")).toBeNull();
  },
};

export const IconSegments: Story = {
  render: () => {
    const [value, setValue] = useState("agenda");

    return (
      <SegmentedControl
        label="Week layout"
        size="sm"
        indicator="slide"
        value={value}
        onValueChange={setValue}
        items={[
          { value: "agenda", label: "Agenda", icon: List, shortcut: "G" },
          { value: "grid", label: "Grid", icon: LayoutGrid, shortcut: "G" },
        ]}
      />
    );
  },
};

export const SlidingIndicatorLight: Story = {
  ...SlidingIndicator,
  globals: { theme: "light" },
};
