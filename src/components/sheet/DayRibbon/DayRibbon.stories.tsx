import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LazyMotion, domMax } from "motion/react";
import { useState } from "react";
import { expect, fn } from "storybook/test";

import { DayRibbon } from ".";
import type { DayColumnHeaderDay } from "../DayColumnHeader";

const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** The design doc's own example week, which spans two months: Aug 31 - Sep 6, 2026. */
const days: DayColumnHeaderDay[] = [
  "2026-08-31",
  "2026-09-01",
  "2026-09-02",
  "2026-09-03",
  "2026-09-04",
  "2026-09-05",
  "2026-09-06",
].map((isoDate, index) => ({
  isoDate,
  label: dayNames[index],
  shortLabel: dayNames[index].slice(0, 3),
  dayNumber: String(Number.parseInt(isoDate.slice(8), 10)),
  state: index === 2 ? "today" : index > 2 ? "future" : "normal",
  locked: false,
  totalMinutes: [510, 390, 480, 480, 300, 0, 0][index],
}));

const labels = {
  group: "Days of this week",
  selectDay: (day: DayColumnHeaderDay) => `Select ${day.label}`,
  capacity: (day: DayColumnHeaderDay) => `${day.totalMinutes / 60} h of 8 h`,
  over: "over 8 h",
  locked: "Locked by a submitted timesheet",
  today: "Today",
};

function Demo({ orientation }: { orientation?: "horizontal" | "vertical" }) {
  const [selected, setSelected] = useState("2026-09-02");

  return (
    <LazyMotion features={domMax}>
      <DayRibbon
        days={days}
        selectedDayIso={selected}
        capacityMinutes={480}
        orientation={orientation}
        formatMinutes={(minutes) => `${minutes / 60} h`}
        labels={labels}
        onSelectDay={setSelected}
      />
    </LazyMotion>
  );
}

const meta = {
  title: "Sheet/DayRibbon",
  component: DayRibbon,
  parameters: { layout: "padded" },
  args: {
    days,
    selectedDayIso: "2026-09-02",
    capacityMinutes: 480,
    formatMinutes: (minutes: number) => `${minutes / 60} h`,
    labels,
    onSelectDay: fn(),
  },
} satisfies Meta<typeof DayRibbon>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Seven chips, one pressed; the selection is a thumb that travels. */
export const Week: Story = {
  render: () => <Demo />,
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole("button", { name: "Select Wednesday" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Select Friday" }));
    await expect(canvas.getByRole("button", { name: "Select Friday" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(canvas.getAllByRole("button", { pressed: true })).toHaveLength(1);
  },
};

export const Vertical: Story = {
  render: () => <Demo orientation="vertical" />,
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

export const Locked: Story = {
  args: {
    days: days.map((day) => ({ ...day, locked: true })),
  },
};

export const WeekLight: Story = {
  render: () => <Demo />,
  globals: { theme: "light" },
};

/** On a phone the chips scroll and the selected one snaps to centre. */
export const Mobile: Story = {
  render: () => <Demo />,
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
