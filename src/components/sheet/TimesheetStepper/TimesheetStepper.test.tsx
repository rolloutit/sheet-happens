import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { TimesheetStepper } from ".";

describe("TimesheetStepper", () => {
  it("shows the first step as current before a timesheet exists", () => {
    render(<TimesheetStepper status="not_created" />);

    expect(screen.getByText("Assembled").previousElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Assembled").parentElement).toHaveTextContent("Assembled");
    expect(
      screen.getByText("Submitted").parentElement?.querySelector("[data-step-state]"),
    ).toHaveAttribute("data-step-state", "locked");
  });

  it.each([
    ["rejected", "Submitted"],
    ["invoice_rejected", "Invoice"],
  ] as const)("marks the failed step for %s", (status, label) => {
    render(<TimesheetStepper status={status} />);

    expect(
      screen.getByText(label).parentElement?.querySelector("[data-step-state]"),
    ).toHaveAttribute("data-step-state", "rejected");
  });

  it("makes the payment step current after invoice acceptance", () => {
    render(<TimesheetStepper status="accepted" />);

    expect(
      screen.getByText("Paid").parentElement?.querySelector("[data-step-state]"),
    ).toHaveAttribute("data-step-state", "current");
  });

  it("explains a locked step on keyboard focus", async () => {
    const user = userEvent.setup();
    render(
      <TimesheetStepper
        status="submitted"
        lockedDescriptions={{ invoiced: "Invoice upload is available after approval." }}
      />,
    );

    await user.tab();

    expect(
      await screen.findByRole("tooltip", { name: "Invoice upload is available after approval." }),
    ).toBeInTheDocument();
  });
});
