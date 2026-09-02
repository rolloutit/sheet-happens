import type { ReportCostFreeSnapshot, ReportInternalSnapshot, ReportSnapshot } from "./reports";

/**
 * Deterministic report snapshots for tests and for rendering a PDF without a database.
 *
 * Test and development use only — nothing in the request path imports this.
 */

const baseSnapshot = {
  schemaVersion: 1,
  generatedAt: "2026-07-31T12:00:00.000Z",
  view: "USER",
  period: {
    start: "2026-07-01",
    end: "2026-07-31",
    boundary: "member_timezone",
    timezones: ["Europe/Budapest"],
  },
  filters: {
    projectId: null,
    projectName: null,
    projectGroupId: null,
    projectGroupName: null,
    memberId: null,
    memberName: null,
  },
  summary: {
    totalMinutes: 180,
    entryCount: 1,
    peopleCount: 1,
    projectCount: 1,
    averageMinutesPerPerson: 180,
  },
  groups: [
    {
      key: "member-1",
      kind: "USER",
      label: "Contractor Example",
      totalMinutes: 180,
      entryCount: 1,
      percentageOfTotal: 100,
      color: null,
      initials: "CE",
      profile: "CONTRACTOR",
      isInternalProject: null,
    },
  ],
  lines: [
    {
      id: "entry-1",
      localDate: "2026-07-12",
      durationMinutes: 180,
      description: "Client workshop",
      source: "FORM",
      member: {
        id: "member-1",
        name: "Contractor Example",
        email: "contractor@example.com",
        initials: "CE",
        profile: "CONTRACTOR",
        timezone: "Europe/Budapest",
      },
      project: {
        id: "project-1",
        name: "Client Portal",
        color: "#1f807f",
        isInternal: false,
      },
    },
  ],
} satisfies Omit<ReportSnapshot, "mode" | "warnings">;

export function createCostFreeReportSnapshot(): ReportCostFreeSnapshot {
  return {
    ...baseSnapshot,
    mode: "COST_FREE",
    warnings: [],
  };
}

export function createInternalReportSnapshot(): ReportInternalSnapshot {
  return {
    ...baseSnapshot,
    mode: "INTERNAL",
    summary: {
      ...baseSnapshot.summary,
      currencyTotals: [{ currencyCode: "EUR", amount: "300.00" }],
      missingRateLineCount: 0,
      mixedCurrency: false,
    },
    groups: [
      {
        ...baseSnapshot.groups[0],
        currencyTotals: [{ currencyCode: "EUR", amount: "300.00" }],
        missingRateLineCount: 0,
        mixedCurrency: false,
      },
    ],
    lines: [
      {
        ...baseSnapshot.lines[0],
        rate: {
          hourlyRate: "100.00",
          currencyCode: "EUR",
          source: "MEMBER_DEFAULT",
          sourceRatePeriodId: "rate-1",
        },
        currencyCode: "EUR",
        amount: "300.00",
      },
    ],
    warnings: [],
  };
}

/** An internal snapshot with a rate-less line, so the missing-rate fallbacks are exercised. */
export function createInternalReportSnapshotWithWarnings(): ReportInternalSnapshot {
  const snapshot = createInternalReportSnapshot();

  return {
    ...snapshot,
    summary: {
      ...snapshot.summary,
      missingRateLineCount: 1,
      mixedCurrency: true,
    },
    lines: [
      ...snapshot.lines,
      {
        ...snapshot.lines[0],
        id: "entry-2",
        localDate: "2026-07-13",
        description: "",
        rate: null,
        currencyCode: null,
        amount: null,
      },
    ],
    warnings: [
      { code: "MISSING_RATE", lineCount: 1 },
      { code: "MIXED_CURRENCY", currencyCodes: ["EUR", "USD"] },
    ],
  };
}
