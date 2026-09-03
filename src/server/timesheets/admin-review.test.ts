import { describe, expect, it, vi } from "vitest";

import {
  approveTimesheetsForAdmin,
  buildTimesheetWhere,
  normalizeAdminTimesheetFilters,
  normalizeMonthInput,
  TimesheetReviewError,
} from "./admin-review";
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

/**
 * Status, contractor and project accept several values, which arrive as repeated query
 * parameters. The failure these pin down is silent in both directions: a filter that keeps
 * only the first value narrows the list too far with no error, and one that reaches Prisma
 * as `equals` instead of `in` returns nothing at all for two selections.
 */
describe("normalizeAdminTimesheetFilters", () => {
  it("reads every value of a repeated parameter", () => {
    const filters = normalizeAdminTimesheetFilters({
      status: ["SUBMITTED", "REJECTED"],
      contractor: ["member-1", "member-2"],
      project: ["project-1", "project-2"],
    });

    expect(filters.statuses).toEqual(["SUBMITTED", "REJECTED"]);
    expect(filters.contractorMemberIds).toEqual(["member-1", "member-2"]);
    expect(filters.projectIds).toEqual(["project-1", "project-2"]);
  });

  it("keeps a single value working, so existing links do not change meaning", () => {
    expect(normalizeAdminTimesheetFilters({ status: "PAID" }).statuses).toEqual(["PAID"]);
  });

  it("drops unknown statuses but keeps the real ones alongside them", () => {
    const filters = normalizeAdminTimesheetFilters({ status: ["submitted", "RETIRED"] });

    expect(filters.statuses).toEqual(["SUBMITTED"]);
  });

  /**
   * `listSearchParam` dedups the raw values, but the status filter upper-cases afterwards —
   * so without a second pass two chips would share a React key and the trigger would read
   * "2 selected" for one status.
   */
  it("collapses values that differ only in case", () => {
    expect(normalizeAdminTimesheetFilters({ status: ["submitted", "SUBMITTED"] }).statuses).toEqual(
      ["SUBMITTED"],
    );
  });

  it("treats an absent or blank filter as every status", () => {
    expect(normalizeAdminTimesheetFilters({}).statuses).toEqual([]);
    expect(normalizeAdminTimesheetFilters({ status: ["", " "] }).statuses).toEqual([]);
  });

  it("leaves paid timesheets out until the checkbox asks for them", () => {
    expect(normalizeAdminTimesheetFilters({}).includePaid).toBe(false);
    expect(normalizeAdminTimesheetFilters({ includePaid: "1" }).includePaid).toBe(true);
  });

  /**
   * The toolbar submits `1`, but the value is the kind of thing a bookmarked or hand-typed
   * URL carries in whatever shape its author expected — and a flag that silently reads as
   * `false` hides rows the admin explicitly asked to see.
   */
  it("accepts the other spellings a checkbox param arrives in", () => {
    for (const value of ["true", "on", "yes", " TRUE "]) {
      expect(normalizeAdminTimesheetFilters({ includePaid: value }).includePaid).toBe(true);
    }

    for (const value of ["", "0", "false", "off", "maybe"]) {
      expect(normalizeAdminTimesheetFilters({ includePaid: value }).includePaid).toBe(false);
    }
  });
});

describe("buildTimesheetWhere", () => {
  const empty = normalizeAdminTimesheetFilters({});

  it("matches any of the chosen statuses", () => {
    const where = buildTimesheetWhere({ ...empty, statuses: ["SUBMITTED", "REJECTED"] });

    expect(where.AND).toEqual([
      { status: { in: ["SUBMITTED", "REJECTED"] } },
      { status: { not: "PAID" } },
    ]);
  });

  it("matches a timesheet with a line on any of the chosen projects", () => {
    const where = buildTimesheetWhere({
      ...empty,
      includePaid: true,
      projectIds: ["project-1", "project-2"],
    });

    expect(where.AND).toEqual([
      {
        currentRevision: {
          is: { snapshotLines: { some: { projectId: { in: ["project-1", "project-2"] } } } },
        },
      },
    ]);
  });

  /**
   * The one filter that applies itself. A paid month is closed business, so it stays off the
   * review queue until asked for — which means the default `where` is never empty, and the
   * assertion that used to say so now pins the exclusion instead.
   */
  it("excludes paid timesheets by default", () => {
    expect(buildTimesheetWhere(empty).AND).toEqual([{ status: { not: "PAID" } }]);
  });

  it("adds no clause once the paid filter is ticked", () => {
    expect(buildTimesheetWhere({ ...empty, includePaid: true })).toEqual({});
  });

  /**
   * Otherwise `?status=PAID` — the link the dashboard and a saved bookmark both produce —
   * would combine into `status IN ('PAID') AND status <> 'PAID'` and return nothing, which
   * reads as lost data rather than as a default.
   */
  it("keeps paid rows when the status filter names PAID, ticked or not", () => {
    expect(buildTimesheetWhere({ ...empty, statuses: ["PAID"] }).AND).toEqual([
      { status: { in: ["PAID"] } },
    ]);
    expect(buildTimesheetWhere({ ...empty, statuses: ["SUBMITTED", "PAID"] }).AND).toEqual([
      { status: { in: ["SUBMITTED", "PAID"] } },
    ]);
  });

  it("still excludes paid rows alongside a status filter that does not name it", () => {
    expect(buildTimesheetWhere({ ...empty, statuses: ["SUBMITTED"] }).AND).toEqual([
      { status: { in: ["SUBMITTED"] } },
      { status: { not: "PAID" } },
    ]);
  });
});

describe("approveTimesheetsForAdmin", () => {
  function createDb(statuses: Record<string, "SUBMITTED" | "APPROVED">) {
    const records = new Map(
      Object.entries(statuses).map(([id, status]) => [
        id,
        {
          id,
          status,
          periodStart: new Date("2026-06-01T00:00:00.000Z"),
          periodEnd: new Date("2026-06-30T00:00:00.000Z"),
          currentRevisionId: `revision-${id}`,
          currentRevision: {
            id: `revision-${id}`,
            revisionNumber: 1,
            totalMinutes: 480,
            totalAmount: { toString: () => "1000.00" },
            currencyCode: "HUF",
            snapshotLines: [{ id: `line-${id}`, projectId: "project-1" }],
          },
        },
      ]),
    );
    const tx = {
      timesheet: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => records.get(where.id)),
        updateMany: vi.fn(async ({ where }: { where: { id: string; status: string } }) => {
          const record = records.get(where.id);
          if (!record || record.status !== where.status) return { count: 0 };
          record.status = "APPROVED";
          return { count: 1 };
        }),
      },
      timesheetRevision: {
        update: vi.fn().mockResolvedValue({ id: "revision" }),
      },
      timesheetEvent: {
        create: vi.fn().mockResolvedValue({ id: "event" }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit" }),
      },
    };
    const db = {
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };

    return { db, tx };
  }

  it("approves each unique selection with its normal event and audit record", async () => {
    const { db, tx } = createDb({ first: "SUBMITTED", second: "SUBMITTED" });

    const result = await approveTimesheetsForAdmin(
      {
        timesheetIds: ["first", "first", "second"],
        actorMemberId: "admin-1",
      },
      { db: db as never, now: new Date("2026-06-30T12:00:00.000Z") },
    );

    expect(result).toEqual({ approvedCount: 2, timesheetIds: ["first", "second"] });
    expect(tx.timesheet.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.timesheetRevision.update).toHaveBeenCalledTimes(2);
    expect(tx.timesheetEvent.create).toHaveBeenCalledTimes(2);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(2);
  });

  it("rejects the batch when any selected timesheet is no longer submitted", async () => {
    const { db } = createDb({ first: "SUBMITTED", changed: "APPROVED" });

    await expect(
      approveTimesheetsForAdmin(
        {
          timesheetIds: ["first", "changed"],
          actorMemberId: "admin-1",
        },
        { db: db as never },
      ),
    ).rejects.toEqual(new TimesheetReviewError("Only submitted timesheets can be approved."));
  });

  it("rejects an empty selection before opening a transaction", async () => {
    const { db } = createDb({});

    await expect(
      approveTimesheetsForAdmin(
        { timesheetIds: [], actorMemberId: "admin-1" },
        { db: db as never },
      ),
    ).rejects.toEqual(new TimesheetReviewError("Select at least one timesheet to approve."));
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
