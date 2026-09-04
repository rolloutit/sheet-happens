import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { DeclaredHoursRow } from ".";
import type { DeclaredHoursProject, DeclaredHoursProof } from "./DeclaredHoursRow.types";

/**
 * §8's own declared project, Nimbus, at the three states a month moves through: nothing declared,
 * a figure without its proof, and a figure with one.
 *
 * The row is a **form**, so every story here is really a state of that form rather than a state of
 * a report — which is why there is no loading story. The declared band arrives with the `/time`
 * page (§11) and has nothing to fetch; `saving` and `uploading` below are the only waits that
 * exist, and both are the row's own mutation rather than a load.
 */
const project: DeclaredHoursProject = {
  projectId: "nimbus",
  name: "Nimbus",
  color: "#f2b8ff",
};

const proof: DeclaredHoursProof = {
  filename: "nimbus-sep.pdf",
  href: "#nimbus-sep.pdf",
  sizeLabel: "412 kB",
  uploadedAtLabel: "30 Sep 2026, 17:20",
};

/**
 * Worded English rather than translated: the component does no locale work of its own, and the
 * labels arrive already built (`hoursLabel` and `noteLabel` name the project, which §15 requires).
 */
const labels = {
  hoursLabel: (declaredProject: DeclaredHoursProject) => `${declaredProject.name}, declared hours`,
  hoursPlaceholder: "52",
  hoursHint: "Hours for the whole month — 52, 52h or 52:30.",
  noteLabel: (declaredProject: DeclaredHoursProject) =>
    `${declaredProject.name}, what the hours cover`,
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

const meta = {
  title: "Sheet/DeclaredHoursRow",
  component: DeclaredHoursRow,
  args: {
    project,
    minutes: 3_120,
    note: "Platform migration support",
    proof,
    locale: "en",
    durationDisplayFormat: "DECIMAL_HOURS",
    labels,
    onSave: fn(),
    onUploadProof: fn(),
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DeclaredHoursRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 52 h against Nimbus with its proof attached — the month as it looks once it is closed. */
export const Declared: Story = {};

/**
 * A live declared assignment with nothing against it yet. The `empty` variant, and the row the
 * whole band exists for.
 *
 * Reads quieter rather than louder: on the 2nd of the month this is a prompt, not a problem.
 */
export const NothingDeclared: Story = {
  args: {
    minutes: null,
    note: "",
    proof: null,
  },
  play: async ({ args, canvas, userEvent }) => {
    /* The proof slot is not an affordance before there is a figure for it to prove —
       `proofDocumentId` hangs off the declaration, so there is nothing to attach a file to. */
    await expect(canvas.queryByRole("button", { name: "Upload proof" })).not.toBeInTheDocument();

    // Nor is Save, until the figure *and* the note both exist: a figure with an empty note is what
    // submission refuses a month later, so the row will not commit that state.
    await expect(canvas.getByRole("button", { name: "Save" })).toBeDisabled();

    await userEvent.type(canvas.getByLabelText("Nimbus, declared hours"), "52:30");
    await expect(canvas.getByRole("button", { name: "Save" })).toBeDisabled();

    await userEvent.type(
      canvas.getByLabelText("Nimbus, what the hours cover"),
      "Platform migration support",
    );

    const save = canvas.getByRole("button", { name: "Save" });
    await expect(save).toBeEnabled();
    await userEvent.click(save);

    // Hours are typed in the app's own duration grammar and reported as minutes.
    await expect(args.onSave).toHaveBeenCalledWith({
      projectId: "nimbus",
      minutes: 3_150,
      note: "Platform migration support",
    });
  },
};

/**
 * Hours declared, proof still missing.
 *
 * A warning here, and for a contractor a hard submission block — the proof is what replaces the
 * per-day detail a declared project does not have.
 */
export const ProofMissing: Story = {
  args: {
    proof: null,
  },
};

/** A rejected upload reports on the row that asked for it, not on the band above it. */
export const UploadRejected: Story = {
  args: {
    proof: null,
    error: "The hours proof must be a PDF.",
  },
};

/** Mid-upload: the trigger says so and every affordance that would start another is disabled. */
export const Uploading: Story = {
  args: {
    proof: null,
    uploading: true,
  },
};

/** Mid-save. The figure is already typed, so only the commit is outstanding. */
export const Saving: Story = {
  args: {
    saving: true,
  },
};

/** Another row in the band is mid-mutation, so this one takes no input until that settles. */
export const PendingMutation: Story = {
  args: {
    disabled: true,
  },
};

/** The confirmation that survives until the fields change again. */
export const JustSaved: Story = {
  args: {
    savedAt: 1_759_248_000_000,
  },
};

/**
 * Above 24 h × days in the month.
 *
 * A **warning, never a block** — the figure is copied from another company's system, and refusing
 * it would leave a member unable to record what they were actually paid for. Save stays available.
 */
export const ImplausibleFigure: Story = {
  args: {
    minutes: 45_000,
    warning: "That is more than 720 h, the hours in this whole month. Saved — check the figure.",
  },
};

/** Hours and minutes rather than decimal hours — the app's other duration preference. */
export const HoursAndMinutes: Story = {
  args: {
    minutes: 3_150,
    durationDisplayFormat: "HOURS_MINUTES",
  },
};

/**
 * Locked by a submitted timesheet: read-only, and still **readable**.
 *
 * A real variant rather than a `disabled` sweep. The figure, the note and the proof are exactly
 * what an admin and the member compare against an invoice, so they render as text with the proof
 * still openable — only replacing it goes away.
 */
export const Locked: Story = {
  args: {
    locked: true,
  },
};

/** A locked month that holds no declaration at all: `null` is "nothing declared", not zero hours. */
export const LockedNothingDeclared: Story = {
  args: {
    locked: true,
    minutes: null,
    note: "",
    proof: null,
  },
};

export const DeclaredLight: Story = {
  globals: { theme: "light" },
};

/**
 * On a phone the hours, note and proof stack.
 *
 * This is the level a declared-only member's entire interaction with the app happens at, once a
 * month — so the mobile form is the product for them, not a degradation of it.
 */
export const Mobile: Story = {
  args: {
    proof: null,
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};
