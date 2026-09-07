import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { QuickEntryComposerValue } from "./QuickEntryComposer.types";
import { QuickEntryComposer } from ".";

const projects = [
  { projectId: "atlas", name: "Atlas Platform", color: "#37e3de" },
  { projectId: "ops", name: "Internal Ops", color: "#72df9a" },
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
  invalidDuration: "Use time like 3.5.",
  descriptionRequired: "Describe what you did.",
  noProject: "Pick a project first.",
};

function Harness({
  onSubmit,
  onMoreOptions = vi.fn(),
  initial = { projectId: "atlas", durationText: "", description: "" },
}: {
  onSubmit: (value: QuickEntryComposerValue & { durationMinutes: number }) => void;
  onMoreOptions?: () => void;
  initial?: QuickEntryComposerValue;
}) {
  const [value, setValue] = useState(initial);

  return (
    <QuickEntryComposer
      projects={projects}
      value={value}
      labels={labels}
      autoFocus={null}
      onValueChange={setValue}
      onSubmit={onSubmit}
      onMoreOptions={onMoreOptions}
    />
  );
}

describe("QuickEntryComposer", () => {
  it("submits a parsed duration and the trimmed description on Enter", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await user.click(screen.getByRole("radio", { name: "Internal Ops" }));
    await user.type(screen.getByRole("textbox", { name: "Duration" }), "3:30");
    await user.type(screen.getByRole("textbox", { name: "Description" }), "  Code review {Enter}");

    expect(onSubmit).toHaveBeenCalledWith({
      projectId: "ops",
      durationText: "3:30",
      description: "Code review",
      durationMinutes: 210,
    });
  });

  it("refuses an unreadable duration and an empty description, and says why", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await user.type(screen.getByRole("textbox", { name: "Duration" }), "a while");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Use time like 3.5.")).toBeInTheDocument();
    expect(screen.getByText("Describe what you did.")).toBeInTheDocument();
  });

  it("asks for a project when none is picked", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <Harness
        onSubmit={onSubmit}
        initial={{ projectId: "", durationText: "2", description: "Planning" }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Pick a project first.")).toBeInTheDocument();
  });

  it("hands off to the full dialog through More options", async () => {
    const user = userEvent.setup();
    const onMoreOptions = vi.fn();
    render(<Harness onSubmit={vi.fn()} onMoreOptions={onMoreOptions} />);

    await user.click(screen.getByRole("button", { name: "More options" }));

    expect(onMoreOptions).toHaveBeenCalledTimes(1);
  });
});
