import { describe, expect, it } from "vitest";

import {
  calculateAverageWeekMinutes,
  deriveFlaggedUsers,
  deriveMissingTimesheetCount,
  deriveMissingTimesheetRows,
  getContractorMonthEndSteps,
  parseAdminDashboardDrilldown,
} from "./dashboard";

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

describe("dashboard helpers", () => {
  it("flags active member/project pairs only when no weekly entry or inactive marker exists", () => {
    const flagged = deriveFlaggedUsers({
      assignments: [
        {
          memberId: "member-1",
          projectId: "project-1",
          member: {
            id: "member-1",
            displayName: "Anna Toth",
            firstName: "Anna",
            lastName: "Toth",
            email: "anna@example.com",
          },
          project: {
            id: "project-1",
            name: "Client Portal",
            colorToken: "violet",
          },
        },
        {
          memberId: "member-1",
          projectId: "project-2",
          member: {
            id: "member-1",
            displayName: "Anna Toth",
            firstName: "Anna",
            lastName: "Toth",
            email: "anna@example.com",
          },
          project: {
            id: "project-2",
            name: "Internal Tools",
            colorToken: "teal",
          },
        },
        {
          memberId: "member-2",
          projectId: "project-1",
          member: {
            id: "member-2",
            displayName: "Bela Kiss",
            firstName: "Bela",
            lastName: "Kiss",
            email: "bela@example.com",
          },
          project: {
            id: "project-1",
            name: "Client Portal",
            colorToken: "violet",
          },
        },
      ],
      entries: [{ memberId: "member-1", projectId: "project-2" }],
      inactiveWeeks: [{ memberId: "member-2", projectId: "project-1" }],
      lastLoggedEntries: [
        {
          memberId: "member-1",
          projectId: "project-1",
          localDate: dateOnly("2026-07-10"),
        },
      ],
    });

    expect(flagged).toEqual([
      expect.objectContaining({
        id: "member-1:project-1",
        memberName: "Anna Toth",
        projectName: "Client Portal",
        lastLoggedDate: "2026-07-10",
      }),
    ]);
  });

  it("deduplicates contractors when deriving missing timesheets", () => {
    expect(
      deriveMissingTimesheetCount({
        expectedContractors: [
          { memberId: "contractor-1" },
          { memberId: "contractor-1" },
          { memberId: "contractor-2" },
          { memberId: "contractor-3" },
        ],
        existingTimesheets: [
          { contractorMemberId: "contractor-2" },
          { contractorMemberId: "contractor-4" },
        ],
      }),
    ).toBe(2);
  });

  it("derives missing timesheet rows from expected contractors and monthly time", () => {
    const rows = deriveMissingTimesheetRows({
      expectedContractors: [
        {
          memberId: "contractor-1",
          projectId: "project-1",
          member: {
            id: "contractor-1",
            displayName: "Contractor One",
            firstName: "Contractor",
            lastName: "One",
            email: "one@example.com",
          },
        },
        {
          memberId: "contractor-1",
          projectId: "project-2",
          member: {
            id: "contractor-1",
            displayName: "Contractor One",
            firstName: "Contractor",
            lastName: "One",
            email: "one@example.com",
          },
        },
        {
          memberId: "contractor-2",
          projectId: "project-3",
          member: {
            id: "contractor-2",
            displayName: "Contractor Two",
            firstName: "Contractor",
            lastName: "Two",
            email: "two@example.com",
          },
        },
      ],
      timeEntries: [
        {
          memberId: "contractor-1",
          durationMinutes: 120,
          localDate: dateOnly("2026-07-05"),
          member: {
            id: "contractor-1",
            displayName: "Contractor One",
            firstName: "Contractor",
            lastName: "One",
            email: "one@example.com",
          },
        },
        {
          memberId: "contractor-1",
          durationMinutes: 60,
          localDate: dateOnly("2026-07-18"),
          member: {
            id: "contractor-1",
            displayName: "Contractor One",
            firstName: "Contractor",
            lastName: "One",
            email: "one@example.com",
          },
        },
        {
          memberId: "contractor-3",
          durationMinutes: 30,
          localDate: dateOnly("2026-07-10"),
          member: {
            id: "contractor-3",
            displayName: "Contractor Three",
            firstName: "Contractor",
            lastName: "Three",
            email: "three@example.com",
          },
        },
      ],
      existingTimesheets: [{ contractorMemberId: "contractor-2" }],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        memberId: "contractor-1",
        activeProjectCount: 2,
        monthMinutes: 180,
        lastLoggedDate: "2026-07-18",
      }),
      expect.objectContaining({
        memberId: "contractor-3",
        activeProjectCount: 0,
        monthMinutes: 30,
        lastLoggedDate: "2026-07-10",
      }),
    ]);
  });

  it("averages current-month minutes over elapsed weeks", () => {
    expect(
      calculateAverageWeekMinutes({
        monthMinutes: 1_200,
        monthStart: "2026-07-01",
        today: "2026-07-15",
      }),
    ).toBe(400);
  });

  it("marks contractor month-end steps from timesheet status", () => {
    expect(getContractorMonthEndSteps("not_created")).toEqual([
      { id: "assemble", state: "active" },
      { id: "submit", state: "disabled" },
      { id: "invoice", state: "disabled" },
    ]);
    expect(getContractorMonthEndSteps("approved")).toEqual([
      { id: "assemble", state: "done" },
      { id: "submit", state: "done" },
      { id: "invoice", state: "active" },
    ]);
    expect(getContractorMonthEndSteps("paid")).toEqual([
      { id: "assemble", state: "done" },
      { id: "submit", state: "done" },
      { id: "invoice", state: "done" },
    ]);
  });

  it("parses admin dashboard drilldown values defensively", () => {
    expect(parseAdminDashboardDrilldown(" submitted ")).toBe("submitted");
    expect(parseAdminDashboardDrilldown(["FLAGGED"])).toBe("flagged");
    expect(parseAdminDashboardDrilldown("paid")).toBeNull();
    expect(parseAdminDashboardDrilldown(undefined)).toBeNull();
  });
});
