import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";

import { RunningTimerPill } from ".";

const labels = {
  open: "Open time tracking",
  stop: "Stop timer",
  running: "Timer running",
  dismissError: "Dismiss",
};

/*
  A literal label rather than a start time run through the clock. The component takes the reading
  as a prop precisely so the stories — and the visual baselines built from them — hold still.
*/
const elapsedLabel = "1:23:45";

const meta = {
  title: "Layout/RunningTimerPill",
  component: RunningTimerPill,
  tags: ["autodocs"],
  args: {
    labels,
    elapsedLabel,
    timer: {
      description: "Refactor the invoice export",
      projectName: "Acme Portal",
      projectColor: "#4dd6c1",
      startedAt: "2026-08-30T08:00:00.000Z",
    },
    onOpen: fn(),
    onStop: fn(),
    onDismissError: fn(),
  },
  // The pill lives on the header plane, which is dark by default in this app.
  globals: {
    theme: "dark",
    locale: "en",
  },
} satisfies Meta<typeof RunningTimerPill>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
  The showcase stories below carry no `play`. The visual suite loads stories through Storybook's
  iframe, which runs play functions on mount — an interaction would put focus rings and hover states
  into the baselines. Behaviour is asserted in the dedicated stories at the bottom instead.
*/
export const Running: Story = {
  args: { density: "comfortable" },
};

export const RunningLight: Story = {
  ...Running,
  globals: { theme: "light", locale: "en" },
};

/** What the mobile header renders: the elapsed time and the stop button, nothing else. */
export const Compact: Story = {
  args: { density: "compact" },
};

export const CompactMobile: Story = {
  ...Compact,
  parameters: { viewport: { defaultViewport: "mobile1" } },
};

/** Mid-stop: the pill stays put and only the stop button locks. */
export const Stopping: Story = {
  args: { density: "comfortable", disabled: true },
};

/**
 * A stop that trips the daily limit throws the time away and deletes the timer, so the note has to
 * render with no pill left to hang under.
 */
export const DiscardedAtDailyLimit: Story = {
  args: {
    timer: null,
    error: "The timer stopped without saving because the day would exceed 24 hours.",
  },
};

export const StopsWithoutNavigating: Story = {
  args: { density: "comfortable" },
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByText("Acme Portal")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: /stop timer/i }));
    await expect(args.onStop).toHaveBeenCalled();
    // The stop button sits on top of the pill, so its click must not also trigger navigation.
    await expect(args.onOpen).not.toHaveBeenCalled();
  },
};

export const CompactHidesTheProject: Story = {
  args: { density: "compact" },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText("Acme Portal")).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /stop timer/i })).toBeVisible();
  },
};

export const ErrorCanBeDismissed: Story = {
  args: {
    timer: null,
    error: "The timer stopped without saving because the day would exceed 24 hours.",
  },
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByRole("alert")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: /dismiss/i }));
    await expect(args.onDismissError).toHaveBeenCalled();
  },
};

/** Nothing running and nothing to report renders nothing at all. */
export const Idle: Story = {
  args: { timer: null },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};
