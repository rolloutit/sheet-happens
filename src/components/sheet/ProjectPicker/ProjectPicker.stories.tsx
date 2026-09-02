import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, fn } from "storybook/test";

import type { ProjectPickerFilter, ProjectPickerOption } from "./ProjectPicker.types";
import { ProjectPicker } from ".";

const labels = {
  filterGroupLabel: "Project filter",
  filters: { all: "All", inGroup: "In group", available: "Available" },
  searchLabel: "Search projects",
  searchPlaceholder: "Search projects…",
  noMatches: "No projects match your search.",
  noneAvailable: "All projects are already in this group.",
  toggleLabel: (project: ProjectPickerOption) => `Toggle ${project.name}`,
  badges: { internal: "Internal", inactive: "Inactive", archived: "Archived" },
};

const projects: ProjectPickerOption[] = [
  {
    id: "1",
    name: "Atlas Platform",
    slug: "atlas-platform",
    colorToken: "teal",
    isInternal: false,
    status: "ACTIVE",
  },
  {
    id: "2",
    name: "Aurora Billing",
    slug: "aurora-billing",
    colorToken: "blue",
    isInternal: false,
    status: "ACTIVE",
  },
  {
    id: "3",
    name: "Fenix Data Pipeline",
    slug: "fenix-data-pipeline",
    colorToken: "mint",
    isInternal: false,
    status: "ACTIVE",
  },
  {
    id: "4",
    name: "Vega Integration",
    slug: "vega-integration",
    colorToken: "violet",
    isInternal: true,
    status: "ACTIVE",
  },
  {
    id: "5",
    name: "Legacy Ledger",
    slug: "legacy-ledger",
    colorToken: "slate",
    isInternal: false,
    status: "INACTIVE",
  },
  {
    id: "6",
    name: "Retired Import Tool",
    slug: "retired-import-tool",
    colorToken: "rose",
    isInternal: false,
    status: "ARCHIVED",
  },
];

const meta = {
  title: "Sheet/ProjectPicker",
  component: ProjectPicker,
  globals: {
    theme: "light",
    locale: "en",
  },
  args: {
    projects,
    selectedIds: ["1", "2"],
    filter: "all",
    query: "",
    labels,
    onToggle: fn(),
    onFilterChange: fn(),
    onQueryChange: fn(),
  },
} satisfies Meta<typeof ProjectPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Dark: Story = {
  globals: { theme: "dark" },
};

export const TogglingARow: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("checkbox", { name: "Toggle Fenix Data Pipeline" }));
    await expect(args.onToggle).toHaveBeenCalledWith("3", true);

    await userEvent.click(canvas.getByRole("checkbox", { name: "Toggle Atlas Platform" }));
    await expect(args.onToggle).toHaveBeenCalledWith("1", false);
  },
};

export const SwitchingFilters: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("radio", { name: /in group/i }));
    await expect(args.onFilterChange).toHaveBeenCalledWith("inGroup");
  },
};

export const PendingRow: Story = {
  args: {
    pendingIds: ["3"],
  },
};

export const NoneAvailable: Story = {
  args: {
    filter: "available",
    selectedIds: projects.map((project) => project.id),
  },
};

export const NoSearchMatches: Story = {
  args: {
    query: "does-not-exist",
  },
};

/** A wired-up copy for manually poking at search, filters, and toggling together. */
export const Interactive: Story = {
  render: function InteractiveStory() {
    const [selectedIds, setSelectedIds] = useState<string[]>(["1", "2"]);
    const [filter, setFilter] = useState<ProjectPickerFilter>("all");
    const [query, setQuery] = useState("");

    return (
      <ProjectPicker
        projects={projects}
        selectedIds={selectedIds}
        filter={filter}
        query={query}
        labels={labels}
        onToggle={(id, next) =>
          setSelectedIds((current) =>
            next ? [...current, id] : current.filter((selected) => selected !== id),
          )
        }
        onFilterChange={setFilter}
        onQueryChange={setQuery}
      />
    );
  },
};
