import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";
import { Search } from "lucide-react";

import { FilterChips } from ".";

const labels = {
  active: "Active filters",
  clear: "Clear",
  remove: (filter: string) => `Remove filter: ${filter}`,
};

const meta = {
  title: "Sheet/FilterChips",
  component: FilterChips,
  globals: {
    theme: "light",
    locale: "en",
  },
  args: {
    labels,
    onRemove: fn(),
    onClear: fn(),
    chips: [
      {
        id: "q",
        label: "atlas",
        aria: "Search: atlas",
        leading: <Search className="size-3" aria-hidden="true" />,
      },
      { id: "state", label: "State: Active" },
      { id: "role", label: "Role: Admin" },
    ],
    summary: "Showing 1-9 of 9 members",
  },
} satisfies Meta<typeof FilterChips>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvas, userEvent }) => {
    // The search chip shows only the term, so its accessible name has to name the filter.
    await userEvent.click(canvas.getByRole("button", { name: "Remove filter: Search: atlas" }));
    // No `value`: a single-value filter is removed whole.
    await expect(args.onRemove).toHaveBeenCalledWith("q", undefined);

    await userEvent.click(canvas.getByRole("button", { name: /^clear$/i }));
    await expect(args.onClear).toHaveBeenCalled();
  },
};

/**
 * A multi-select filter contributes one chip per value under one id, so removing one has to
 * say which — the id alone would take the whole filter off.
 */
export const MultiValueFilter: Story = {
  args: {
    chips: [
      { id: "status", value: "SUBMITTED", label: "Status: Submitted" },
      { id: "status", value: "REJECTED", label: "Status: Rejected" },
      { id: "project", value: "project-1", label: "Project: Apollo" },
    ],
    summary: "Showing 1-4 of 4 timesheets",
  },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Remove filter: Status: Rejected" }));

    await expect(args.onRemove).toHaveBeenCalledWith("status", "REJECTED");
  },
};

export const Dark: Story = {
  globals: {
    theme: "dark",
  },
};

/** No filters applied: the summary holds the row open on its own. */
export const SummaryOnly: Story = {
  args: {
    chips: [],
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText("Active filters")).not.toBeInTheDocument();
    await expect(canvas.getByText(/showing 1-9 of 9/i)).toBeVisible();
  },
};

/** Nothing to say at all — the row collapses rather than leaving an empty band. */
export const Empty: Story = {
  args: {
    chips: [],
    summary: undefined,
  },
  play: async ({ canvas }) => {
    // The preview decorator puts its own theme script in the canvas, so assert on what the
    // component would have rendered rather than on the canvas being literally empty.
    await expect(canvas.queryByText("Active filters")).not.toBeInTheDocument();
    await expect(canvas.queryAllByRole("button")).toHaveLength(0);
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};
