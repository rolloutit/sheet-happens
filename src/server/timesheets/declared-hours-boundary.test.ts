import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildReportTimeEntryWhere,
  getTimeEntryReportSnapshot,
  normalizeReportFilters,
} from "../reports/reports";
import type { ReportTimeEntryRecord } from "../reports/reports";
import { submitContractorTimesheet } from "./submit-timesheet";
import type { TimesheetPreviewRatePeriod } from "./monthly-preview";

/**
 * The review reads through the module-level client, so it is stubbed rather than injected — the
 * one place in this file that has to be. `reviewDeclarations` is what each test varies.
 */
let reviewDeclarations: Array<Record<string, unknown>> = [];

vi.mock("@/src/server/db/client", () => ({
  prisma: {
    timesheet: {
      findUnique: vi.fn(async () => reviewTimesheet()),
      findFirst: vi.fn(async () => ({ id: "timesheet-1" })),
    },
    monthlyHourDeclaration: {
      findMany: vi.fn(async () => reviewDeclarations),
    },
  },
}));

const { getTimesheetReviewForAdmin } = await import("./admin-review");

/** One approved September timesheet whose single snapshot line is the declared figure. */
function reviewTimesheet() {
  return {
    id: "timesheet-1",
    contractorMemberId: "member-declared",
    periodStart: new Date("2026-09-01T00:00:00.000Z"),
    periodEnd: new Date("2026-09-30T00:00:00.000Z"),
    status: "APPROVED",
    currencyCode: "EUR",
    currentRevisionNumber: 1,
    submittedAt: new Date("2026-10-01T09:00:00.000Z"),
    approvedAt: null,
    acceptedAt: null,
    paidAt: null,
    contractor: { displayName: "Member declared", email: "declared@example.com" },
    currentRevision: {
      id: "revision-1",
      revisionNumber: 1,
      submittedAt: new Date("2026-10-01T09:00:00.000Z"),
      approvedAt: null,
      acceptedAt: null,
      paidAt: null,
      rejectedAt: null,
      rejectionReason: null,
      currencyCode: "EUR",
      totalMinutes: 3_120,
      totalAmount: { toString: () => "5200.00" },
      snapshotLines: [
        {
          id: "line-1",
          sourceTimeEntryId: "declared-entry",
          projectId: "atlas",
          localDate: new Date("2026-09-01T00:00:00.000Z"),
          description: "Platform migration support",
          durationMinutes: 3_120,
          rateSource: "MEMBER_DEFAULT",
          hourlyRate: { toString: () => "100.00" },
          currencyCode: "EUR",
          lineAmount: { toString: () => "5200.00" },
          project: { name: "Atlas Platform", colorToken: "teal" },
        },
      ],
    },
    locks: [],
    invoices: [],
    events: [],
  };
}

beforeEach(() => {
  reviewDeclarations = [
    {
      id: "declaration-1",
      projectId: "atlas",
      proofDocument: {
        id: "document-1",
        originalFilename: "atlas-sep.pdf",
        contentType: "application/pdf",
        byteSize: 412_000,
        createdAt: new Date("2026-09-30T17:20:00.000Z"),
        deletedAt: null,
        status: "AVAILABLE",
      },
    },
  ];
});

/**
 * §4's boundary rule, from both sides at once.
 *
 * > Declared hours belong to the **timesheet and invoice chain**, and not to the **reporting
 * > chain**.
 *
 * §16 asks for the two halves to be asserted next to each other, and they belong together because
 * neither is meaningful alone: excluding declared hours from reports is only correct *because* they
 * are still in the timesheet, and keeping them in the timesheet is only safe *because* the report
 * does not also count them. A hybrid project — one member tracking hours here, another declaring
 * them — is where a mistake in either direction shows up as a wrong number rather than a crash.
 *
 * It lives beside the admin review rather than beside the report because the timesheet chain is the
 * side declared hours are *in*; the report half imports across, which is the cheaper direction.
 */

const SEPTEMBER_START = new Date("2026-09-01T00:00:00.000Z");
const SEPTEMBER_END = new Date("2026-09-30T00:00:00.000Z");

function dateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function rate(overrides: Partial<TimesheetPreviewRatePeriod> = {}): TimesheetPreviewRatePeriod {
  return {
    id: overrides.id ?? "member-rate",
    validFrom: overrides.validFrom ?? dateOnly("2026-01-01"),
    validTo: overrides.validTo ?? null,
    hourlyRate: overrides.hourlyRate ?? "100.00",
    currencyCode: overrides.currencyCode ?? "EUR",
  };
}

/** Both members of the hybrid project, as the report's own query would return them. */
function reportEntry(
  overrides: Partial<Pick<ReportTimeEntryRecord, "id" | "durationMinutes" | "localDate">> & {
    source: "GRID" | "DECLARED";
    memberId: string;
  },
): ReportTimeEntryRecord & { source: "GRID" | "DECLARED" } {
  return {
    id: overrides.id ?? "entry-1",
    localDate: overrides.localDate ?? dateOnly("2026-09-10"),
    durationMinutes: overrides.durationMinutes ?? 120,
    description: "Atlas work",
    // `ReportTimeEntrySource` cannot express DECLARED by design — the filter is what guarantees it
    // never arrives — so the stub widens it to prove the filter, not the type.
    source: overrides.source as never,
    timezone: "Europe/Budapest",
    createdAt: new Date("2026-09-10T10:00:00.000Z"),
    member: {
      id: overrides.memberId,
      email: `${overrides.memberId}@example.com`,
      firstName: "Member",
      lastName: overrides.memberId,
      displayName: `Member ${overrides.memberId}`,
      currentProfile: "CONTRACTOR",
      timezone: "Europe/Budapest",
      defaultRatePeriods: [],
    },
    project: {
      id: "atlas",
      name: "Atlas Platform",
      colorToken: "teal",
      isInternal: false,
    },
    projectAssignment: { overrideRates: [] },
  };
}

/**
 * A stub that applies the `where` it is handed, rather than ignoring it.
 *
 * Asserting the clause alone would prove the string and not the behaviour; making the stub behave
 * like the database is what turns this into a test of the *result* — "a report over a hybrid
 * project returns only the tracked hours".
 */
function createReportDb(rows: ReturnType<typeof reportEntry>[]) {
  return {
    timeEntry: {
      findMany: vi.fn(async (args: { where: { source?: { not?: string } } }) =>
        rows.filter((row) => row.source !== args.where.source?.not),
      ),
    },
    project: { findMany: vi.fn(async () => []) },
    projectGroup: { findMany: vi.fn(async () => []) },
    member: { findMany: vi.fn(async () => []) },
    monthlyHourDeclaration: {
      findMany: vi.fn(async () => [{ memberId: "member-declared", projectId: "atlas" }]),
    },
  };
}

function createSubmitDb(
  overrides: {
    entries?: Array<Record<string, unknown>>;
    memberRates?: TimesheetPreviewRatePeriod[];
    declarations?: Array<{
      minutes: number;
      proofDocumentId: string | null;
      project: { name: string };
    }>;
  } = {},
) {
  const tx = {
    monthlyHourDeclaration: {
      findMany: vi.fn().mockResolvedValue(overrides.declarations ?? []),
    },
    member: {
      findUnique: vi.fn().mockResolvedValue({
        id: "member-declared",
        currentProfile: "CONTRACTOR",
        deletedAt: null,
      }),
    },
    periodLock: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "lock-1" }),
    },
    timesheet: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: "timesheet-1",
        status: "SUBMITTED",
        currentRevisionId: null,
        currentRevisionNumber: 0,
      }),
      update: vi.fn().mockResolvedValue({ id: "timesheet-1" }),
    },
    memberDefaultRatePeriod: {
      findMany: vi.fn().mockResolvedValue(overrides.memberRates ?? [rate()]),
    },
    timeEntry: {
      findMany: vi.fn().mockResolvedValue(overrides.entries ?? []),
      updateMany: vi.fn().mockResolvedValue({ count: overrides.entries?.length ?? 0 }),
    },
    timesheetRevision: {
      create: vi.fn().mockResolvedValue({ id: "revision-1", revisionNumber: 1 }),
      update: vi.fn().mockResolvedValue({ id: "revision-old" }),
    },
    timesheetSnapshotLine: {
      createMany: vi.fn().mockResolvedValue({ count: overrides.entries?.length ?? 0 }),
    },
    timesheetEvent: { create: vi.fn().mockResolvedValue({ id: "event-1" }) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: "audit-1" }) },
  };

  return {
    db: {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as never,
    tx,
  };
}

/** The declaration's materialized entry, exactly as `declarations.ts` writes it. */
function declaredEntry(overrides: { minutes?: number } = {}) {
  return {
    id: "declared-entry",
    memberId: "member-declared",
    projectId: "atlas",
    projectAssignmentId: "assignment-declared",
    // The 1st, which is what makes rate resolution deterministic (§3).
    localDate: SEPTEMBER_START,
    description: "Platform migration support",
    durationMinutes: overrides.minutes ?? 3_120,
    lockedByTimesheetRevisionId: null,
    projectAssignment: { overrideRates: [] },
  };
}

describe("the declared-hours boundary", () => {
  /**
   * **1 of 2.** A hybrid project reports only the hours tracked here.
   *
   * The risk this creates is real and is why the disclosure exists: "Atlas Platform — 4 h in
   * September" is now an incomplete answer, and the count beside it is what says so.
   */
  it("reports only the tracked hours of a hybrid project", async () => {
    const db = createReportDb([
      reportEntry({ id: "tracked-1", source: "GRID", memberId: "member-tracked" }),
      reportEntry({ id: "tracked-2", source: "GRID", memberId: "member-tracked" }),
      reportEntry({
        id: "declared-1",
        source: "DECLARED",
        memberId: "member-declared",
        durationMinutes: 3_120,
        localDate: SEPTEMBER_START,
      }),
    ]);

    const snapshot = await getTimeEntryReportSnapshot(
      { periodStart: SEPTEMBER_START, periodEnd: SEPTEMBER_END, projectIds: ["atlas"] },
      { db, now: () => new Date("2026-10-01T09:00:00.000Z") },
    );

    // The exclusion is in the `where`, which is what makes it total — see the builder's own note.
    expect(
      buildReportTimeEntryWhere(
        normalizeReportFilters({
          periodStart: SEPTEMBER_START,
          periodEnd: SEPTEMBER_END,
        }),
      ),
    ).toMatchObject({ source: { not: "DECLARED" } });
    expect(snapshot.summary.totalMinutes).toBe(240);
    expect(snapshot.summary.entryCount).toBe(2);
    expect(snapshot.lines.map((line) => line.id)).toEqual(["tracked-1", "tracked-2"]);
    expect(snapshot.summary.peopleCount).toBe(1);
    // And it says what it left out, because hiding the exclusion is not part of the decision.
    expect(snapshot.exclusions.declaredHours).toEqual({ memberCount: 1, projectCount: 1 });
  });

  /**
   * **2 of 2.** The same month, the same project, through the timesheet: the declared line is
   * present, counted, and its proof is on the declaration.
   *
   * This is the independent justification for materializing the figure as a `TimeEntry`: the line
   * becomes a `TimesheetSnapshotLine` with no polymorphism anywhere, so the review, the totals and
   * the invoice comparison keep working untouched.
   */
  it("carries the declared line, its total and its proof through submission", async () => {
    const { db, tx } = createSubmitDb({
      entries: [declaredEntry()],
      declarations: [
        {
          minutes: 3_120,
          proofDocumentId: "document-1",
          project: { name: "Atlas Platform" },
        },
      ],
    });

    const result = await submitContractorTimesheet(
      {
        memberId: "member-declared",
        actorMemberId: "member-declared",
        periodStart: SEPTEMBER_START,
      },
      { db },
    );

    expect(result.entryCount).toBe(1);
    expect(result.totalMinutes).toBe(3_120);
    // 52 h at 100.00 EUR.
    expect(result.totalAmount).toBe("5200.00");

    const snapshotLines = tx.timesheetSnapshotLine.createMany.mock.calls[0]?.[0] as {
      data: Array<{
        sourceTimeEntryId: string;
        localDate: Date;
        description: string;
        durationMinutes: number;
        lineAmount: string;
      }>;
    };

    expect(snapshotLines.data).toHaveLength(1);
    expect(snapshotLines.data[0]).toMatchObject({
      sourceTimeEntryId: "declared-entry",
      localDate: SEPTEMBER_START,
      // The note is copied verbatim into the immutable snapshot, never translated at render.
      description: "Platform migration support",
      durationMinutes: 3_120,
      lineAmount: "5200.00",
    });
  });

  /**
   * **2 of 2, read back.** The review the admin actually opens: the declared line, its total, its
   * proof, and the marker that stops an `entryCount` of 1 reading as "logged one entry all month".
   */
  it("returns the declared line, its total and its proof in the admin review", async () => {
    const review = await getTimesheetReviewForAdmin("timesheet-1");

    expect(review?.projects).toHaveLength(1);

    const project = review?.projects[0];

    expect(project).toMatchObject({
      projectId: "atlas",
      projectName: "Atlas Platform",
      trackingMode: "DECLARED",
      totalMinutes: 3_120,
      totalAmount: "5200.00",
      entryCount: 1,
    });
    expect(project?.declaredProof).toEqual({
      declarationId: "declaration-1",
      documentId: "document-1",
      originalFilename: "atlas-sep.pdf",
      contentType: "application/pdf",
      byteSize: 412_000,
      uploadedAt: "2026-09-30T17:20:00.000Z",
    });
    expect(project?.lines[0]).toMatchObject({
      sourceTimeEntryId: "declared-entry",
      localDate: "2026-09-01",
      durationMinutes: 3_120,
      lineAmount: "5200.00",
    });
  });

  /** A tracked project in the same review is untouched, and carries no proof slot. */
  it("leaves a tracked project in the same review reading as tracked", async () => {
    reviewDeclarations = [];

    const review = await getTimesheetReviewForAdmin("timesheet-1");

    expect(review?.projects[0]).toMatchObject({
      trackingMode: "TRACKED",
      declaredProof: null,
    });
  });

  /**
   * The money rule from §3: a declared total carries no information about *when* within the month
   * the work happened, so splitting it across mid-month rate periods would invent data. The figure
   * sits on the 1st, so it bills entirely at the rate valid then.
   */
  it("bills the whole declared figure at the month-start rate, across a mid-month change", async () => {
    const { db } = createSubmitDb({
      entries: [declaredEntry()],
      memberRates: [
        rate({ id: "rate-before", hourlyRate: "100.00", validTo: dateOnly("2026-09-15") }),
        rate({ id: "rate-after", hourlyRate: "150.00", validFrom: dateOnly("2026-09-15") }),
      ],
      declarations: [
        { minutes: 3_120, proofDocumentId: "document-1", project: { name: "Atlas Platform" } },
      ],
    });

    const result = await submitContractorTimesheet(
      {
        memberId: "member-declared",
        actorMemberId: "member-declared",
        periodStart: SEPTEMBER_START,
      },
      { db },
    );

    // 52 h x 100.00, not a blend and not 52 h x 150.00.
    expect(result.totalAmount).toBe("5200.00");
  });

  /**
   * The proof is what replaces the per-day detail a declared project does not have, so without it
   * there is nothing for an admin to check and the month does not submit.
   */
  it("blocks submission while a declared figure has no proof", async () => {
    const { db, tx } = createSubmitDb({
      entries: [declaredEntry()],
      declarations: [
        { minutes: 3_120, proofDocumentId: null, project: { name: "Atlas Platform" } },
      ],
    });

    await expect(
      submitContractorTimesheet(
        {
          memberId: "member-declared",
          actorMemberId: "member-declared",
          periodStart: SEPTEMBER_START,
        },
        { db },
      ),
    ).rejects.toMatchObject({
      message: "Declared hours are missing their proof.",
      projectNames: ["Atlas Platform"],
    });
    expect(tx.timesheetRevision.create).not.toHaveBeenCalled();
  });

  /** A declared assignment nobody declared against is a quiet month, not a missing document. */
  it("does not block on a declared assignment with no hours", async () => {
    const { db } = createSubmitDb({
      entries: [declaredEntry()],
      declarations: [
        { minutes: 3_120, proofDocumentId: "document-1", project: { name: "Atlas Platform" } },
        { minutes: 0, proofDocumentId: null, project: { name: "Nimbus" } },
      ],
    });

    await expect(
      submitContractorTimesheet(
        {
          memberId: "member-declared",
          actorMemberId: "member-declared",
          periodStart: SEPTEMBER_START,
        },
        { db },
      ),
    ).resolves.toMatchObject({ entryCount: 1 });
  });

  /** A declared-only month submits like any other: one line, one figure, one proof. */
  it("submits a declared-only month", async () => {
    const { db } = createSubmitDb({
      entries: [declaredEntry({ minutes: 9_600 })],
      declarations: [
        { minutes: 9_600, proofDocumentId: "document-1", project: { name: "Atlas Platform" } },
      ],
    });

    const result = await submitContractorTimesheet(
      {
        memberId: "member-declared",
        actorMemberId: "member-declared",
        periodStart: SEPTEMBER_START,
      },
      { db },
    );

    expect(result).toMatchObject({
      entryCount: 1,
      totalMinutes: 9_600,
      totalAmount: "16000.00",
      currencyCode: "EUR",
    });
  });
});
