import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LeaveCalendar } from ".";
import { englishLabels, octoberHolidays, octoberLeaves } from "./LeaveCalendar.fixtures";

function renderCalendar(props: Partial<Parameters<typeof LeaveCalendar>[0]> = {}) {
  const onSelectLeave = vi.fn();
  render(
    <LeaveCalendar
      monthStart="2026-10-01"
      todayIso="2026-10-08"
      leaves={octoberLeaves}
      holidays={octoberHolidays}
      locale="en"
      labels={englishLabels}
      onSelectLeave={onSelectLeave}
      {...props}
    />,
  );
  return { onSelectLeave };
}

describe("LeaveCalendar", () => {
  it("names each week and puts a leave crossing a weekend in both weeks", () => {
    renderCalendar();
    const week42 = screen.getByRole("listitem", { name: "Week 42" });
    const week43 = screen.getByRole("listitem", { name: "Week 43" });
    const name = /^You, vacation, 2026-10-14 to 2026-10-20/;

    expect(within(week42).getByRole("button", { name })).toBeInTheDocument();
    expect(within(week43).getByRole("button", { name })).toBeInTheDocument();
  });

  it("reports the selected leave", async () => {
    const { onSelectLeave } = renderCalendar();

    await userEvent.click(
      within(screen.getByRole("listitem", { name: "Week 42" })).getByRole("button", {
        name: /^Bence Nagy, away/,
      }),
    );

    expect(onSelectLeave).toHaveBeenCalledWith(expect.objectContaining({ id: "colleague-away" }));
  });

  it("labels holidays and today in text, not only in colour", () => {
    renderCalendar();
    const week43 = screen.getByRole("listitem", { name: "Week 43" });

    expect(within(week43).getAllByText("National Day").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Today").length).toBeGreaterThan(0);
  });

  it("only lists the kinds that are on screen in the legend", () => {
    renderCalendar({ leaves: octoberLeaves.filter((leave) => leave.kind === "absent") });
    const legend = screen.getAllByRole("list").at(-1)!;

    expect(within(legend).getByText("Away")).toBeInTheDocument();
    expect(within(legend).queryByText("Vacation")).not.toBeInTheDocument();
  });

  it("says so when nobody is away", () => {
    renderCalendar({ leaves: [], holidays: [] });

    expect(screen.getByText("Nobody is away this month.")).toBeInTheDocument();
  });
});
