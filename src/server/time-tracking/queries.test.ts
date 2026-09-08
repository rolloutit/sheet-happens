import { describe, expect, it, vi } from "vitest";

import { listMemberTimeEntries } from "./queries";
import type { TimeEntrySource } from "./time-entries";

const FROM = dateOnly("2026-09-01");
const TO = dateOnly("2026-09-30");

/*
 * The fake client below evaluates the `where` and `orderBy` this module builds against rows,
 * rather than recording the clause and agreeing with it.
 *
 * That distinction is the whole value of the pagination test: a spy that only remembers its
 * arguments cannot skip or repeat a row, so it would pass just as happily with a keyset that
 * loses every duration-only entry of the cursor's day. Something has to actually run the
 * predicate. It is deliberately minimal — the handful of operators this module uses and nothing
 * else, with an unknown one throwing rather than silently matching everything.
 */

type StoredEntry = {
  id: string;
  memberId: string;
  localDate: Date;
  projectId: string;
  projectName: string;
  durationMinutes: number;
  description: string;
  source: TimeEntrySource;
  startedAt: Date | null;
  endedAt: Date | null;
  timezone: string;
  lockedByTimesheetRevisionId: string | null;
  deletedAt: Date | null;
  updatedAt: Date;
};

type EntryInput = Omit<Partial<StoredEntry>, "localDate"> & {
  id: string;
  localDate: string;
};

type QueryArgs = {
  where: Record<string, unknown>;
  orderBy: readonly Record<string, unknown>[];
  take: number;
};

const comparisonOperators = new Set(["gt", "gte", "lt", "lte", "not", "equals"]);

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function at(value: string) {
  return new Date(`${value}:00.000Z`);
}

function entry(input: EntryInput): StoredEntry {
  return {
    memberId: "member-1",
    projectId: "project-atlas",
    projectName: "Atlas Platform",
    durationMinutes: 60,
    description: "Report filters",
    source: "GRID",
    startedAt: null,
    endedAt: null,
    timezone: "Europe/Budapest",
    lockedByTimesheetRevisionId: null,
    deletedAt: null,
    updatedAt: new Date("2026-09-05T10:00:00.000Z"),
    ...input,
    localDate: dateOnly(input.localDate),
  };
}

function createDb(entries: StoredEntry[]) {
  const findMany = vi.fn(async (args: QueryArgs) =>
    sortRows(
      entries.filter((row) => matchesFilter(asRecord(row), args.where)),
      args.orderBy,
    )
      .slice(0, args.take)
      .map(toSelectedRecord),
  );

  return { db: { timeEntry: { findMany } }, findMany };
}

/** Only the selected columns, so the module cannot read a field it forgot to ask the database for. */
function toSelectedRecord(row: StoredEntry) {
  return {
    id: row.id,
    localDate: row.localDate,
    projectId: row.projectId,
    durationMinutes: row.durationMinutes,
    description: row.description,
    source: row.source,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    timezone: row.timezone,
    lockedByTimesheetRevisionId: row.lockedByTimesheetRevisionId,
    updatedAt: row.updatedAt,
    project: {
      name: row.projectName,
    },
  };
}

function matchesFilter(row: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, condition]) => {
    if (key === "AND") {
      return (condition as Record<string, unknown>[]).every((clause) => matchesFilter(row, clause));
    }

    if (key === "OR") {
      return (condition as Record<string, unknown>[]).some((clause) => matchesFilter(row, clause));
    }

    if (isOperatorObject(condition)) {
      return Object.entries(condition).every(([operator, operand]) =>
        applyOperator(operator, row[key], operand),
      );
    }

    return isEqual(row[key], condition);
  });
}

function isOperatorObject(condition: unknown): condition is Record<string, unknown> {
  if (!condition || typeof condition !== "object" || condition instanceof Date) return false;

  const keys = Object.keys(condition);

  return keys.length > 0 && keys.every((key) => comparisonOperators.has(key));
}

function applyOperator(operator: string, value: unknown, operand: unknown) {
  if (operator === "not") return !isEqual(value, operand);
  if (operator === "equals") return isEqual(value, operand);

  // SQL's three-valued logic: an inequality against NULL is unknown, so the row drops out. That is
  // exactly what has to hold for a nulls-last keyset — a duration-only row must not satisfy
  // `startedAt > <instant>` — so the fake would flatter the predicate if it guessed otherwise.
  if (value === null || value === undefined || operand === null || operand === undefined) {
    return false;
  }

  const left = toComparable(value);
  const right = toComparable(operand);

  switch (operator) {
    case "gt":
      return left > right;
    case "gte":
      return left >= right;
    case "lt":
      return left < right;
    case "lte":
      return left <= right;
    default:
      throw new Error(`The fake query engine does not implement "${operator}".`);
  }
}

/** ISO strings, because a fixed-width ISO timestamp sorts lexically the way it sorts in time. */
function toComparable(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value);
}

function isEqual(value: unknown, operand: unknown) {
  if (value instanceof Date && operand instanceof Date) {
    return value.getTime() === operand.getTime();
  }

  return value === operand;
}

function sortRows(rows: StoredEntry[], orderBy: readonly Record<string, unknown>[]) {
  return [...rows].sort((left, right) => {
    for (const clause of orderBy) {
      const [field, spec] = Object.entries(clause)[0] as [string, unknown];
      const direction = typeof spec === "string" ? spec : (spec as { sort: string }).sort;
      const nulls =
        typeof spec === "string" ? "first" : ((spec as { nulls?: string }).nulls ?? "first");
      const compared = compareOrdered(asRecord(left)[field], asRecord(right)[field], nulls);

      if (compared !== 0) return direction === "desc" ? -compared : compared;
    }

    return 0;
  });
}

function compareOrdered(left: unknown, right: unknown, nulls: string) {
  const leftMissing = left === null || left === undefined;
  const rightMissing = right === null || right === undefined;

  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return nulls === "last" ? 1 : -1;
  if (rightMissing) return nulls === "last" ? -1 : 1;

  const a = toComparable(left);
  const b = toComparable(right);

  return a < b ? -1 : a > b ? 1 : 0;
}

function asRecord(row: StoredEntry) {
  return row as unknown as Record<string, unknown>;
}

describe("listMemberTimeEntries", () => {
  it("includes entries that fall exactly on `from` and on `to`", async () => {
    const { db } = createDb([
      entry({ id: "before", localDate: "2026-08-31" }),
      entry({ id: "on-from", localDate: "2026-09-01" }),
      entry({ id: "inside", localDate: "2026-09-15" }),
      entry({ id: "on-to", localDate: "2026-09-30" }),
      entry({ id: "after", localDate: "2026-10-01" }),
    ]);

    const result = await listMemberTimeEntries(
      { memberId: "member-1", from: FROM, to: TO },
      { db: db as never },
    );

    expect(result.entries.map((row) => row.id)).toEqual(["on-from", "inside", "on-to"]);
    expect(result.entries.map((row) => row.date)).toEqual([
      "2026-09-01",
      "2026-09-15",
      "2026-09-30",
    ]);
    expect(result.range).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });

  it("reads only the passed member's entries", async () => {
    const { db } = createDb([
      entry({ id: "mine", localDate: "2026-09-02" }),
      entry({ id: "theirs", localDate: "2026-09-02", memberId: "member-2" }),
    ]);

    const result = await listMemberTimeEntries(
      { memberId: "member-1", from: FROM, to: TO },
      { db: db as never },
    );

    expect(result.entries.map((row) => row.id)).toEqual(["mine"]);
  });

  it("excludes declared entries by default and includes them on request", async () => {
    const rows = [
      entry({ id: "declared", localDate: "2026-09-01", source: "DECLARED" }),
      entry({ id: "tracked", localDate: "2026-09-02" }),
    ];

    const withoutDeclared = createDb(rows);
    const tracked = await listMemberTimeEntries(
      { memberId: "member-1", from: FROM, to: TO },
      { db: withoutDeclared.db as never },
    );

    expect(tracked.entries.map((row) => row.id)).toEqual(["tracked"]);
    expect(withoutDeclared.findMany.mock.calls[0]?.[0].where.source).toEqual({ not: "DECLARED" });

    const withDeclared = createDb(rows);
    const everything = await listMemberTimeEntries(
      { memberId: "member-1", from: FROM, to: TO, includeDeclared: true },
      { db: withDeclared.db as never },
    );

    expect(everything.entries.map((row) => row.id)).toEqual(["declared", "tracked"]);
    expect(withDeclared.findMany.mock.calls[0]?.[0].where).not.toHaveProperty("source");
  });

  it("never returns a soft-deleted entry, with or without `includeDeclared`", async () => {
    const rows = [
      entry({ id: "live", localDate: "2026-09-02" }),
      entry({
        id: "deleted-tracked",
        localDate: "2026-09-03",
        deletedAt: new Date("2026-09-04T08:00:00.000Z"),
      }),
      entry({
        id: "deleted-declared",
        localDate: "2026-09-01",
        source: "DECLARED",
        deletedAt: new Date("2026-09-04T08:00:00.000Z"),
      }),
    ];

    for (const includeDeclared of [false, true]) {
      const { db } = createDb(rows);
      const result = await listMemberTimeEntries(
        { memberId: "member-1", from: FROM, to: TO, includeDeclared },
        { db: db as never },
      );

      expect(result.entries.map((row) => row.id)).toEqual(["live"]);
    }
  });

  it("filters to one project when asked", async () => {
    const { db } = createDb([
      entry({ id: "atlas", localDate: "2026-09-02" }),
      entry({ id: "nimbus", localDate: "2026-09-03", projectId: "project-nimbus" }),
    ]);

    const result = await listMemberTimeEntries(
      { memberId: "member-1", from: FROM, to: TO, projectId: "project-nimbus" },
      { db: db as never },
    );

    expect(result.entries.map((row) => row.id)).toEqual(["nimbus"]);
  });

  it("clamps a limit below one up to a single row", async () => {
    const { db, findMany } = createDb([
      entry({ id: "first", localDate: "2026-09-01" }),
      entry({ id: "second", localDate: "2026-09-02" }),
      entry({ id: "third", localDate: "2026-09-03" }),
    ]);

    const result = await listMemberTimeEntries(
      { memberId: "member-1", from: FROM, to: TO, limit: 0 },
      { db: db as never },
    );

    expect(findMany.mock.calls[0]?.[0].take).toBe(2);
    expect(result.entries.map((row) => row.id)).toEqual(["first"]);
    expect(result.nextCursor).not.toBeNull();
  });

  it("clamps an oversized limit down to two hundred rows instead of refusing it", async () => {
    const { db, findMany } = createDb(
      Array.from({ length: 205 }, (_, index) =>
        entry({ id: `entry-${String(index).padStart(3, "0")}`, localDate: "2026-09-02" }),
      ),
    );

    const result = await listMemberTimeEntries(
      { memberId: "member-1", from: FROM, to: TO, limit: 5_000 },
      { db: db as never },
    );

    expect(findMany.mock.calls[0]?.[0].take).toBe(201);
    expect(result.entries).toHaveLength(200);
    expect(result.entries.at(-1)?.id).toBe("entry-199");
    expect(result.nextCursor).not.toBeNull();
  });

  it("walks a full range in pages with no overlap and no gap", async () => {
    const { db, findMany } = createDb([
      entry({ id: "entry-a", localDate: "2026-09-01", startedAt: at("2026-09-01T07:00") }),
      entry({ id: "entry-b", localDate: "2026-09-01", startedAt: at("2026-09-01T07:00") }),
      entry({ id: "entry-c", localDate: "2026-09-01", startedAt: at("2026-09-01T09:00") }),
      entry({ id: "entry-d", localDate: "2026-09-01" }),
      entry({ id: "entry-e", localDate: "2026-09-02" }),
      entry({ id: "entry-f", localDate: "2026-09-02", startedAt: at("2026-09-02T06:00") }),
      entry({ id: "entry-g", localDate: "2026-09-03" }),
    ]);

    const pages: { ids: string[]; minutes: number }[] = [];
    let cursor: string | null = null;

    do {
      const page = await listMemberTimeEntries(
        { memberId: "member-1", from: FROM, to: TO, limit: 3, cursor },
        { db: db as never },
      );

      pages.push({ ids: page.entries.map((row) => row.id), minutes: page.totals.minutes });
      cursor = page.nextCursor;
    } while (cursor);

    // The day, then the clock, then the id: two 07:00 entries split by id, the duration-only entry
    // after the timed ones of its own day, and 09-02's 06:00 entry ahead of 09-02's untimed one.
    expect(pages.map((page) => page.ids)).toEqual([
      ["entry-a", "entry-b", "entry-c"],
      ["entry-d", "entry-f", "entry-e"],
      ["entry-g"],
    ]);

    const walked = pages.flatMap((page) => page.ids);
    expect(walked).toHaveLength(7);
    expect(new Set(walked).size).toBe(7);

    // `totals` is the page, not the range: 3 x 60 minutes here, against 420 for the whole walk.
    expect(pages[0]?.minutes).toBe(180);

    // The cursor's own keyset, asserted because the rows above cannot prove *why* they are right:
    // the second page resumes strictly after the 09:00 entry of 09-01 and nowhere else.
    expect(findMany.mock.calls[1]?.[0].where.AND).toEqual([
      {
        OR: [
          { localDate: { gt: dateOnly("2026-09-01") } },
          {
            localDate: dateOnly("2026-09-01"),
            OR: [
              { startedAt: { gt: at("2026-09-01T09:00") } },
              { startedAt: at("2026-09-01T09:00"), id: { gt: "entry-c" } },
              { startedAt: null },
            ],
          },
        ],
      },
    ]);

    // And the untimed-cursor branch, which only has an id tiebreak left inside its day.
    expect(findMany.mock.calls[2]?.[0].where.AND).toEqual([
      {
        OR: [
          { localDate: { gt: dateOnly("2026-09-02") } },
          { localDate: dateOnly("2026-09-02"), startedAt: null, id: { gt: "entry-e" } },
        ],
      },
    ]);
  });

  /**
   * Refusing rather than restarting. An ignored cursor walks page 1 again, so a caller paging with a
   * corrupted one loops and double-counts the first page instead of learning anything. A thrown
   * `INVALID_CURSOR` is recoverable — drop the cursor and start over; a plausible wrong total is not.
   */
  it("refuses a cursor that cannot be read instead of silently restarting", async () => {
    const { db, findMany } = createDb([entry({ id: "first", localDate: "2026-09-01" })]);

    for (const cursor of ["not-base64-json", Buffer.from("{}", "utf8").toString("base64url")]) {
      await expect(
        listMemberTimeEntries(
          { memberId: "member-1", from: FROM, to: TO, cursor },
          {
            db: db as never,
          },
        ),
      ).rejects.toMatchObject({ name: "TimeTrackingError", code: "INVALID_CURSOR" });
    }

    // Nothing was queried: the cursor is rejected before the read.
    expect(findMany).not.toHaveBeenCalled();
  });

  it("treats an empty cursor as no cursor at all", async () => {
    const { db, findMany } = createDb([
      entry({ id: "first", localDate: "2026-09-01" }),
      entry({ id: "second", localDate: "2026-09-02" }),
    ]);

    const result = await listMemberTimeEntries(
      { memberId: "member-1", from: FROM, to: TO, cursor: "" },
      { db: db as never },
    );

    expect(result.entries.map((row) => row.id)).toEqual(["first", "second"]);
    expect(findMany.mock.calls[0]?.[0].where).not.toHaveProperty("AND");
  });

  it("marks an entry locked by a submitted timesheet revision", async () => {
    const { db } = createDb([
      entry({ id: "open", localDate: "2026-09-01" }),
      entry({
        id: "submitted",
        localDate: "2026-09-02",
        lockedByTimesheetRevisionId: "revision-7",
      }),
    ]);

    const result = await listMemberTimeEntries(
      { memberId: "member-1", from: FROM, to: TO },
      { db: db as never },
    );

    expect(result.entries.map((row) => ({ id: row.id, locked: row.locked }))).toEqual([
      { id: "open", locked: false },
      { id: "submitted", locked: true },
    ]);
  });

  it("formats each entry's times in the timezone that entry was stored with", async () => {
    const { db } = createDb([
      entry({
        id: "budapest",
        localDate: "2026-09-01",
        startedAt: at("2026-09-01T07:00"),
        endedAt: at("2026-09-01T10:30"),
        timezone: "Europe/Budapest",
      }),
      entry({
        id: "tokyo",
        localDate: "2026-09-02",
        startedAt: at("2026-09-02T07:00"),
        endedAt: at("2026-09-02T10:30"),
        timezone: "Asia/Tokyo",
      }),
      entry({ id: "duration-only", localDate: "2026-09-03" }),
    ]);

    const result = await listMemberTimeEntries(
      { memberId: "member-1", from: FROM, to: TO },
      { db: db as never },
    );

    // The same two instants, read back through two different stored zones: +02:00 and +09:00.
    expect(result.entries.map((row) => ({ start: row.startTime, end: row.endTime }))).toEqual([
      { start: "09:00", end: "12:30" },
      { start: "16:00", end: "19:30" },
      { start: null, end: null },
    ]);
  });

  it("maps the rest of the row from the columns it selected", async () => {
    const { db } = createDb([
      entry({
        id: "entry-1",
        localDate: "2026-09-04",
        projectId: "project-nimbus",
        projectName: "Nimbus",
        durationMinutes: 95,
        description: "Platform migration support",
        source: "MCP",
        updatedAt: new Date("2026-09-06T11:22:33.000Z"),
      }),
    ]);

    const result = await listMemberTimeEntries(
      { memberId: "member-1", from: FROM, to: TO },
      { db: db as never },
    );

    expect(result.entries[0]).toEqual({
      id: "entry-1",
      date: "2026-09-04",
      projectId: "project-nimbus",
      projectName: "Nimbus",
      durationMinutes: 95,
      startTime: null,
      endTime: null,
      description: "Platform migration support",
      source: "MCP",
      locked: false,
      updatedAt: "2026-09-06T11:22:33.000Z",
    });
    expect(result.totals).toEqual({ minutes: 95, entryCount: 1 });
    expect(result.nextCursor).toBeNull();
  });
});
