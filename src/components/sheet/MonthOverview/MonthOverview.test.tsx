import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MonthOverview } from ".";
import type { MonthOverviewProject } from "./MonthOverview.types";

const projects: MonthOverviewProject[] = [
  { projectId: "atlas", name: "Atlas Platform", color: "#37e3de", minutes: 5_640 },
  { projectId: "ops", name: "Internal Ops & Tooling", color: "#72df9a", minutes: 1_320 },
  { projectId: "orion", name: "Orion Rollout", color: "#f2b8ff", minutes: 0 },
];

const labels = {
  trackedHeading: "Tracked in Sheet Happens",
  zoomToProject: (project: MonthOverviewProject) => `${project.name} · zoom in`,
  emptyTitle: "Nothing to close in this month",
  emptyDescription: "No hours were logged in this month.",
};

function renderOverview(overrides: Partial<Parameters<typeof MonthOverview>[0]> = {}) {
  const onZoomToProject = vi.fn();

  render(
    <MonthOverview
      projects={projects}
      locale="en"
      durationDisplayFormat="DECIMAL_HOURS"
      labels={labels}
      onZoomToProject={onZoomToProject}
      {...overrides}
    />,
  );

  return { onZoomToProject };
}

describe("MonthOverview", () => {
  it("lists one row per project with its month total", () => {
    renderOverview();

    expect(screen.getByRole("heading", { name: "Tracked in Sheet Happens" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Atlas Platform · zoom in" })).toHaveTextContent(
      "94 h",
    );
    expect(
      screen.getByRole("button", { name: "Internal Ops & Tooling · zoom in" }),
    ).toHaveTextContent("22 h");
  });

  /** The case the level exists for: a live project with nothing logged is what a month close needs. */
  it("still shows a project with no hours in the month, read as empty", () => {
    renderOverview();

    const forgotten = screen.getByRole("button", { name: "Orion Rollout · zoom in" });

    expect(forgotten).toHaveTextContent("0 h");
    expect(forgotten).toHaveClass("text-muted-foreground");
  });

  it("reports which project was pressed as the zoom out of the month", async () => {
    const user = userEvent.setup();
    const { onZoomToProject } = renderOverview();

    await user.click(screen.getByRole("button", { name: "Atlas Platform · zoom in" }));

    expect(onZoomToProject).toHaveBeenCalledWith(projects[0]);
  });

  it("keeps its heading when there is nothing in the band", () => {
    renderOverview({ projects: [] });

    expect(screen.getByRole("heading", { name: "Tracked in Sheet Happens" })).toBeInTheDocument();
    expect(screen.getByText("Nothing to close in this month")).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("starts no navigation while a mutation is pending", async () => {
    const user = userEvent.setup();
    const { onZoomToProject } = renderOverview({ disabled: true });

    await user.click(screen.getByRole("button", { name: "Atlas Platform · zoom in" }));

    expect(onZoomToProject).not.toHaveBeenCalled();
  });
});
