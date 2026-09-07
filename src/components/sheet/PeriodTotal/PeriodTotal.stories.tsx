import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LazyMotion, domMax } from "motion/react";
import { useState } from "react";
import { expect } from "storybook/test";

import { Button } from "../../ui/Button";
import { PeriodTotal } from ".";

function Demo() {
  const [minutes, setMinutes] = useState(2_160);
  const hours = minutes / 60;

  return (
    <LazyMotion features={domMax}>
      <div className="grid justify-items-end gap-4">
        <PeriodTotal
          figure={String(hours)}
          unit="h"
          caption="this week"
          minutes={minutes}
          status={hours >= 40 ? { tone: "success", label: "on target" } : null}
        />
        <div className="flex gap-2">
          <Button type="button" variant="soft" size="sm" onClick={() => setMinutes((m) => m - 60)}>
            −1 h
          </Button>
          <Button type="button" variant="soft" size="sm" onClick={() => setMinutes((m) => m + 60)}>
            +1 h
          </Button>
        </div>
      </div>
    </LazyMotion>
  );
}

const meta = {
  title: "Sheet/PeriodTotal",
  component: PeriodTotal,
  parameters: { layout: "padded" },
  args: {
    figure: "36",
    unit: "h",
    caption: "this week",
    minutes: 2_160,
  },
} satisfies Meta<typeof PeriodTotal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One figure, one unit, one caption. The figure settles when it changes; it never rolls. */
export const Week: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "+1 h" }));
    await expect(canvas.getByText("37")).toBeInTheDocument();
  },
};

/** Status is icon + words, and only then colour. */
export const OverTarget: Story = {
  args: {
    figure: "8.5",
    caption: "today",
    minutes: 510,
    status: { tone: "warning", label: "over 8 h" },
  },
};

export const OnTarget: Story = {
  args: {
    figure: "8",
    caption: "today",
    minutes: 480,
    status: { tone: "success", label: "on target" },
  },
};

export const MonthWithWorkdays: Story = {
  args: {
    figure: "112",
    caption: "this month",
    minutes: 6_720,
    secondary: "14 of 22 workdays",
  },
};

/** The hours-and-minutes preference carries its own unit, so none is rendered after it. */
export const HoursAndMinutes: Story = {
  args: {
    figure: "36:30",
    unit: undefined,
    minutes: 2_190,
  },
};

export const WeekLight: Story = {
  globals: { theme: "light" },
};
