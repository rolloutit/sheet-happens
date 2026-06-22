import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusPill } from ".";

describe("StatusPill", () => {
  it("renders the default status label", () => {
    render(<StatusPill status="invoice_rejected" />);
    expect(screen.getByText("Invoice rejected")).toBeInTheDocument();
  });
});
