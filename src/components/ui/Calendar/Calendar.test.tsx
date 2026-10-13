import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Calendar } from ".";
import type { CalendarRangeValue } from "./Calendar.types";

function ControlledRange({ initial = {} }: { initial?: CalendarRangeValue }) {
  const [value, setValue] = useState<CalendarRangeValue>(initial);
  return (
    <>
      <Calendar mode="range" locale="en" min="2026-10-01" value={value} onValueChange={setValue} />
      <output data-testid="range">{`${value.from ?? "-"} to ${value.to ?? "-"}`}</output>
    </>
  );
}

const day = (name: string) => screen.getByRole("button", { name: new RegExp(name) });

describe("Calendar range mode", () => {
  it("picks a range with two clicks", async () => {
    render(<ControlledRange />);
    await userEvent.click(day("October 22, 2026"));
    await userEvent.click(day("October 27, 2026"));

    expect(screen.getByTestId("range")).toHaveTextContent("2026-10-22 to 2026-10-27");
  });

  it("starts over when a multi-day range is already complete", async () => {
    render(<ControlledRange initial={{ from: "2026-10-05", to: "2026-10-09" }} />);
    await userEvent.click(day("October 20, 2026"));

    expect(screen.getByTestId("range")).toHaveTextContent("2026-10-20 to -");
  });
});
