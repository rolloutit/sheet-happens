import { describe, expect, it } from "vitest";

import { buildLeaveAgenda, buildLeaveWeeks } from "./LeaveCalendar.model";
import type { LeaveCalendarLeave } from "./LeaveCalendar.types";

function leave(
  overrides: Partial<LeaveCalendarLeave> & Pick<LeaveCalendarLeave, "id">,
): LeaveCalendarLeave {
  return {
    memberId: overrides.id,
    memberName: overrides.id,
    kind: "vacation",
    dayPart: "FULL",
    startDate: "2026-10-12",
    endDate: "2026-10-16",
    workdays: 5,
    isOwn: false,
    ...overrides,
  };
}

const october = (leaves: LeaveCalendarLeave[]) =>
  buildLeaveWeeks({
    monthStart: "2026-10-01",
    todayIso: "2026-10-08",
    leaves,
    holidays: [{ date: "2026-10-23", name: "Nemzeti ünnep" }],
  });

describe("buildLeaveWeeks", () => {
  it("lays October 2026 out as five Monday-first weeks with holidays and today marked", () => {
    const weeks = october([]);

    expect(weeks.map((week) => week.weekStart)).toEqual([
      "2026-09-28",
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
    ]);
    expect(weeks[0]?.days[0]).toMatchObject({ isoDate: "2026-09-28", inMonth: false });
    expect(weeks[1]?.days[3]).toMatchObject({ isoDate: "2026-10-08", today: true });
    expect(weeks[3]?.days[4]).toMatchObject({ holiday: "Nemzeti ünnep", weekend: false });
    expect(weeks[3]?.days[5]?.weekend).toBe(true);
  });

  it("splits a leave that crosses a weekend into one segment per week", () => {
    const weeks = october([leave({ id: "a", startDate: "2026-10-15", endDate: "2026-10-20" })]);

    expect(weeks[2]?.segments[0]).toMatchObject({
      startColumn: 3,
      span: 4,
      continuesBefore: false,
      continuesAfter: true,
    });
    expect(weeks[3]?.segments[0]).toMatchObject({
      startColumn: 0,
      span: 2,
      continuesBefore: true,
      continuesAfter: false,
    });
  });

  it("stacks overlapping leaves on separate lanes and reuses a lane once it is free", () => {
    const weeks = october([
      leave({ id: "a", startDate: "2026-10-12", endDate: "2026-10-13" }),
      leave({ id: "b", startDate: "2026-10-13", endDate: "2026-10-14" }),
      leave({ id: "c", startDate: "2026-10-15", endDate: "2026-10-16" }),
    ]);
    const lanes = Object.fromEntries(weeks[2]!.segments.map((s) => [s.leave.id, s.lane]));

    expect(lanes).toEqual({ a: 0, b: 1, c: 0 });
    expect(weeks[2]?.laneCount).toBe(2);
  });

  it("puts a morning and an afternoon of the same day on one lane", () => {
    const weeks = october([
      leave({ id: "a", startDate: "2026-10-14", endDate: "2026-10-14", dayPart: "MORNING" }),
      leave({ id: "b", startDate: "2026-10-14", endDate: "2026-10-14", dayPart: "AFTERNOON" }),
    ]);

    expect(weeks[2]?.laneCount).toBe(1);
  });

  it("keeps the viewer's own leave on the top lane", () => {
    const weeks = october([
      leave({ id: "colleague", startDate: "2026-10-12" }),
      leave({ id: "mine", startDate: "2026-10-14", isOwn: true }),
    ]);

    expect(weeks[2]?.segments.find((s) => s.leave.id === "mine")?.lane).toBe(0);
  });
});

describe("buildLeaveAgenda", () => {
  it("lists the workdays a leave covers and the holidays, nothing else", () => {
    const agenda = buildLeaveAgenda(
      october([leave({ id: "a", startDate: "2026-10-22", endDate: "2026-10-26" })]),
    );

    expect(agenda.map(({ day, leaves }) => [day.isoDate, leaves.length])).toEqual([
      ["2026-10-22", 1],
      ["2026-10-23", 1],
      ["2026-10-26", 1],
    ]);
  });
});
