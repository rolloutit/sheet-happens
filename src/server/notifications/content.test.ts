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
});
