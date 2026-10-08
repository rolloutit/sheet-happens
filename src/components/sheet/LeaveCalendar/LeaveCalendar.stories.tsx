import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { LeaveCalendar } from ".";
import { englishLabels, octoberHolidays, octoberLeaves } from "./LeaveCalendar.fixtures";

const meta = {
  title: "Sheet/LeaveCalendar",
  component: LeaveCalendar,
  parameters: { layout: "padded" },
  args: {
    monthStart: "2026-10-01",
    todayIso: "2026-10-08",
    leaves: octoberLeaves,
    holidays: octoberHolidays,
    locale: "en",
    labels: englishLabels,
    onSelectLeave: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-5xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LeaveCalendar>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * An employee's view: their own leave in colour on the top lane, colleagues hatched as "Away", a
 * morning and an afternoon sharing the 22nd, the 23rd in rose, a leave running into November.
 */
export const EmployeeView: Story = {
  play: async ({ args, canvas, userEvent }) => {
    const own = canvas.getByRole("button", { name: /^You, vacation, 2026-10-14/ });
    await userEvent.click(own);
    await expect(args.onSelectLeave).toHaveBeenCalledWith(
      expect.objectContaining({ id: "own-vacation" }),
    );
    await expect(canvas.getByText("National Day")).toBeVisible();
  },
};

/** The admin sees every kind; nothing is withheld. */
export const AdminView: Story = {
  args: {
    leaves: octoberLeaves.map((leave) => ({
      ...leave,
      isOwn: false,
      kind:
        leave.kind === "absent"
          ? leave.id === "colleague-long"
            ? "sick"
            : "vacation"
          : leave.kind,
    })),
  },
};

/** Four people away the same week stack into four lanes; the row grows rather than clipping. */
export const BusyWeek: Story = {
  args: {
    leaves: ["Anna", "Bence", "Csilla", "Dávid"].map((name, index) => ({
      id: `busy-${index}`,
      memberId: name,
      memberName: name,
      kind: "vacation" as const,
      dayPart: "FULL" as const,
      startDate: `2026-10-1${2 + index}`,
      endDate: "2026-10-16",
      workdays: 5 - index,
      isOwn: false,
    })),
  },
};

export const Empty: Story = {
  args: { leaves: [], holidays: [] },
};

export const Light: Story = {
  globals: { theme: "light" },
};

/** Below `md` the grid becomes an agenda of the days that hold something. */
export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
