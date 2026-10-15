import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * §4 item 3: L1-L3 must not be able to see a declared entry **at all**.
 *
 * The rule is "exclude at the query, not at the render", and the reason it matters is that the
 * alternative is unfalsifiable: a filter applied on the way out has to be repeated in every
 * aggregate the week payload feeds — the day totals, the week total, the cell warnings, the overlap
 * check, the soft and hard daily limits — and a new one added later would simply forget it. So the
 * assertion here is about the `where` clause rather than about the rows, because the `where` is
 * what makes the guarantee total.
 */

const timeEntryFindMany = vi.fn();
const timeEntryGroupBy = vi.fn();

vi.mock("@/src/server/db/client", () => ({
  prisma: {
    member: {
      findUnique: vi.fn(async () => ({
        id: "member-1",
        timezone: "Europe/Budapest",
        deletedAt: null,
        defaultTrackingMode: "TRACKED",
      })),
    },
    periodLock: { findMany: vi.fn(async () => []) },
    projectAssignment: { findMany: vi.fn(async () => []) },
    timeEntry: {
      findMany: (args: unknown) => timeEntryFindMany(args),
      groupBy: (args: unknown) => timeEntryGroupBy(args),
    },
    runningTimer: { findUnique: vi.fn(async () => null) },
    inactiveProjectWeek: { findMany: vi.fn(async () => []) },
    timeEntryDraft: { findUnique: vi.fn(async () => null) },
    leave: { findMany: vi.fn(async () => []) },
  },
}));

const { getMemberWeeklyTimeGrid } = await import("./time-entries");

describe("getMemberWeeklyTimeGrid", () => {
  beforeEach(() => {
    timeEntryFindMany.mockReset();
    timeEntryFindMany.mockResolvedValue([]);
    timeEntryGroupBy.mockReset();
    timeEntryGroupBy.mockResolvedValue([]);
  });

  it("excludes declared entries from the week, at the query", async () => {
    await getMemberWeeklyTimeGrid({
      memberId: "member-1",
      weekStart: new Date("2026-08-31T00:00:00.000Z"),
      now: new Date("2026-09-02T09:00:00.000Z"),
    });

    // Both reads of `timeEntry`: the week's own entries, and the 90-day lookback the "recent"
    // chips come from. A declared project must not become a chip that opens the entry form.
    expect(timeEntryFindMany).toHaveBeenCalledTimes(2);
    // And the third, which is a `groupBy`: the description suggestions. A declaration note is not
    // a description of work, and the project it belongs to cannot take a per-day entry anyway.
    expect(timeEntryGroupBy).toHaveBeenCalledTimes(1);

    for (const call of [...timeEntryFindMany.mock.calls, ...timeEntryGroupBy.mock.calls]) {
      const args = call[0] as { where: { source?: { not?: string } } };
      expect(args.where.source).toEqual({ not: "DECLARED" });
    }
  });
});
