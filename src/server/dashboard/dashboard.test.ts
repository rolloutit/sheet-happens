import { describe, expect, it } from "vitest";

import {
  buildEmployeeMonthlyProjectBreakdown,
  calculateAverageWeekMinutes,
  deriveFlaggedUsers,
  deriveMissingTimesheetCount,
  deriveMissingTimesheetRows,
  getContractorDashboardNextAction,
  getGreetingName,
  parseAdminDashboardDrilldown,
} from "./dashboard";

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

describe("dashboard helpers", () => {
  it("builds employee monthly project breakdown from effective own rates", () => {
    const breakdown = buildEmployeeMonthlyProjectBreakdown({
      entries: [
        {
          id: "entry-1",
          projectId: "project-1",
          localDate: dateOnly("2026-07-10"),
          durationMinutes: 120,
          project: {
            id: "project-1",
            name: "Client Portal",
            colorToken: "violet",
          },
        },
        {
          id: "entry-2",
          projectId: "project-1",
          localDate: dateOnly("2026-07-20"),
          durationMinutes: 60,
          project: {
            id: "project-1",
            name: "Client Portal",
            colorToken: "violet",
          },
        },
        {
          id: "entry-3",
          projectId: "project-2",
          localDate: dateOnly("2026-07-15"),
          durationMinutes: 30,
          project: {
            id: "project-2",
            name: "Internal Tools",
            colorToken: "teal",
          },
        },
      ],
      ratePeriods: [
        {
          id: "rate-1",
          validFrom: dateOnly("2026-07-01"),
          validTo: dateOnly("2026-07-15"),
          hourlyRate: "100.00",
          currencyCode: "EUR",
        },
        {
          id: "rate-2",
          validFrom: dateOnly("2026-07-15"),
          validTo: null,
          hourlyRate: "120.00",
          currencyCode: "EUR",
        },
      ],
    });

    expect(breakdown).toEqual([
      expect.objectContaining({
        projectId: "project-1",
        totalMinutes: 180,
        entryCount: 2,
        singleRate: null,
        mixedRates: true,
        missingRateLineCount: 0,
        costTotals: [{ currencyCode: "EUR", amount: "320.00" }],
      }),
      expect.objectContaining({
        projectId: "project-2",
        totalMinutes: 30,
        entryCount: 1,
        singleRate: {
          hourlyRate: "120.00",
          currencyCode: "EUR",
        },
        mixedRates: false,
        missingRateLineCount: 0,
        costTotals: [{ currencyCode: "EUR", amount: "60.00" }],
      }),
    ]);
  });

  it("marks employee project lines with missing or mixed-currency rates", () => {
    const breakdown = buildEmployeeMonthlyProjectBreakdown({
      entries: [
        {
          id: "entry-1",
          projectId: "project-1",
          localDate: dateOnly("2026-06-30"),
          durationMinutes: 60,
          project: {
            id: "project-1",
            name: "Client Portal",
            colorToken: "violet",
          },
        },
        {
          id: "entry-2",
          projectId: "project-1",
          localDate: dateOnly("2026-07-20"),
          durationMinutes: 60,
          project: {
            id: "project-1",
            name: "Client Portal",
            colorToken: "violet",
          },
        },
        {
          id: "entry-3",
          projectId: "project-1",
          localDate: dateOnly("2026-08-01"),
          durationMinutes: 60,
          project: {
            id: "project-1",
            name: "Client Portal",
            colorToken: "violet",
          },
        },
      ],
      ratePeriods: [
        {
          id: "rate-1",
          validFrom: dateOnly("2026-07-01"),
          validTo: dateOnly("2026-08-01"),
          hourlyRate: "100.00",
          currencyCode: "EUR",
        },
        {
          id: "rate-2",
          validFrom: dateOnly("2026-08-01"),
          validTo: null,
          hourlyRate: "100.00",
          currencyCode: "HUF",
        },
      ],
    });

    expect(breakdown[0]).toEqual(
      expect.objectContaining({
        projectId: "project-1",
        totalMinutes: 180,
        singleRate: null,
        mixedRates: true,
        mixedCurrency: true,
        missingRateLineCount: 1,
        costTotals: [
          { currencyCode: "EUR", amount: "100.00" },
          { currencyCode: "HUF", amount: "100.00" },
        ],
      }),
    );
  });

  /**
   * The rows every flagged-user assertion below is built from.
   *
   * `trackingMode: null` inherits the member default, which is how a real assignment is stored
   * unless an admin overrode it — so the default shape here exercises the same resolution the
   * production rows do rather than a shortcut past it.
   */
  function flaggedAssignment(
    memberId: string,
    projectId: string,
    overrides: Partial<Parameters<typeof deriveFlaggedUsers>[0]["assignments"][number]> = {},
  ): Parameters<typeof deriveFlaggedUsers>[0]["assignments"][number] {
    const names: Record<string, { display: string; first: string; last: string; email: string }> = {
      "member-1": {
        display: "Anna Toth",
        first: "Anna",
        last: "Toth",
        email: "anna@example.com",
      },
      "member-2": {
        display: "Bela Kiss",
        first: "Bela",
        last: "Kiss",
        email: "bela@example.com",
      },
    };
    const projects: Record<string, { name: string; colorToken: string }> = {
      "project-1": { name: "Client Portal", colorToken: "violet" },
      "project-2": { name: "Internal Tools", colorToken: "teal" },
      "project-3": { name: "Nimbus", colorToken: "orchid" },
    };
    const person = names[memberId] ?? names["member-1"]!;
    const project = projects[projectId] ?? projects["project-1"]!;

    return {
      memberId,
      projectId,
      trackingMode: null,
      validFrom: dateOnly("2024-01-01"),
      member: {
        id: memberId,
        displayName: person.display,
        firstName: person.first,
        lastName: person.last,
        email: person.email,
        defaultTrackingMode: "TRACKED",
      },
      project: {
        id: projectId,
        name: project.name,
        colorToken: project.colorToken,
      },
      ...overrides,
    };
  }

  it("flags active member/project pairs only when no weekly entry or inactive marker exists", () => {
    const flagged = deriveFlaggedUsers({
      assignments: [
        flaggedAssignment("member-1", "project-1"),
        flaggedAssignment("member-1", "project-2"),
        flaggedAssignment("member-2", "project-1"),
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

  /**
   * §4 item 4. A declared pair's materialized entry would satisfy the weekly check unchanged, but a
   * declared project is *expected* to have nothing until the member declares near month end — so a
   * weekly flag would nag for three weeks out of four and train people to ignore the panel.
   */
  it("flags a declared assignment on a monthly rhythm, not a weekly one", () => {
    const declaredPair = flaggedAssignment("member-1", "project-3", {
      trackingMode: "DECLARED",
    });

    // Nothing logged this week, but the last ended month was declared: not flagged.
    expect(
      deriveFlaggedUsers({
        assignments: [declaredPair],
        entries: [],
        inactiveWeeks: [],
        lastLoggedEntries: [],
        declarations: [{ memberId: "member-1", projectId: "project-3" }],
        declaredMonthEnd: "2026-08-31",
      }),
    ).toEqual([]);

    // The last ended month holds no declaration: flagged, whatever this week looks like.
    expect(
      deriveFlaggedUsers({
        assignments: [declaredPair],
        entries: [],
        inactiveWeeks: [],
        lastLoggedEntries: [],
        declarations: [],
        declaredMonthEnd: "2026-08-31",
      }),
    ).toEqual([expect.objectContaining({ id: "member-1:project-3" })]);
  });

  /** An assignment that began after the last month closed had nothing to declare for it. */
  it("does not flag a declared assignment that started after the last ended month", () => {
    expect(
      deriveFlaggedUsers({
        assignments: [
          flaggedAssignment("member-1", "project-3", {
            trackingMode: "DECLARED",
            validFrom: dateOnly("2026-09-01"),
          }),
        ],
        entries: [],
        inactiveWeeks: [],
        lastLoggedEntries: [],
        declarations: [],
        declaredMonthEnd: "2026-08-31",
      }),
    ).toEqual([]);
  });

  /**
   * `InactiveProjectWeek` says "nothing happened on this project this week", which is not a
   * statement anyone can make about a monthly figure — so it must not excuse a missing declaration.
   */
  it("ignores an inactive-week marker for a declared assignment", () => {
    expect(
      deriveFlaggedUsers({
        assignments: [flaggedAssignment("member-1", "project-3", { trackingMode: "DECLARED" })],
        entries: [{ memberId: "member-1", projectId: "project-3" }],
        inactiveWeeks: [{ memberId: "member-1", projectId: "project-3" }],
        lastLoggedEntries: [],
        declarations: [],
        declaredMonthEnd: "2026-08-31",
      }),
    ).toEqual([expect.objectContaining({ id: "member-1:project-3" })]);
  });

  /** The mode is resolved, not read: a `null` override inherits a declared member default. */
  it("reads a declared member default through an inheriting assignment", () => {
    expect(
      deriveFlaggedUsers({
        assignments: [
          flaggedAssignment("member-1", "project-3", {
            member: {
              id: "member-1",
              displayName: "Anna Toth",
              firstName: "Anna",
              lastName: "Toth",
              email: "anna@example.com",
              defaultTrackingMode: "DECLARED",
            },
          }),
        ],
        entries: [],
        inactiveWeeks: [],
        lastLoggedEntries: [],
        declarations: [{ memberId: "member-1", projectId: "project-3" }],
        declaredMonthEnd: "2026-08-31",
      }),
    ).toEqual([]);
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

  it("greets a member by first name whatever order the display name uses", () => {
    expect(
      getGreetingName({
        displayName: "Réka Szabó",
        firstName: "Réka",
        lastName: "Szabó",
      }),
    ).toBe("Réka");
    expect(
      getGreetingName({
        displayName: "Szabó Réka",
        firstName: " Réka ",
        lastName: "Szabó",
      }),
    ).toBe("Réka");
  });

  it("falls back to the display name when the first name is blank", () => {
    expect(getGreetingName({ displayName: "Ops Desk", firstName: " ", lastName: "" })).toBe(
      "Ops Desk",
    );
  });

  it("derives the contractor's next action from the month-end workflow", () => {
    const base = {
      selectedMonth: "2026-07",
      totalMinutes: 480,
      missingRateLineCount: 0,
      mixedCurrency: false,
      invoices: [],
    } as const;

    expect(getContractorDashboardNextAction({ ...base, status: "not_created" })).toEqual({
      id: "review_and_submit",
      href: "/timesheets?month=2026-07",
    });
    expect(
      getContractorDashboardNextAction({ ...base, status: "not_created", totalMinutes: 0 }),
    ).toEqual({ id: "record_time", href: "/time" });
    expect(
      getContractorDashboardNextAction({ ...base, status: "not_created", mixedCurrency: true }),
    ).toEqual({ id: "resolve_rates", href: "/timesheets?month=2026-07" });
    expect(getContractorDashboardNextAction({ ...base, status: "rejected" })).toEqual({
      id: "correct_timesheet",
      href: "/timesheets?month=2026-07",
    });
    expect(getContractorDashboardNextAction({ ...base, status: "submitted" })).toEqual({
      id: "awaiting_approval",
      href: "/timesheets?month=2026-07",
    });
    expect(getContractorDashboardNextAction({ ...base, status: "approved" })).toEqual({
      id: "upload_invoice",
      href: "/timesheets?month=2026-07",
    });
    expect(getContractorDashboardNextAction({ ...base, status: "invoiced" })).toEqual({
      id: "awaiting_invoice_review",
      href: "/timesheets?month=2026-07",
    });
    expect(getContractorDashboardNextAction({ ...base, status: "accepted" })).toEqual({
      id: "awaiting_payment",
      href: "/timesheets?month=2026-07",
    });
    expect(getContractorDashboardNextAction({ ...base, status: "paid" })).toEqual({
      id: "complete",
      href: "/timesheets?month=2026-07",
    });
  });

  it("requires a cancellation invoice before a corrected replacement invoice", () => {
    const base = {
      status: "invoice_rejected" as const,
      selectedMonth: "2026-07",
      totalMinutes: 480,
      missingRateLineCount: 0,
      mixedCurrency: false,
    };

    expect(getContractorDashboardNextAction({ ...base, invoices: [] })).toEqual({
      id: "review_invoice_rejection",
      href: "/timesheets?month=2026-07",
    });
    expect(
      getContractorDashboardNextAction({
        ...base,
        invoices: [
          {
            id: "original",
            role: "original",
            status: "rejected",
            referencesInvoiceId: null,
          },
        ],
      }),
    ).toEqual({ id: "upload_cancellation_invoice", href: "/timesheets?month=2026-07" });
    expect(
      getContractorDashboardNextAction({
        ...base,
        invoices: [
          {
            id: "original",
            role: "original",
            status: "rejected",
            referencesInvoiceId: null,
          },
          {
            id: "cancellation",
            role: "cancellation",
            status: "uploaded",
            referencesInvoiceId: "original",
          },
        ],
      }),
    ).toEqual({ id: "upload_replacement_invoice", href: "/timesheets?month=2026-07" });
  });

  it("parses admin dashboard drilldown values defensively", () => {
    expect(parseAdminDashboardDrilldown(" submitted ")).toBe("submitted");
    expect(parseAdminDashboardDrilldown(["FLAGGED"])).toBe("flagged");
    expect(parseAdminDashboardDrilldown("paid")).toBeNull();
    expect(parseAdminDashboardDrilldown(undefined)).toBeNull();
  });
});
