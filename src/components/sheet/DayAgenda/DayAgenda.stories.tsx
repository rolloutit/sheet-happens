import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { DayAgenda } from ".";
import type { DayAgendaEntry, DayAgendaLabels } from "./DayAgenda.types";

const entries: DayAgendaEntry[] = [
  {
    id: "entry-1",
    projectName: "Internal Ops & Tooling",
    projectColor: "#72df9a",
    description: "Internal dashboard updates",
    durationMinutes: 255,
    startTime: "09:00",
    endTime: "13:15",
    timed: true,
    locked: false,
    adminModified: false,
    warnings: [],
    adminNotice: null,
  },
  {
    id: "entry-2",
    projectName: "Atlas Platform",
    projectColor: "#37e3de",
    description: "Code review",
    durationMinutes: 255,
    startTime: "13:45",
    endTime: "18:00",
    timed: false,
    locked: false,
    adminModified: true,
    warnings: [],
    adminNotice: {
      changedBy: "Changed by Réka on Sep 3, 2026, 10:12.",
      reason: "Reason: Wrong project.",
    },
  },
];

const split = [
  { projectId: "ops", name: "Internal Ops & Tooling", color: "#72df9a", minutes: 255 },
  { projectId: "atlas", name: "Atlas Platform", color: "#37e3de", minutes: 255 },
];

const labels: DayAgendaLabels = {
  futureDay: "This is a future date. Entries are allowed, but they stay flagged.",
  overCapacity: "The selected day has more than 8 logged hours.",
  emptyTitle: "No entries on this day",
  emptyDescription: "Start a timer or add an entry for the selected project and day.",
  addEntry: "Add entry",
  copyYesterday: "Copy yesterday",
  glance: "At a glance",
  target: "of 8 h target",
  over: "over 8 h",
  split: "By project",
  noSplit: "Nothing logged yet",
  quickAdd: "Quick add",
  card: {
    edit: (entry) => `Edit ${entry.description}`,
    delete: (entry) => `Delete ${entry.description}`,
    continue: (entry) => `Continue ${entry.description}`,
    adminModified: "Changed by an administrator",
    timed: "Tracked with a timer",
    locked: "Locked by a submitted timesheet",
  },
  timer: { live: "Running now", stop: "Stop timer" },
};

const meta = {
  title: "Sheet/DayAgenda",
  component: DayAgenda,
  parameters: {
    layout: "padded",
  },
  args: {
    isoDate: "2026-08-31",
    dayState: "normal",
    totalMinutes: 510,
    capacityMinutes: 480,
    entries,
    split,
    locale: "en",
    durationDisplayFormat: "DECIMAL_HOURS",
    labels,
    onAddEntry: fn(),
    onEditEntry: fn(),
    onDeleteEntry: fn(),
    onContinueEntry: fn(),
    onCopyPreviousDay: fn(),
  },
} satisfies Meta<typeof DayAgenda>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Two timed entries, over the target: the ring is amber and says so in words. */
export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByRole("complementary", { name: "At a glance" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Edit Code review" }));
    await expect(args.onEditEntry).toHaveBeenCalledWith(expect.objectContaining({ id: "entry-2" }));
  },
};

export const Empty: Story = {
  args: {
    entries: [],
    split: [],
    totalMinutes: 0,
    canCopyPreviousDay: true,
  },
};

export const OnTarget: Story = {
  args: {
    totalMinutes: 480,
    entries: entries.map((entry) => ({ ...entry, durationMinutes: 240 })),
    split: split.map((item) => ({ ...item, minutes: 240 })),
  },
};

export const FutureDay: Story = {
  args: {
    dayState: "future",
    totalMinutes: 240,
    entries: [entries[0]],
    split: [split[0]],
  },
};

export const LockedDay: Story = {
  args: {
    locked: true,
    entries: entries.map((entry) => ({ ...entry, locked: true })),
  },
};

export const RunningTimer: Story = {
  args: {
    dayState: "today",
    runningTimer: {
      projectName: "Atlas Platform",
      projectColor: "#37e3de",
      description: "Sprint planning",
      elapsedLabel: "0:42:13",
    },
    canContinue: false,
    onStopTimer: fn(),
  },
};

/** The rail holds the composer on a desktop; the story stands in a placeholder for it. */
export const WithComposer: Story = {
  args: {
    composer: (
      <div className="rounded-[var(--radius-md)] border border-dashed border-border p-3 text-xs text-muted-foreground">
        Quick composer
      </div>
    ),
  },
};

export const PendingMutation: Story = {
  args: {
    disabled: true,
  },
};

export const DefaultLight: Story = {
  globals: { theme: "light" },
};

/** Below `lg` the rail stacks under the list as a collapsible. */
export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};
