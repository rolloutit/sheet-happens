import { describe, expect, it } from "vitest";

import { buildOwnRatesView } from "./own-rates";

const today = new Date("2026-08-23T00:00:00.000Z");

function rate(
  id: string,
  validFrom: string,
  validTo: string | null,
  hourlyRate: string,
  currencyCode = "HUF",
) {
  return {
    id,
    validFrom: new Date(`${validFrom}T00:00:00.000Z`),
    validTo: validTo ? new Date(`${validTo}T00:00:00.000Z`) : null,
    hourlyRate: { toString: () => hourlyRate },
    currencyCode,
  };
}

describe("own rates view", () => {
  it("returns only the central timeline for employees", () => {
    const result = buildOwnRatesView({
      profile: "EMPLOYEE",
      today,
      centralPeriods: [
        rate("current", "2026-01-01", null, "10000"),
        rate("past", "2024-01-01", "2026-01-01", "9000"),
      ],
      assignments: [
        {
          id: "assignment",
          project: { id: "project", name: "Hidden", colorToken: "rose" },
          overrideRates: [rate("override", "2026-01-01", null, "12000")],
        },
      ],
    });

    expect(result.projectRates).toEqual([]);
    expect(result.centralPeriods).toEqual([
      expect.objectContaining({ id: "current", current: true, validTo: null }),
      expect.objectContaining({ id: "past", current: false, validTo: "2025-12-31" }),
    ]);
  });

  it("prefers a current project override and falls back to the central rate", () => {
    const centralPeriods = [rate("central", "2026-01-01", null, "18000")];
    const result = buildOwnRatesView({
      profile: "CONTRACTOR",
      today,
      centralPeriods,
      assignments: [
        {
          id: "override-assignment",
          project: { id: "override-project", name: "Aurora", colorToken: "violet" },
          overrideRates: [rate("override", "2026-06-01", null, "22000", "EUR")],
        },
        {
          id: "central-assignment",
          project: { id: "central-project", name: "Diapro", colorToken: "cyan" },
          overrideRates: [],
        },
      ],
    });

    expect(result.projectRates).toEqual([
      expect.objectContaining({
        projectId: "override-project",
        source: "override",
        hourlyRate: "22000",
        currencyCode: "EUR",
      }),
      expect.objectContaining({
        projectId: "central-project",
        source: "central",
        hourlyRate: "18000",
        currencyCode: "HUF",
      }),
    ]);
  });

  it("reports a missing project rate without manufacturing a zero rate", () => {
    const result = buildOwnRatesView({
      profile: "CONTRACTOR",
      today,
      centralPeriods: [],
      assignments: [
        {
          id: "assignment",
          project: { id: "project", name: "No rate", colorToken: "unknown" },
          overrideRates: [],
        },
      ],
    });

    expect(result.projectRates[0]).toEqual(
      expect.objectContaining({ source: "missing", hourlyRate: null, currencyCode: null }),
    );
  });
});
