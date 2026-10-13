import { describe, expect, it } from "vitest";

import { buildNotificationContent } from "./content";

describe("notification content", () => {
  it("renders weekly missing projects in both supported locales", () => {
    const metadata = { projectNames: ["Apollo", "Internal"] };

    expect(buildNotificationContent("WEEKLY_HOURS_REMINDER", "en", metadata).body).toContain(
      "Apollo, Internal",
    );
    expect(buildNotificationContent("WEEKLY_HOURS_REMINDER", "hu", metadata).body).toContain(
      "Apollo, Internal",
    );
  });

  it("includes rejection reasons without changing the stored metadata", () => {
    const metadata = { periodStart: "2026-08-01", reason: "Incorrect total" };

    expect(buildNotificationContent("INVOICE_REJECTED", "en", metadata).body).toContain(
      "Incorrect total",
    );
    expect(metadata).toEqual({ periodStart: "2026-08-01", reason: "Incorrect total" });
  });

  it("names the month in the leave reminder subject and keeps the deadline in the body", () => {
    const hu = buildNotificationContent("LEAVE_MONTH_END_REMINDER", "hu", {
      periodStart: "2026-10-01",
    });
    const en = buildNotificationContent("LEAVE_MONTH_END_REMINDER", "en", {
      periodStart: "2026-10-01",
    });

    expect(hu.emailSubject).toContain("október");
    expect(hu.body).toContain("holnap 12:00-ig");
    expect(en.emailSubject).toContain("October");
    expect(en.body).toContain("12:00 tomorrow");
  });

  it("names the kind and the days of a leave an admin recorded", () => {
    const sick = { type: "SICK", startDate: "2026-09-14", endDate: "2026-09-16", dayPart: "FULL" };
    const half = {
      type: "VACATION",
      startDate: "2026-09-14",
      endDate: "2026-09-14",
      dayPart: "MORNING",
    };

    const en = buildNotificationContent("LEAVE_RECORDED_BY_ADMIN", "en", sick);
    expect(en.title).toBe("An admin recorded leave for you");
    expect(en.body).toBe("An admin recorded your time off: sick leave, Sep 14 – 16, 2026.");
    expect(buildNotificationContent("LEAVE_RECORDED_BY_ADMIN", "hu", sick).body).toContain(
      "betegszabadság, 2026. szept. 14–16.",
    );
    expect(buildNotificationContent("LEAVE_RECORDED_BY_ADMIN", "hu", half).body).toContain(
      "szabadság, 2026. szept. 14. (délelőtt)",
    );
  });
});
