import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, within } from "storybook/test";

import { LeaveCalendar } from ".";
import {
  crowdedOctoberLeaves,
  englishLabels,
  octoberHolidays,
  octoberLeaves,
} from "./LeaveCalendar.fixtures";

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
    // The leave crosses a weekend, so it is two ribbons with one name; either one selects it.
    const [own] = canvas.getAllByRole("button", { name: /^You, vacation, 2026-10-14/ });
    await userEvent.click(own!);
    await expect(args.onSelectLeave).toHaveBeenCalledWith(
      expect.objectContaining({ id: "own-vacation" }),
    );
    // The grid comes before the narrow-screen agenda, which repeats the holiday name.
    await expect(canvas.getAllByText("National Day")[0]).toBeVisible();
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

/**
 * Twelve people off around the 23 October holiday. Each day from two people away carries its
 * headcount, amber from four; the week draws four lanes and lists the rest behind "+N more".
 */
export const CrowdedWeek: Story = {
  args: { leaves: crowdedOctoberLeaves },
};

/** The "+N more" button: its tooltip names who is hidden, its popover lists the whole day. */
export const CrowdedWeekOverflow: Story = {
  args: { leaves: crowdedOctoberLeaves },
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    const week = canvas.getByRole("listitem", { name: "Week 43" });
    const more = within(week).getAllByRole("button", { name: /^\+\d+ more$/ })[0]!;

    await userEvent.hover(more);
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByRole("tooltip")).toBeVisible();

    await userEvent.click(more);
    const day = await body.findByRole("dialog");
    await expect(day).toHaveTextContent(/^Away on \w+day, October \d+/);
    const [pick] = within(day).getAllByRole("button");
    await userEvent.click(pick!);
    await expect(args.onSelectLeave).toHaveBeenCalledOnce();
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
