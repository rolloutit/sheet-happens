import { describe, expect, it, vi } from "vitest";

import {
  buildReportSnapshot,
  buildReportTimeEntryWhere,
  getTimeEntryReportSnapshot,
  normalizeReportFilters,
  resolveReportLineRate,
  type ReportRatePeriodRecord,
  type ReportTimeEntryRecord,
} from "./reports";

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function rate(overrides: Partial<ReportRatePeriodRecord> = {}): ReportRatePeriodRecord {
  return {
    id: overrides.id ?? "rate-1",
    validFrom: overrides.validFrom ?? dateOnly("2026-07-01"),
    validTo: overrides.validTo ?? null,
    hourlyRate: overrides.hourlyRate ?? "100.00",
    currencyCode: overrides.currencyCode ?? "EUR",
  };
}

function entry(
  overrides: Partial<Omit<ReportTimeEntryRecord, "member" | "project" | "projectAssignment">> & {
    member?: Partial<ReportTimeEntryRecord["member"]>;
    project?: Partial<ReportTimeEntryRecord["project"]>;
    defaultRates?: ReportRatePeriodRecord[];
    overrideRates?: ReportRatePeriodRecord[];
  } = {},
): ReportTimeEntryRecord {
  const memberName = overrides.member?.displayName ?? "Contractor Example";

  return {
    id: overrides.id ?? "entry-1",
    localDate: overrides.localDate ?? dateOnly("2026-07-10"),
    durationMinutes: overrides.durationMinutes ?? 120,
    description: overrides.description ?? "Feature work",
    source: overrides.source ?? "GRID",
    timezone: overrides.timezone ?? overrides.member?.timezone ?? "Europe/Budapest",
    createdAt: overrides.createdAt ?? new Date("2026-07-10T10:00:00.000Z"),
    member: {
      id: overrides.member?.id ?? "member-1",
      email: overrides.member?.email ?? "contractor@example.com",
      firstName: overrides.member?.firstName ?? "Contractor",
      lastName: overrides.member?.lastName ?? "Example",
      displayName: memberName,
      currentProfile: overrides.member?.currentProfile ?? "CONTRACTOR",
      timezone: overrides.member?.timezone ?? "Europe/Budapest",
      defaultRatePeriods: overrides.defaultRates ?? [rate({ id: "member-rate" })],
    },
    project: {
      id: overrides.project?.id ?? "project-1",
      name: overrides.project?.name ?? "Client Portal",
      colorToken: overrides.project?.colorToken ?? "teal",
      isInternal: overrides.project?.isInternal ?? false,
    },
    projectAssignment: {
      overrideRates: overrides.overrideRates ?? [],
    },
  };
}

describe("report snapshots", () => {
  it("builds cost-free snapshots without rate or cost fields", () => {
    const filters = normalizeReportFilters({
      periodStart: dateOnly("2026-07-01"),
      periodEnd: dateOnly("2026-07-31"),
      mode: "COST_FREE",
      view: "USER",
    });

    const snapshot = buildReportSnapshot({
      entries: [
        entry({
          id: "entry-1",
          durationMinutes: 180,
          defaultRates: [rate({ hourlyRate: "999.00", currencyCode: "EUR" })],
        }),
      ],
      filters,
      generatedAt: new Date("2026-07-31T12:00:00.000Z"),
    });

    expect(snapshot).toMatchObject({
      mode: "COST_FREE",
      view: "USER",
      summary: {
        totalMinutes: 180,
        entryCount: 1,
        peopleCount: 1,
        projectCount: 1,
      },
      groups: [
        expect.objectContaining({
          kind: "USER",
          label: "Contractor Example",
          totalMinutes: 180,
        }),
      ],
      warnings: [],
    });
    expect(JSON.stringify(snapshot)).not.toContain("hourlyRate");
    expect(JSON.stringify(snapshot)).not.toContain("amount");
    expect(JSON.stringify(snapshot)).not.toContain("999.00");
  });

  it("builds internal project-view snapshots with effective rates and currency totals", () => {
    const filters = normalizeReportFilters({
      periodStart: dateOnly("2026-07-01"),
      periodEnd: dateOnly("2026-07-31"),
      mode: "INTERNAL",
      view: "PROJECT",
    });

    const snapshot = buildReportSnapshot({
      entries: [
        entry({
          id: "entry-1",
          durationMinutes: 120,
          defaultRates: [rate({ id: "member-rate", hourlyRate: "100.00" })],
          overrideRates: [rate({ id: "override-rate", hourlyRate: "150.00" })],
        }),
        entry({
          id: "entry-2",
          durationMinutes: 60,
          member: {
            id: "member-2",
            email: "employee@example.com",
            displayName: "Employee Example",
            currentProfile: "EMPLOYEE",
          },
          defaultRates: [
            rate({
              id: "employee-rate",
              hourlyRate: "25000.00",
              currencyCode: "HUF",
            }),
          ],
          overrideRates: [
            rate({
              id: "ignored-employee-override",
              hourlyRate: "500.00",
              currencyCode: "EUR",
            }),
          ],
        }),
      ],
      filters,
      generatedAt: new Date("2026-07-31T12:00:00.000Z"),
    });

    expect(snapshot).toMatchObject({
      mode: "INTERNAL",
      summary: {
        totalMinutes: 180,
        entryCount: 2,
        currencyTotals: [
          { currencyCode: "EUR", amount: "300.00" },
          { currencyCode: "HUF", amount: "25000.00" },
        ],
        missingRateLineCount: 0,
        mixedCurrency: true,
      },
      groups: [
        expect.objectContaining({
          kind: "PROJECT",
          label: "Client Portal",
          totalMinutes: 180,
          currencyTotals: [
            { currencyCode: "EUR", amount: "300.00" },
            { currencyCode: "HUF", amount: "25000.00" },
          ],
          mixedCurrency: true,
        }),
      ],
      warnings: [
        {
          code: "MIXED_CURRENCY",
          currencyCodes: ["EUR", "HUF"],
        },
      ],
    });
    expect(snapshot.lines[0]).toMatchObject({
      rate: {
        hourlyRate: "150.00",
        currencyCode: "EUR",
        source: "PROJECT_OVERRIDE",
        sourceRatePeriodId: "override-rate",
      },
      amount: "300.00",
    });
    expect(snapshot.lines[1]).toMatchObject({
      rate: {
        hourlyRate: "25000.00",
        currencyCode: "HUF",
        source: "MEMBER_DEFAULT",
        sourceRatePeriodId: "employee-rate",
      },
      amount: "25000.00",
    });
  });

  it("reports missing internal rates without blocking snapshot generation", () => {
    const filters = normalizeReportFilters({
      periodStart: dateOnly("2026-07-01"),
      periodEnd: dateOnly("2026-07-31"),
      mode: "INTERNAL",
    });

    const snapshot = buildReportSnapshot({
      entries: [
        entry({
          defaultRates: [],
          overrideRates: [],
        }),
      ],
      filters,
      generatedAt: new Date("2026-07-31T12:00:00.000Z"),
    });

    if (snapshot.mode !== "INTERNAL") {
      throw new Error("Expected an internal report snapshot.");
    }

    expect(snapshot.summary.missingRateLineCount).toBe(1);
    expect(snapshot.summary.currencyTotals).toEqual([]);
    expect(snapshot.warnings).toEqual([{ code: "MISSING_RATE", lineCount: 1 }]);
    expect(snapshot.lines[0]).toMatchObject({
      rate: null,
      currencyCode: null,
      amount: null,
    });
  });

  it("uses project overrides only for contractors", () => {
    expect(
      resolveReportLineRate({
        memberProfile: "EMPLOYEE",
        localDate: dateOnly("2026-07-12"),
        memberRates: [rate({ id: "employee-rate", hourlyRate: "80.00" })],
        assignmentRates: [rate({ id: "override-rate", hourlyRate: "150.00" })],
      }),
    ).toEqual({
      hourlyRate: "80.00",
      currencyCode: "EUR",
      source: "MEMBER_DEFAULT",
      sourceRatePeriodId: "employee-rate",
    });

    expect(
      resolveReportLineRate({
        memberProfile: "CONTRACTOR",
        localDate: dateOnly("2026-07-12"),
        memberRates: [rate({ id: "contractor-rate", hourlyRate: "80.00" })],
        assignmentRates: [rate({ id: "override-rate", hourlyRate: "150.00" })],
      }),
    ).toEqual({
      hourlyRate: "150.00",
      currencyCode: "EUR",
      source: "PROJECT_OVERRIDE",
      sourceRatePeriodId: "override-rate",
    });
  });

  it("builds project group filters against project memberships", () => {
    const filters = normalizeReportFilters({
      periodStart: dateOnly("2026-07-01"),
      periodEnd: dateOnly("2026-07-31"),
      projectGroupId: "group-1",
      memberId: "member-1",
    });

    expect(buildReportTimeEntryWhere(filters)).toEqual({
      deletedAt: null,
      localDate: {
        gte: dateOnly("2026-07-01"),
        lte: dateOnly("2026-07-31"),
      },
      memberId: "member-1",
      project: {
        groupProjects: {
          some: {
            projectGroupId: "group-1",
          },
        },
      },
    });
  });

  it("queries entries by stored member-local dates and keeps involved timezones in the snapshot", async () => {
    const entries = [
      entry({
        id: "entry-1",
        localDate: dateOnly("2026-07-01"),
        timezone: "Europe/Budapest",
        member: {
          timezone: "Europe/Budapest",
        },
      }),
      entry({
        id: "entry-2",
        localDate: dateOnly("2026-07-01"),
        timezone: "America/New_York",
        member: {
          id: "member-2",
          email: "new-york@example.com",
          displayName: "New York User",
          timezone: "America/New_York",
        },
      }),
    ];
    const db = {
      timeEntry: {
        findMany: vi.fn().mockResolvedValue(entries),
      },
      project: {
        findUnique: vi.fn().mockResolvedValue({ name: "Client Portal" }),
      },
      projectGroup: {
        findUnique: vi.fn().mockResolvedValue({ name: "Client Work" }),
      },
      member: {
        findUnique: vi.fn().mockResolvedValue({
          email: "contractor@example.com",
          firstName: "Contractor",
          lastName: "Example",
          displayName: "Contractor Example",
        }),
      },
    };

    const snapshot = await getTimeEntryReportSnapshot(
      {
        periodStart: dateOnly("2026-07-01"),
        periodEnd: dateOnly("2026-07-01"),
        projectId: "project-1",
        projectGroupId: "group-1",
        memberId: "member-1",
      },
      {
        db,
        now: () => new Date("2026-07-31T12:00:00.000Z"),
      },
    );

    expect(db.timeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          localDate: {
            gte: dateOnly("2026-07-01"),
            lte: dateOnly("2026-07-01"),
          },
          memberId: "member-1",
          projectId: "project-1",
          project: {
            groupProjects: {
              some: {
                projectGroupId: "group-1",
              },
            },
          },
        },
      }),
    );
    expect(snapshot.period).toEqual({
      start: "2026-07-01",
      end: "2026-07-01",
      boundary: "member_timezone",
      timezones: ["America/New_York", "Europe/Budapest"],
    });
    expect(snapshot.filters).toMatchObject({
      projectName: "Client Portal",
      projectGroupName: "Client Work",
      memberName: "Contractor Example",
    });
  });
});
