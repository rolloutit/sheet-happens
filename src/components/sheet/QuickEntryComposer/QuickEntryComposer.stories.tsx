import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn } from "storybook/test";

import { QuickEntryComposer } from ".";
import type { QuickEntryComposerValue } from "./QuickEntryComposer.types";

const projects = [
  { projectId: "atlas", name: "Atlas Platform", color: "#37e3de" },
  { projectId: "ops", name: "Internal Ops & Tooling", color: "#72df9a" },
  { projectId: "one-time", name: "one time test", color: "#f2b8ff" },
];

const labels = {
  title: "Add to Mon, Aug 31",
  project: "Project",
  duration: "Duration",
  durationPlaceholder: "2h30",
  description: "Description",
  descriptionPlaceholder: "What did you do?",
  more: "More options",
  interval: "Interval instead",
  add: "Add",
  submitHint: "Enter adds",
  invalidDuration: "Use time like 3.5, 3:30, 3h 20m, or 200m.",
  descriptionRequired: "Describe what you did.",
  noProject: "Pick a project first.",
};

function Demo({
  onSubmit,
  pending,
  error,
}: {
  onSubmit: (value: QuickEntryComposerValue & { durationMinutes: number }) => void;
  pending?: boolean;
  error?: string | null;
}) {
  const [value, setValue] = useState<QuickEntryComposerValue>({
    projectId: "atlas",
    durationText: "",
    description: "",
  });

  return (
    <QuickEntryComposer
      projects={projects}
      value={value}
      labels={labels}
      pending={pending}
      error={error}
      autoFocus={null}
      onValueChange={setValue}
      onSubmit={onSubmit}
      onMoreOptions={fn()}
      onInterval={fn()}
    />
  );
}

const meta = {
  title: "Sheet/QuickEntryComposer",
  component: QuickEntryComposer,
  parameters: { layout: "padded" },
  args: {
    projects,
    value: { projectId: "atlas", durationText: "", description: "" },
    labels,
    autoFocus: null,
    onValueChange: fn(),
    onSubmit: fn(),
    onMoreOptions: fn(),
    onInterval: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-[26rem] rounded-[var(--radius-lg)] border border-border-strong bg-popover p-4 shadow-panel">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof QuickEntryComposer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two fields and Enter: validated on submit, parsed the way the grid parses. */
export const Default: Story = {
  render: (args) => <Demo onSubmit={args.onSubmit} />,
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("radio", { name: "Internal Ops & Tooling" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "Duration" }), "2h30");
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Description" }),
      "Sprint planning{Enter}",
    );

    await expect(args.onSubmit).toHaveBeenCalledWith({
      projectId: "ops",
      durationText: "2h30",
      description: "Sprint planning",
      durationMinutes: 150,
    });
  },
};

export const Validation: Story = {
  render: (args) => <Demo onSubmit={args.onSubmit} />,
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole("textbox", { name: "Duration" }), "lots");
    await userEvent.click(canvas.getByRole("button", { name: "Add" }));

    await expect(canvas.getByText("Use time like 3.5, 3:30, 3h 20m, or 200m.")).toBeInTheDocument();
    await expect(canvas.getByText("Describe what you did.")).toBeInTheDocument();
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

export const Pending: Story = {
  render: (args) => <Demo onSubmit={args.onSubmit} pending />,
};

export const Rejected: Story = {
  render: (args) => <Demo onSubmit={args.onSubmit} error="Daily total cannot exceed 24 hours." />,
};

export const DefaultLight: Story = {
  render: (args) => <Demo onSubmit={args.onSubmit} />,
  globals: { theme: "light" },
};

export const Mobile: Story = {
  render: (args) => <Demo onSubmit={args.onSubmit} />,
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
