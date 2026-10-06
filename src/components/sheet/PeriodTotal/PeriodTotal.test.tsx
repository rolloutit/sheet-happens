import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PeriodTotal } from ".";

describe("PeriodTotal", () => {
  it("renders one figure, one unit and one caption", () => {
    render(<PeriodTotal figure="36" unit="h" caption="this week" minutes={2160} />);

    expect(screen.getByText("36")).toBeInTheDocument();
    expect(screen.getByText("h")).toBeInTheDocument();
    expect(screen.getByText("this week")).toBeInTheDocument();
  });

  it("says a status in words beside its icon", () => {
    render(
      <PeriodTotal
        figure="8.5"
        unit="h"
        caption="today"
        minutes={510}
        status={{ tone: "warning", label: "over 8 h" }}
        secondary="14 of 22 workdays"
      />,
    );

    expect(screen.getByText("over 8 h")).toHaveClass("text-warning");
    expect(screen.getByText("14 of 22 workdays")).toBeInTheDocument();
  });

  it("swaps the figure exactly when it changes — never an in-between digit", () => {
    const { rerender } = render(
      <PeriodTotal figure="36" unit="h" caption="this week" minutes={2160} />,
    );

    rerender(<PeriodTotal figure="37.5" unit="h" caption="this week" minutes={2250} />);

    expect(screen.getByText("37.5")).toBeInTheDocument();
    expect(screen.queryByText(/^36\.\d/)).not.toBeInTheDocument();
  });
});
