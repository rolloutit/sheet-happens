import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, within } from "storybook/test";
import { useState } from "react";

import { TimerStartDialog } from ".";
import type { TimerStartDialogProps } from ".";

const projects = [
  { projectId: "p-acme", name: "Acme Portal", color: "#4dd6c1" },
  { projectId: "p-orbit", name: "Orbit Billing", color: "#8ea2ff" },
  { projectId: "p-internal", name: "Internal — Tooling", color: "#f2a97e" },
];

const labels = {
  title: "New timer",
  description: "Pick a project and describe what you are working on. The timer starts right away.",
  close: "Close",
  cancel: "Cancel",
  start: "Start",
  descriptionLabel: "Description",
  descriptionPlaceholder: "What are you working on?",
  projectLabel: "Project",
  recent: "Recent",
  combobox: { search: "Search", searchPlaceholder: "Search...", empty: "No results" },
};

/**
 * The dialog is normally driven by a URL param, so the harness supplies the opener a real page
 * would render in its toolbar.
 */
function TimerStartDialogHarness({
  defaultOpen = false,
  ...props
}: Omit<TimerStartDialogProps, "open" | "onOpenChange"> & { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="p-6">
      <button
        type="button"
        className="rounded-[var(--radius-pill)] border border-border bg-secondary px-4 py-2 text-sm font-semibold"
        onClick={() => setOpen(true)}
      >
        New timer
      </button>
      <TimerStartDialog {...props} open={open} onOpenChange={setOpen} />
    </div>
  );
}

const meta = {
  title: "Sheet/TimerStartDialog",
  component: TimerStartDialog,
  render: (args) => <TimerStartDialogHarness {...args} />,
  args: {
    open: false,
    onOpenChange: fn(),
    projects,
    labels,
    onStart: fn(),
  },
  globals: {
    theme: "dark",
    locale: "en",
  },
} satisfies Meta<typeof TimerStartDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /new timer/i }));
    const dialog = await screen.findByRole("dialog", { name: /new timer/i });

    // Nothing typed yet, so there is nothing to start.
    await expect(within(dialog).getByRole("button", { name: /^start$/i })).toBeDisabled();

    await userEvent.type(within(dialog).getByLabelText(/description/i), "Refactor invoice export");
    await userEvent.click(within(dialog).getByRole("button", { name: /^start$/i }));

    // No project touched, so it starts against the first assignment.
    await expect(args.onStart).toHaveBeenCalledWith("p-acme", "Refactor invoice export");
  },
};

export const WithRecentProjects: Story = {
  args: { recentProjects: [projects[1], projects[2]] },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /new timer/i }));
    const dialog = await screen.findByRole("dialog", { name: /new timer/i });

    await userEvent.click(within(dialog).getByRole("button", { name: /orbit billing/i }));
    await userEvent.type(within(dialog).getByLabelText(/description/i), "Reconcile March run");
    await userEvent.click(within(dialog).getByRole("button", { name: /^start$/i }));

    await expect(args.onStart).toHaveBeenCalledWith("p-orbit", "Reconcile March run");
  },
};

export const WhitespaceOnlyDescriptionStaysDisabled: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /new timer/i }));
    const dialog = await screen.findByRole("dialog", { name: /new timer/i });

    await userEvent.type(within(dialog).getByLabelText(/description/i), "   ");
    await expect(within(dialog).getByRole("button", { name: /^start$/i })).toBeDisabled();
    await expect(args.onStart).not.toHaveBeenCalled();
  },
};

/** A rejected start keeps the dialog open with the input intact. */
export const Rejected: Story = {
  args: {
    recentProjects: [projects[1]],
    error: "Stop the running timer before starting another one.",
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /new timer/i }));
    const dialog = await screen.findByRole("dialog", { name: /new timer/i });
    await expect(within(dialog).getByRole("alert")).toBeVisible();
  },
};

export const Pending: Story = {
  args: { pending: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /new timer/i }));
    const dialog = await screen.findByRole("dialog", { name: /new timer/i });
    await expect(within(dialog).getByRole("button", { name: /^start$/i })).toBeDisabled();
  },
};

/**
 * Rendered already open and without a `play`, because the visual suite runs play functions on
 * mount — this is the story the screenshots point at.
 *
 * It goes through the harness rather than rendering the dialog alone: Radix portals the content to
 * `document.body`, so a bare dialog leaves `#storybook-root` empty and zero-height, which the
 * visual runner reads as a story that never rendered.
 */
export const Open: Story = {
  args: { recentProjects: [projects[1], projects[2]] },
  render: (args) => <TimerStartDialogHarness {...args} defaultOpen />,
};

export const OpenLight: Story = {
  ...Open,
  globals: { theme: "light", locale: "en" },
};

export const OpenMobile: Story = {
  ...Open,
  parameters: { viewport: { defaultViewport: "mobile1" } },
};

export const Light: Story = {
  args: { recentProjects: [projects[1], projects[2]] },
  globals: { theme: "light", locale: "en" },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /new timer/i }));
    await screen.findByRole("dialog", { name: /new timer/i });
  },
};

export const Mobile: Story = {
  ...Light,
  globals: { theme: "dark", locale: "en" },
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
