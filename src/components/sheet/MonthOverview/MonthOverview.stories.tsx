import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { MonthOverview } from ".";
import type { MonthOverviewProject } from "./MonthOverview.types";

/**
 * §8's own example month, September 2026: Atlas at 94 h, Internal Ops at 22 h.
 *
 * There is no loading story and no error story, and that is deliberate rather than an omission.
 * The month payload ships with the `/time` page for every month the visible week touches (§11), so
 * the level has nothing to fetch — which is exactly what lets a change into it stay a layout
 * animation. A spinner here would be a picture of a state the design rules out.
 */
const projects: MonthOverviewProject[] = [
  { projectId: "atlas", name: "Atlas Platform", color: "#37e3de", minutes: 5_640 },
  { projectId: "ops", name: "Internal Ops & Tooling", color: "#72df9a", minutes: 1_320 },
];

const labels = {
  trackedHeading: "Tracked in Sheet Happens",
  zoomToProject: (project: MonthOverviewProject) => `${project.name} · zoom in`,
  emptyTitle: "Nothing to close in this month",
  emptyDescription:
    "No hours were logged in this month, and no project is open in it to log any against.",
};

const meta = {
  title: "Sheet/MonthOverview",
  component: MonthOverview,
  args: {
    projects,
    locale: "en",
    durationDisplayFormat: "DECIMAL_HOURS",
    labels,
    onZoomToProject: fn(),
  },
} satisfies Meta<typeof MonthOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TrackedBand: Story = {
  play: async ({ args, canvas, userEvent }) => {
    // L4 → L3: pressing a row is the zoom, and the row says which project was being read.
    await userEvent.click(canvas.getByRole("button", { name: "Atlas Platform · zoom in" }));
    await expect(args.onZoomToProject).toHaveBeenCalledWith(projects[0]);
  },
};

/**
 * A project that is still live this month with nothing against it.
 *
 * The row a month close is actually for — invisible at every finer resolution, because a week you
 * never opened cannot tell you about a project you never logged.
 */
export const ForgottenProject: Story = {
  args: {
    projects: [
      ...projects,
      { projectId: "orion", name: "Orion Rollout", color: "#f2b8ff", minutes: 0 },
    ],
  },
};

/** Hours and minutes rather than decimal hours — the other duration preference. */
export const HoursAndMinutes: Story = {
  args: {
    durationDisplayFormat: "HOURS_MINUTES",
    projects: [
      { projectId: "atlas", name: "Atlas Platform", color: "#37e3de", minutes: 5_675 },
      { projectId: "ops", name: "Internal Ops & Tooling", color: "#72df9a", minutes: 1_345 },
    ],
  },
};

export const ManyProjects: Story = {
  args: {
    projects: Array.from({ length: 8 }, (_, index) => ({
      projectId: `project-${index}`,
      name:
        index % 3 === 0 ? `Consolidated Reporting Programme ${index + 1}` : `Project ${index + 1}`,
      color: ["#37e3de", "#72df9a", "#f2b8ff", "#ffd479"][index % 4],
      minutes: index === 5 ? 0 : (index + 1) * 480,
    })),
  },
};

/** No hours in the month and no project open in it to log any against. */
export const EmptyMonth: Story = {
  args: {
    projects: [],
  },
};

/** A pending mutation, which must not let a second navigation start on top of it. */
export const PendingMutation: Story = {
  args: {
    disabled: true,
  },
};

export const TrackedBandLight: Story = {
  globals: { theme: "light" },
};

/**
 * Rows survive a phone unchanged — one row per project is already the narrow shape, which is half
 * of why L4 is rows rather than cards. The project name truncates; the figure never does.
 */
export const MobileRows: Story = {
  args: {
    projects: [
      ...projects,
      {
        projectId: "orion",
        name: "Orion Rollout — phase two migration",
        color: "#f2b8ff",
        minutes: 0,
      },
    ],
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};
