import { describe, expect, it } from "vitest";
import { getInvoiceReminderOccurrence, getWeeklyOccurrence } from "./schedule";

describe("notification schedules", () => {
  it("uses the company timezone for the weekly occurrence", () => {
    expect(
      getWeeklyOccurrence({
        now: new Date("2026-08-28T14:01:00.000Z"),
        timezone: "Europe/Budapest",
        weekday: 5,
        time: "16:00",
      }),
    ).toMatchObject({ key: "weekly-hours:2026-08-28" });
  });

  it("does not emit the weekly occurrence before the configured wall time", () => {
    expect(
      getWeeklyOccurrence({
        now: new Date("2026-08-28T13:59:00.000Z"),
        timezone: "Europe/Budapest",
        weekday: 5,
        time: "16:00",
      }),
    ).toBeNull();
  });

  it("treats three invoice reminder days as exactly 72 elapsed hours", () => {
    const approvedAt = new Date("2026-08-21T12:30:00.000Z");
    expect(
      getInvoiceReminderOccurrence({
        now: new Date("2026-08-24T12:29:59.999Z"),
        approvedAt,
        initialDelayHours: 72,
        repeatIntervalHours: 24,
      }),
    ).toBeNull();
    expect(
      getInvoiceReminderOccurrence({
        now: new Date("2026-08-24T12:30:00.000Z"),
        approvedAt,
        initialDelayHours: 72,
        repeatIntervalHours: 24,
      }),
    ).toBe(0);
  });

  it("advances invoice reminder occurrences at exact elapsed intervals", () => {
    expect(
      getInvoiceReminderOccurrence({
        now: new Date("2026-08-25T12:30:00.000Z"),
        approvedAt: new Date("2026-08-21T12:30:00.000Z"),
        initialDelayHours: 72,
        repeatIntervalHours: 24,
      }),
    ).toBe(1);
  });
});
