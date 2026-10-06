import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LazyMotion, domMax } from "motion/react";
import { expect, fn } from "storybook/test";

import { buildHeatWeeks, MonthHeatNavigator } from ".";
import type { HeatDay, HeatWeek } from "./MonthHeatNavigator.types";

/** September 2026, seen from the 16th: two full weeks logged, one forgotten Wednesday. */
const weeks = buildHeatWeeks({
  monthStart: "2026-09-01",
  todayIso: "2026-09-16",
  totals: [
    { isoDate: "2026-09-01", minutes: 390, entryCount: 2 },
    { isoDate: "2026-09-02", minutes: 480, entryCount: 1 },
    { isoDate: "2026-09-03", minutes: 480, entryCount: 3 },
    { isoDate: "2026-09-04", minutes: 300, entryCount: 1 },
    { isoDate: "2026-09-07", minutes: 510, entryCount: 2 },
    { isoDate: "2026-09-08", minutes: 120, entryCount: 1 },
    { isoDate: "2026-09-10", minutes: 480, entryCount: 2 },
    { isoDate: "2026-09-11", minutes: 240, entryCount: 1 },
    { isoDate: "2026-09-14", minutes: 480, entryCount: 2 },
    { isoDate: "2026-09-15", minutes: 420, entryCount: 2 },
  ],
});

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const longDate = (day: HeatDay) =>
  new Intl.DateTimeFormat("en", { dateStyle: "full", timeZone: "UTC" }).format(
    new Date(`${day.isoDate}T00:00:00Z`),
  );

const labels = {
  grid: "Days of September 2026",
  openWeek: (week: HeatWeek) => `Open week ${week.weekNumber}`,
  weekRow: (week: HeatWeek) => `W${week.weekNumber}`,
  cell: (day: HeatDay) => `${longDate(day)}, ${day.minutes / 60} hours`,
  empty: (day: HeatDay) => `${longDate(day)}, nothing logged`,
  future: (day: HeatDay) => `${longDate(day)}, in the future`,
  outside: (day: HeatDay) => `${longDate(day)}, outside this month`,
  detail: (day: HeatDay) => `${day.minutes / 60} h · ${day.entryCount} entries`,
  locked: "This month is locked by a submitted timesheet",
  legendLogged: "Logged",
  legendEmpty: "Nothing logged",
  legendFuture: "Future",
};

const meta = {
  title: "Sheet/MonthHeatNavigator",
  component: MonthHeatNavigator,
  parameters: { layout: "padded" },
  args: {
    weeks,
    weekdayLabels,
    selectedWeekStart: "2026-09-14",
    selectedDayIso: "2026-09-16",
    capacityMinutes: 480,
    formatMinutes: (minutes: number) => `${minutes / 60} h`,
    labels,
    onSelectDay: fn(),
    onSelectWeek: fn(),
  },
  decorators: [
    (Story) => (
      <LazyMotion features={domMax}>
        <div className="max-w-md rounded-[var(--radius-lg)] border border-border bg-card p-4">
          <Story />
        </div>
      </LazyMotion>
    ),
  ],
} satisfies Meta<typeof MonthHeatNavigator>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Four steps of the mint ramp, a hollow forgotten Wednesday, a ring on today, dotted future. */
export const September: Story = {
  play: async ({ args, canvas, userEvent }) => {
    const forgotten = canvas.getByRole("gridcell", {
      name: "Wednesday, September 9, 2026, nothing logged",
    });
    await userEvent.click(forgotten);
    await expect(args.onSelectDay).toHaveBeenCalledWith("2026-09-09");

    await userEvent.click(canvas.getByRole("button", { name: "Open week 37" }));
    await expect(args.onSelectWeek).toHaveBeenCalledWith("2026-09-07");

    // The arrows move between cells; they are not claimed anywhere else on /time.
    canvas.getByRole("gridcell", { name: /September 1, 2026/ }).focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("gridcell", { name: /September 2, 2026/ })).toHaveFocus();
  },
};

/** The rows draw in one after another on a scope change into the month. */
export const Drawing: Story = {
  args: { animate: true },
};

export const Locked: Story = {
  args: { locked: true, disabled: true },
};

export const SeptemberLight: Story = {
  globals: { theme: "light" },
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
