import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Checkbox } from ".";

/**
 * A Radix `Checkbox.Root` renders a `<button>`, so the value a form submits comes from a
 * hidden input Radix mounts beside it. That is an implementation detail of the library, and
 * the admin timesheet toolbar depends on it: its `includePaid` filter is a plain GET `<form>`
 * with no JavaScript of its own, so a checkbox that renders correctly but serializes nothing
 * would fail silently — the box ticks, the URL never gains the parameter, and the list keeps
 * hiding paid rows.
 */
describe("Checkbox in a form", () => {
  it("serializes its value only while ticked", async () => {
    const user = userEvent.setup();

    render(
      <form data-testid="filters">
        <label>
          <Checkbox name="includePaid" value="1" />
          Show paid
        </label>
      </form>,
    );

    const form = screen.getByTestId("filters") as HTMLFormElement;
    expect(new FormData(form).get("includePaid")).toBeNull();

    await user.click(screen.getByRole("checkbox", { name: /show paid/i }));
    expect(new FormData(form).get("includePaid")).toBe("1");

    await user.click(screen.getByRole("checkbox", { name: /show paid/i }));
    expect(new FormData(form).get("includePaid")).toBeNull();
  });

  it("starts ticked from defaultChecked, the shape an uncontrolled filter bar uses", () => {
    render(
      <form data-testid="filters">
        <label>
          <Checkbox name="includePaid" value="1" defaultChecked />
          Show paid
        </label>
      </form>,
    );

    expect(new FormData(screen.getByTestId("filters") as HTMLFormElement).get("includePaid")).toBe(
      "1",
    );
  });
});
