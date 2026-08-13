import { describe, expect, it } from "vitest";

import { getManualTopicsForAccess, resolveHelpLocale } from "./manual-content";

describe("manual content access", () => {
  it("shows all topics to employees but hides contractor and admin details", () => {
    const topics = getManualTopicsForAccess({
      locale: "en",
      role: "MEMBER",
      profile: "EMPLOYEE",
    });

    expect(topics.map((topic) => topic.id)).toContain("contractor-timesheets");
    expect(topics.find((topic) => topic.id === "time-tracking")?.accessible).toBe(true);
    expect(topics.find((topic) => topic.id === "contractor-timesheets")?.accessible).toBe(false);
    expect(topics.find((topic) => topic.id === "employee-payslips")?.accessible).toBe(true);
    expect(topics.find((topic) => topic.id === "people")?.accessible).toBe(false);
  });

  it("allows contractors to read contractor topics but not admin topics", () => {
    const topics = getManualTopicsForAccess({
      locale: "en",
      role: "MEMBER",
      profile: "CONTRACTOR",
    });

    expect(topics.find((topic) => topic.id === "contractor-timesheets")?.accessible).toBe(true);
    expect(topics.find((topic) => topic.id === "employee-payslips")?.accessible).toBe(false);
    expect(topics.find((topic) => topic.id === "projects")?.accessible).toBe(false);
  });

  it("allows admins to read every topic", () => {
    const topics = getManualTopicsForAccess({
      locale: "hu",
      role: "ADMIN",
      profile: "EMPLOYEE",
    });

    expect(topics.length).toBeGreaterThan(0);
    expect(topics.every((topic) => topic.accessible)).toBe(true);
  });

  it("falls back to English for unknown locales", () => {
    expect(resolveHelpLocale("de")).toBe("en");
    expect(resolveHelpLocale("hu")).toBe("hu");
  });
});
