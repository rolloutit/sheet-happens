import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { MonthOverview } from ".";
import type { MonthOverviewDeclaredProject, MonthOverviewProject } from "./MonthOverview.types";

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

/** §8's declared row: 52 h against Nimbus, with the proof beside it. */
const declared: MonthOverviewDeclaredProject[] = [
  {
    projectId: "nimbus",
    name: "Nimbus",
    color: "#f2b8ff",
    minutes: 3_120,
    note: "Platform migration support",
    proof: {
      filename: "nimbus-sep.pdf",
      href: "#nimbus-sep.pdf",
      sizeLabel: "412 kB",
      uploadedAtLabel: "30 Sep 2026, 17:20",
    },
  },
];

const declaredLabels = {
  hoursLabel: (project: { name: string }) => `${project.name}, declared hours`,
  hoursPlaceholder: "52",
  hoursHint: "Hours for the whole month — 52, 52h or 52:30.",
  noteLabel: (project: { name: string }) => `${project.name}, what the hours cover`,
  notePlaceholder: "Platform migration support",
  noteRequired: "Describe what the declared hours cover.",
  proofLabel: "Hours proof PDF",
  proofUpload: "Upload proof",
  proofReplace: "Replace",
  proofView: "View",
  proofMissing: "No proof uploaded yet",
  proofNeedsHours: "Declare the hours first, then attach the proof.",
  proofUploading: "Uploading",
  save: "Save",
  saving: "Saving",
  saved: "Saved",
  locked: "A submitted timesheet locks this month.",
  nothingDeclared: "Nothing declared",
  externalSystem: "external system",
};

const labels = {
  trackedHeading: "Tracked in Sheet Happens",
  declaredHeading: "Declared monthly",
  zoomToProject: (project: MonthOverviewProject) => `${project.name} · zoom in`,
  emptyTitle: "Nothing to close in this month",
  emptyDescription:
    "No hours were logged in this month, and no project is open in it to log any against.",
  declared: declaredLabels,
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

/**
 * §8's own hybrid month, both bands at once: 94 h + 22 h tracked and 52 h declared, adding to the
 * 168 h the period row above shows. This is the case L4 exists to serve — everything a member is
 * responsible for, each kind at the finest resolution it has.
 */
export const HybridMonth: Story = {
  args: {
    declared,
  },
};

/**
 * A declared-only member: no tracked band and **no band headings at all**.
 *
 * With one kind of hours there is nothing to distinguish, so a heading over the only thing on
 * screen would be a label on a category of one. This member also gets no level control, from
 * `resolveZoomStops` — the month is their whole screen.
 */
export const DeclaredOnly: Story = {
  args: {
    projects: [],
    declared,
  },
};

/** The row that is a form and nothing else: a live declared assignment with nothing declared yet. */
export const DeclaredNothingYet: Story = {
  args: {
    projects: [],
    declared: [
      {
        projectId: "nimbus",
        name: "Nimbus",
        color: "#f2b8ff",
        minutes: null,
        note: "",
        proof: null,
      },
    ],
  },
  play: async ({ canvas, userEvent }) => {
    // The proof slot is not an affordance before there is a figure for it to prove.
    await expect(canvas.queryByRole("button", { name: "Upload proof" })).not.toBeInTheDocument();
    // Nor is Save, until both the figure and the note exist.
    await expect(canvas.getByRole("button", { name: "Save" })).toBeDisabled();

    await userEvent.type(canvas.getByLabelText("Nimbus, declared hours"), "52");
    await expect(canvas.getByRole("button", { name: "Save" })).toBeDisabled();

    await userEvent.type(
      canvas.getByLabelText("Nimbus, what the hours cover"),
      "Platform migration support",
    );
    await expect(canvas.getByRole("button", { name: "Save" })).toBeEnabled();
  },
};

/** Hours declared, proof still missing — a warning here, and a submission block for a contractor. */
export const DeclaredProofMissing: Story = {
  args: {
    projects: [],
    declared: [{ ...declared[0]!, proof: null }],
  },
};

/** A rejected upload reports on the row that asked for it, not on the band. */
export const DeclaredUploadRejected: Story = {
  args: {
    projects: [],
    declared: [{ ...declared[0]!, proof: null, error: "The hours proof must be a PDF." }],
  },
};

/** Above 24 h × days in the month. A warning, never a block — the figure still saves. */
export const DeclaredImplausibleFigure: Story = {
  args: {
    projects: [],
    declared: [
      {
        ...declared[0]!,
        minutes: 45_000,
        warning: "That is more than 720 h, the hours in this whole month.",
      },
    ],
  },
};

/**
 * Locked by a submitted timesheet: read-only, and still **readable**. The figure, the note and the
 * proof are exactly what an admin and the member compare against an invoice, so they stay legible
 * rather than being greyed out behind disabled inputs.
 */
export const DeclaredLocked: Story = {
  args: {
    declared,
    monthLocked: true,
  },
};

export const HybridMonthLight: Story = {
  args: {
    declared,
  },
  globals: { theme: "light" },
};

/** Both bands on a phone: the form stacks, and the figure and proof stay on one line each. */
export const HybridMonthMobile: Story = {
  args: {
    declared,
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};
