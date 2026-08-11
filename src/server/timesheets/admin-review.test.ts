import { describe, expect, it } from "vitest";

import { normalizeMonthInput } from "./admin-review";
import { toMonthValue } from "@/src/lib/date-values";

/**
 * The admin timesheet list filters by month through a search param that must be exactly
 * `YYYY-MM`. Anything else is dropped to an empty string, which removes the filter with no
 * error and no visible signal — the admin just sees every month at once, which is a bad way
 * to find out while approving a financial snapshot.
 *
 * These assertions pin the parser against the shape `MonthPicker` emits, from both ends.
 */
describe("normalizeMonthInput", () => {
  it("accepts the shape MonthPicker emits", () => {
    expect(normalizeMonthInput("2026-06")).toBe("2026-06");
    expect(normalizeMonthInput(toMonthValue(new Date(Date.UTC(2026, 5, 24))))).toBe("2026-06");
  });

  it("drops a full date, the most plausible way a picker would break this", () => {
    expect(normalizeMonthInput("2026-06-01")).toBe("");
  });

  it("drops anything else that is not YYYY-MM", () => {
    expect(normalizeMonthInput("")).toBe("");
    expect(normalizeMonthInput("2026-6")).toBe("");
    expect(normalizeMonthInput("2026")).toBe("");
    expect(normalizeMonthInput("June 2026")).toBe("");
  });

  it("tolerates surrounding whitespace, as a hand-edited URL might carry", () => {
    expect(normalizeMonthInput("  2026-06  ")).toBe("2026-06");
  });
});
