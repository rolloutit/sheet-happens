import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusPill, statusPillVariants, statusTone, statusToneVar, timesheetStatuses } from ".";

describe("StatusPill", () => {
  it("renders the default status label", () => {
    render(<StatusPill status="invoice_rejected" />);
    expect(screen.getByText("Invoice rejected")).toBeInTheDocument();
  });

  // The nine states used to share five tones. A status whose colour is also another status's
  // colour tells the reader nothing, so the mapping has to stay injective.
  it("gives every status its own tone", () => {
    const tones = timesheetStatuses.map((status) => statusTone[status]);
    expect(new Set(tones).size).toBe(timesheetStatuses.length);
  });

  it("resolves every tone to its own colour token", () => {
    const vars = timesheetStatuses.map((status) => statusToneVar[statusTone[status]]);
    expect(new Set(vars).size).toBe(timesheetStatuses.length);
  });

  it("emits a distinct class set per status", () => {
    const classes = timesheetStatuses.map((status) =>
      statusPillVariants({ tone: statusTone[status] }),
    );
    expect(new Set(classes).size).toBe(timesheetStatuses.length);
  });

  it("puts invoiced on the yellow pending tone", () => {
    expect(statusTone.invoiced).toBe("pending");
    expect(statusToneVar.pending).toBe("var(--pending)");
  });
});
