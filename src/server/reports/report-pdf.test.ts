import { writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { buildReportExportTypstSource } from "./report-pdf";
import type { ReportInternalSnapshot, ReportSnapshot } from "./reports";

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

function createInternalSnapshot(): ReportInternalSnapshot {
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

describe("report PDF source", () => {
  it("keeps cost-free exports free from rates and amounts", () => {
    const source = buildReportExportTypstSource({
      title: "Client July report",
      snapshot: {
        ...baseSnapshot,
        mode: "COST_FREE",
        warnings: [],
      },
      locale: "en",
      generatedAt: new Date("2026-07-31T12:00:00.000Z"),
    });

    expect(source).toContain("Client July report");
    expect(source).toContain("Client workshop");
    expect(source).not.toContain("999.00");
    expect(source).not.toContain("EUR/h");
    expect(source).not.toContain("[Rate]");
    expect(source).not.toContain("[Amount]");
  });

  it("includes rates and amounts for internal exports", () => {
    const source = buildReportExportTypstSource({
      title: "Internal July report",
      snapshot: createInternalSnapshot(),
      locale: "en",
      generatedAt: new Date("2026-07-31T12:00:00.000Z"),
    });

    expect(source).toContain("[Rate]");
    expect(source).toContain("[Amount]");
    expect(source).toContain("EUR/h");
    expect(source).toContain("EUR");
  });

  it.runIf(process.env.RUN_TYPST_SMOKE === "1")(
    "renders the report source with the local Typst binary",
    async () => {
      const { renderTypstPdf } = await import("@/src/server/pdf/typst");
      const source = buildReportExportTypstSource({
        title: "Client July report",
        snapshot: {
          ...baseSnapshot,
          mode: "COST_FREE",
          warnings: [],
        },
        locale: "en",
        generatedAt: new Date("2026-07-31T12:00:00.000Z"),
      });

      const pdf = await renderTypstPdf(
        {
          source,
          filename: "report-pdf-smoke",
        },
        {
          timeoutMs: 10_000,
        },
      );

      if (process.env.REPORT_PDF_SMOKE_OUTPUT) {
        await writeFile(process.env.REPORT_PDF_SMOKE_OUTPUT, pdf);
      }

      expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");

      const internalPdf = await renderTypstPdf(
        {
          source: buildReportExportTypstSource({
            title: "Internal July report",
            snapshot: createInternalSnapshot(),
            locale: "en",
            generatedAt: new Date("2026-07-31T12:00:00.000Z"),
          }),
          filename: "report-pdf-smoke-internal",
        },
        {
          timeoutMs: 10_000,
        },
      );

      expect(internalPdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    },
  );
});
