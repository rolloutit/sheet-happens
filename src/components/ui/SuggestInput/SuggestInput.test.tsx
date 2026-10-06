import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { SuggestInput } from "./SuggestInput";
import type { SuggestOption } from "./SuggestInput.types";

const options: SuggestOption[] = [
  { text: "API endpoint implementation", meta: "12 times" },
  { text: "Sprint planning", meta: "4 times" },
  { text: "Árajánlat egyeztetés", meta: "2 times" },
  { text: "Code review", group: "other" },
];

const labels = {
  list: "Recent descriptions",
  count: (count: number) => `${count} suggestions`,
  empty: "No matching description",
  hint: "Up and down to choose",
  groups: { other: "From other projects" },
};

function Harness({
  onSubmit,
  onAccept,
  as = "input",
  initialValue = "",
}: {
  onSubmit?: () => void;
  onAccept?: (option: SuggestOption) => void;
  as?: "input" | "textarea";
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <SuggestInput
        as={as}
        aria-label="Description"
        value={value}
        options={options}
        labels={labels}
        emptyStateLimit={3}
        layout="popover"
        onValueChange={setValue}
        onAccept={onAccept}
      />
    </form>
  );
}

function field() {
  return screen.getByRole("combobox", { name: "Description" });
}

describe("SuggestInput", () => {
  it("offers the top few on focus while the field is still empty", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.click(field());

    expect(screen.getByRole("listbox", { name: "Recent descriptions" })).toBeVisible();
    // `emptyStateLimit` of three, so the fourth option is not offered without a query.
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(field()).toHaveAttribute("aria-expanded", "true");
  });

  it("filters accent-insensitively, so a Hungarian description is reachable from a bare keyboard", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(field(), "arajanlat");

    const matches = screen.getAllByRole("option");

    expect(matches).toHaveLength(1);
    expect(matches[0]).toHaveTextContent("Árajánlat egyeztetés");
  });

  it("accepts the active option on Enter without submitting, and submits on the next press", async () => {
    const onSubmit = vi.fn();
    const onAccept = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSubmit={onSubmit} onAccept={onAccept} />);

    await user.type(field(), "spr");
    await user.keyboard("{ArrowDown}");

    expect(field()).toHaveAttribute("aria-activedescendant", expect.stringContaining("option-0"));

    await user.keyboard("{Enter}");

    expect(onAccept).toHaveBeenCalledWith(expect.objectContaining({ text: "Sprint planning" }));
    expect(field()).toHaveValue("Sprint planning");
    // The whole point: a half-picked suggestion must not also log the entry.
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("submits on Enter when the list is open but nothing is active", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSubmit={onSubmit} />);

    await user.type(field(), "Something new");
    await user.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(field()).toHaveValue("Something new");
  });

  it("accepts a click without ever moving focus out of the field", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(field());
    await user.click(screen.getByRole("option", { name: /Sprint planning/ }));

    expect(field()).toHaveValue("Sprint planning");
    expect(field()).toHaveFocus();
  });

  it("closes the list on Escape and lets a second Escape reach the dialog above it", async () => {
    const onEscape = vi.fn();

    document.addEventListener("keydown", onEscape);

    try {
      const user = userEvent.setup();
      render(<Harness />);

      await user.click(field());
      await user.keyboard("{Escape}");

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      // Swallowed while the list was open: the entry dialog stays where it is.
      expect(onEscape).not.toHaveBeenCalled();

      await user.keyboard("{Escape}");

      // With the list closed the key is none of this component's business.
      expect(onEscape).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener("keydown", onEscape);
    }
  });

  it("wraps around the list and reports the active option through aria-activedescendant", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(field());
    await user.keyboard("{ArrowUp}");

    const optionIds = screen.getAllByRole("option").map((option) => option.id);

    expect(field()).toHaveAttribute("aria-activedescendant", optionIds.at(-1));

    await user.keyboard("{ArrowDown}");

    expect(field()).toHaveAttribute("aria-activedescendant", optionIds[0]);
  });

  it("says so when a query matches nothing, instead of silently offering the unfiltered list", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(field(), "invoice");

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No matching description")).toBeVisible();
  });

  it("groups the options the caller marked", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(field(), "e");

    expect(screen.getByText("From other projects")).toBeVisible();
  });

  it("leaves the arrow keys to the caret in a textarea that has text", async () => {
    const user = userEvent.setup();
    render(<Harness as="textarea" initialValue="review" />);

    await user.click(field());
    await user.keyboard("{ArrowDown}");

    // A three-row description field is still a textarea: Down moves the caret between lines, so it
    // must not steal the key. Alt+Down is the ARIA pattern's explicit way in.
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");

    expect(screen.getByRole("option", { name: /Code review/ })).toBeVisible();
  });

  it("announces the number of suggestions, on a delay, and never the option text", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(field());

    const live = screen.getByRole("status");

    // Nothing yet: the delay is what keeps a fast typist from queuing an announcement per keystroke.
    expect(live).toHaveTextContent("");

    await waitFor(() => expect(live).toHaveTextContent("3 suggestions"));

    // The active option is announced through `aria-activedescendant`; repeating it here is the
    // classic combobox double-speak.
    expect(live).not.toHaveTextContent("Sprint planning");
  });

  it("offers nothing at all when the caller has no options", async () => {
    const user = userEvent.setup();
    render(
      <SuggestInput
        aria-label="Description"
        value=""
        options={[]}
        labels={labels}
        emptyStateLimit={4}
        onValueChange={vi.fn()}
      />,
    );

    await user.click(field());
    await user.keyboard("{ArrowDown}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
