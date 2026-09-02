import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ProjectPickerOption } from "./ProjectPicker.types";
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
    name: "Ügyfél Portal",
    slug: "ugyfel-portal",
    colorToken: "blue",
    isInternal: false,
    status: "ACTIVE",
  },
];

describe("ProjectPicker", () => {
  it("calls onToggle once with the new state when a row is checked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <ProjectPicker
        projects={projects}
        selectedIds={[]}
        filter="all"
        query=""
        labels={labels}
        onToggle={onToggle}
        onFilterChange={vi.fn()}
        onQueryChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Toggle Atlas Platform" }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith("1", true);
  });

  it("matches accent-folded search, e.g. 'ugyfel' finds 'Ügyfél Portal'", () => {
    render(
      <ProjectPicker
        projects={projects}
        selectedIds={[]}
        filter="all"
        query="ugyfel"
        labels={labels}
        onToggle={vi.fn()}
        onFilterChange={vi.fn()}
        onQueryChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Ügyfél Portal")).toBeInTheDocument();
    expect(screen.queryByText("Atlas Platform")).not.toBeInTheDocument();
  });

  it("disables a row's checkbox while it is pending", () => {
    render(
      <ProjectPicker
        projects={projects}
        selectedIds={[]}
        pendingIds={["1"]}
        filter="all"
        query=""
        labels={labels}
        onToggle={vi.fn()}
        onFilterChange={vi.fn()}
        onQueryChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Toggle Atlas Platform" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Toggle Ügyfél Portal" })).toBeEnabled();
  });

  it("shows the empty message when the search matches nothing", () => {
    render(
      <ProjectPicker
        projects={projects}
        selectedIds={[]}
        filter="all"
        query="does-not-exist"
        labels={labels}
        onToggle={vi.fn()}
        onFilterChange={vi.fn()}
        onQueryChange={vi.fn()}
      />,
    );

    expect(screen.getByText(labels.noMatches)).toBeInTheDocument();
  });
});
