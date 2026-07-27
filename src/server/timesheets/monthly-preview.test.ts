import { describe, expect, it } from "vitest";

import {
  aggregateTimesheetPreviewLines,
  resolveTimesheetLineRate,
  type TimesheetPreviewLine,
  type TimesheetPreviewRatePeriod,
} from "./monthly-preview";

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function rate(overrides: Partial<TimesheetPreviewRatePeriod> = {}): TimesheetPreviewRatePeriod {
  return {
    id: overrides.id ?? "rate-1",
    validFrom: overrides.validFrom ?? dateOnly("2026-07-01"),
    validTo: overrides.validTo ?? null,
    hourlyRate: overrides.hourlyRate ?? "100.00",
    currencyCode: overrides.currencyCode ?? "EUR",
  };
}

describe("timesheet monthly preview", () => {
  it("uses project override rates before member default rates", () => {
    expect(
      resolveTimesheetLineRate({
        localDate: dateOnly("2026-07-12"),
        memberRates: [rate({ id: "member-rate", hourlyRate: "80.00" })],
        assignmentRates: [rate({ id: "override-rate", hourlyRate: "120.00" })],
      }),
    ).toEqual({
      hourlyRate: "120.00",
      currencyCode: "EUR",
      source: "PROJECT_OVERRIDE",
    });
  });

  it("falls back to the effective member default rate", () => {
    expect(
      resolveTimesheetLineRate({
        localDate: dateOnly("2026-08-01"),
        memberRates: [
          rate({
            id: "old-rate",
            validFrom: dateOnly("2026-07-01"),
            validTo: dateOnly("2026-08-01"),
            hourlyRate: "70.00",
          }),
          rate({
            id: "new-rate",
            validFrom: dateOnly("2026-08-01"),
            hourlyRate: "90.00",
          }),
        ],
        assignmentRates: [],
      }),
    ).toEqual({
      hourlyRate: "90.00",
      currencyCode: "EUR",
      source: "MEMBER_DEFAULT",
    });
  });

  it("aggregates project totals and flags missing or mixed rates", () => {
    const lines: TimesheetPreviewLine[] = [
      {
        id: "entry-1",
        projectId: "project-1",
        projectName: "Client Portal",
        projectColor: "#147c7c",
        localDate: dateOnly("2026-07-01"),
        durationMinutes: 120,
        rate: {
          hourlyRate: "100.00",
          currencyCode: "EUR",
          source: "MEMBER_DEFAULT",
        },
        amountCents: 20_000,
      },
      {
        id: "entry-2",
        projectId: "project-1",
        projectName: "Client Portal",
        projectColor: "#147c7c",
        localDate: dateOnly("2026-07-02"),
        durationMinutes: 60,
        rate: null,
        amountCents: null,
      },
      {
        id: "entry-3",
        projectId: "project-2",
        projectName: "Data Migration",
        projectColor: "#d4962a",
        localDate: dateOnly("2026-07-03"),
        durationMinutes: 30,
        rate: {
          hourlyRate: "25000.00",
          currencyCode: "HUF",
          source: "PROJECT_OVERRIDE",
        },
        amountCents: 1_250_000,
      },
    ];

    expect(aggregateTimesheetPreviewLines(lines)).toEqual({
      totalMinutes: 210,
      entryCount: 3,
      missingRateLineCount: 1,
      currencyCode: null,
      mixedCurrency: true,
      totalAmount: null,
      projects: [
        {
          projectId: "project-1",
          projectName: "Client Portal",
          projectColor: "#147c7c",
          totalMinutes: 180,
          entryCount: 2,
          singleRate: {
            hourlyRate: "100.00",
            currencyCode: "EUR",
            source: "MEMBER_DEFAULT",
          },
          mixedRates: false,
          missingRateLineCount: 1,
          currencyCode: "EUR",
          mixedCurrency: false,
          amount: "200.00",
        },
        {
          projectId: "project-2",
          projectName: "Data Migration",
          projectColor: "#d4962a",
          totalMinutes: 30,
          entryCount: 1,
          singleRate: {
            hourlyRate: "25000.00",
            currencyCode: "HUF",
            source: "PROJECT_OVERRIDE",
          },
          mixedRates: false,
          missingRateLineCount: 0,
          currencyCode: "HUF",
          mixedCurrency: false,
          amount: "12500.00",
        },
      ],
    });
  });
});
