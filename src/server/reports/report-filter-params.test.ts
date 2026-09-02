import { describe, expect, it } from "vitest";

import {
  parseReportExportLocale,
  parseReportSearchParams,
  reportExportFieldsFromFilters,
  resolveReportExportTitle,
} from "./report-filter-params";

const TIMEZONE = "Europe/Budapest";

describe("reportExportFieldsFromFilters", () => {
  it("carries an anchored period as the anchor alone", () => {
    const filters = parseReportSearchParams({ period: "month", anchor: "2026-07-01" }, TIMEZONE);

    expect(reportExportFieldsFromFilters(filters)).toEqual({
      period: "month",
      view: "USER",
      anchor: "2026-07-01",
    });
  });

  it("carries a custom period as explicit bounds instead of an anchor", () => {
    const filters = parseReportSearchParams(
      { period: "custom", start: "2026-07-03", end: "2026-07-21" },
      TIMEZONE,
    );
    const fields = reportExportFieldsFromFilters(filters);

    expect(fields).toEqual({
      period: "custom",
      view: "USER",
      start: "2026-07-03",
      end: "2026-07-21",
    });
    expect(fields.anchor).toBeUndefined();
  });

  it("omits filters that are not set", () => {
    const filters = parseReportSearchParams(
      { period: "month", anchor: "2026-07-01", project: "", group: "", member: "" },
      TIMEZONE,
    );
    const fields = reportExportFieldsFromFilters(filters);

    expect(Object.keys(fields).sort()).toEqual(["anchor", "period", "view"]);
  });

  it("round-trips back to the same filter set", () => {
    const filters = parseReportSearchParams(
      {
        period: "week",
        anchor: "2026-07-15",
        view: "PROJECT",
        project: "11111111-1111-4111-8111-111111111111",
        group: "22222222-2222-4222-8222-222222222222",
        member: "33333333-3333-4333-8333-333333333333",
      },
      TIMEZONE,
    );
    const roundTripped = parseReportSearchParams(reportExportFieldsFromFilters(filters), TIMEZONE);

    expect(roundTripped).toEqual(filters);
  });

  it("round-trips a custom period back to the same bounds", () => {
    const filters = parseReportSearchParams(
      { period: "custom", start: "2026-02-10", end: "2026-03-04", view: "PROJECT" },
      TIMEZONE,
    );
    const roundTripped = parseReportSearchParams(reportExportFieldsFromFilters(filters), TIMEZONE);

    expect(roundTripped).toEqual(filters);
  });
});

describe("parseReportExportLocale", () => {
  it("keeps a supported language", () => {
    expect(parseReportExportLocale("en")).toBe("en");
    expect(parseReportExportLocale("hu")).toBe("hu");
  });

  it("falls back to the default language for anything else", () => {
    expect(parseReportExportLocale("de")).toBe("hu");
    expect(parseReportExportLocale("EN")).toBe("hu");
    expect(parseReportExportLocale("")).toBe("hu");
    expect(parseReportExportLocale(null)).toBe("hu");
    expect(parseReportExportLocale(undefined)).toBe("hu");
  });

  it("falls back when the form field is not a string", () => {
    expect(parseReportExportLocale(new File([], "en"))).toBe("hu");
  });
});

describe("resolveReportExportTitle", () => {
  const period = { start: "2026-07-01", end: "2026-07-31" };

  it("collapses whitespace in a supplied title", () => {
    expect(resolveReportExportTitle("  Diapro   June    hours ", period)).toBe("Diapro June hours");
  });

  it("caps the title at 120 characters", () => {
    expect(resolveReportExportTitle("a".repeat(200), period)).toHaveLength(120);
  });

  it("falls back to the period when the title is blank or missing", () => {
    const fallback = "Time report 2026-07-01 2026-07-31";

    expect(resolveReportExportTitle("   ", period)).toBe(fallback);
    expect(resolveReportExportTitle(null, period)).toBe(fallback);
    expect(resolveReportExportTitle(undefined, period)).toBe(fallback);
  });
});
