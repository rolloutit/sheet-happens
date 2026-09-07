import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { EntryCardEntry } from "./EntryCard.types";
import { EntryCard } from ".";

const entry: EntryCardEntry = {
  id: "entry-1",
  projectName: "Atlas Platform",
  projectColor: "#37e3de",
  description: "Sprint planning",
  durationMinutes: 90,
  startTime: "09:00",
  endTime: "10:30",
  timed: true,
  locked: false,
  adminModified: false,
  warnings: [],
};

const labels = {
  edit: (item: EntryCardEntry) => `Edit ${item.description}`,
  delete: (item: EntryCardEntry) => `Delete ${item.description}`,
  continue: (item: EntryCardEntry) => `Continue ${item.description}`,
  adminModified: "Changed by an administrator",
  timed: "Tracked with a timer",
  locked: "Locked by a submitted timesheet",
};

function renderCard(overrides: Partial<React.ComponentProps<typeof EntryCard>> = {}) {
  const handlers = { onEdit: vi.fn(), onDelete: vi.fn(), onContinue: vi.fn() };

  render(
    <EntryCard entry={entry} durationLabel="1.5 h" labels={labels} {...handlers} {...overrides} />,
  );

  return handlers;
}

describe("EntryCard", () => {
  it("says the description first, then the project and the interval, with the duration exact", () => {
    renderCard();

    expect(screen.getByText("Sprint planning")).toBeInTheDocument();
    expect(screen.getByText("Atlas Platform")).toBeInTheDocument();
    expect(screen.getByText("09:00 – 10:30")).toBeInTheDocument();
    expect(screen.getByText("1.5 h")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Tracked with a timer" })).toBeInTheDocument();
  });

  it("keeps its actions in the tree and reports each one", async () => {
    const user = userEvent.setup();
    const handlers = renderCard();

    await user.click(screen.getByRole("button", { name: "Edit Sprint planning" }));
    await user.click(screen.getByRole("button", { name: "Continue Sprint planning" }));
    await user.click(screen.getByRole("button", { name: "Delete Sprint planning" }));

    expect(handlers.onEdit).toHaveBeenCalledWith(entry);
    expect(handlers.onContinue).toHaveBeenCalledWith(entry);
    expect(handlers.onDelete).toHaveBeenCalledWith(entry);
  });

  it("disables edit and delete on a locked entry but still lets a timer continue from it", () => {
    renderCard({ entry: { ...entry, locked: true } });

    expect(screen.getByRole("button", { name: "Edit Sprint planning" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete Sprint planning" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Continue Sprint planning" })).toBeEnabled();
    expect(
      screen.getByRole("img", { name: "Locked by a submitted timesheet" }),
    ).toBeInTheDocument();
  });

  it("withholds Continue when asked to", () => {
    renderCard({ canContinue: false });

    expect(
      screen.queryByRole("button", { name: "Continue Sprint planning" }),
    ).not.toBeInTheDocument();
  });

  it("runs the saved pulse once per token", () => {
    const { container, rerender } = render(
      <EntryCard
        entry={entry}
        durationLabel="1.5 h"
        labels={labels}
        highlightToken={1}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(container.querySelector(".sheet-saved-pulse")).not.toBeNull();

    rerender(
      <EntryCard
        entry={entry}
        durationLabel="1.5 h"
        labels={labels}
        highlightToken={null}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(container.querySelector(".sheet-saved-pulse")).toBeNull();
  });
});
