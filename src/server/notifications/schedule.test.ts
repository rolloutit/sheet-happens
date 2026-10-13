import { describe, expect, it } from "vitest";
import {
  getInvoiceReminderOccurrence,
  getMonthEndLeaveReminderOccurrence,
  getWeeklyOccurrence,
} from "./schedule";

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

  it.each([
    ["a 31-day month", "2026-10-30T08:00:00.000Z", "2026-10"],
    ["a 30-day month", "2026-09-29T07:00:00.000Z", "2026-09"],
    ["February in a common year", "2026-02-27T08:00:00.000Z", "2026-02"],
    ["February in a leap year", "2028-02-28T08:00:00.000Z", "2028-02"],
  ])("sends the leave reminder on the second-to-last day of %s", (_name, now, month) => {
    expect(
      getMonthEndLeaveReminderOccurrence({
        now: new Date(now),
        timezone: "Europe/Budapest",
        time: "09:00",
      }),
    ).toEqual({ key: `leave-month-end:${month}`, month });
  });

  it("does not send the leave reminder before 9:00 local time or on another day", () => {
    const at = (now: string) =>
      getMonthEndLeaveReminderOccurrence({
        now: new Date(now),
        timezone: "Europe/Budapest",
        time: "09:00",
      });

    // 08:59 in Budapest (UTC+1 in late October).
    expect(at("2026-10-30T07:59:00.000Z")).toBeNull();
    expect(at("2026-10-31T09:00:00.000Z")).toBeNull();
    expect(at("2026-10-29T09:00:00.000Z")).toBeNull();
  });

  it("reads the day in the company time zone, not in UTC", () => {
    // 22:30 UTC on 29 March is already 00:30 on the 30th in Budapest (UTC+2 since the 29th).
    expect(
      getMonthEndLeaveReminderOccurrence({
        now: new Date("2026-03-29T22:30:00.000Z"),
        timezone: "Europe/Budapest",
        time: "00:00",
      }),
    ).toEqual({ key: "leave-month-end:2026-03", month: "2026-03" });
  });
});
