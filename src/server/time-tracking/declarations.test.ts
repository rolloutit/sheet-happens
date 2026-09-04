import { describe, expect, it, vi } from "vitest";

import {
  DeclarationError,
  deleteMonthlyHourDeclaration,
  isDeclarationImplausible,
  resolveDeclarationSanityLimit,
  saveMonthlyHourDeclaration,
  uploadDeclarationProof,
  validateHoursProofFile,
} from "./declarations";

const MEMBER_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "33333333-3333-4333-8333-333333333333";
const SEPTEMBER = new Date("2026-09-01T00:00:00.000Z");

type DeclarationRecord = {
  id: string;
  minutes: number;
  note: string;
  timeEntryId: string;
  proofDocumentId?: string | null;
  proofDocument?: { storageBucket: string; storageKey: string; originalFilename: string } | null;
  timeEntry: {
    id?: string;
    durationMinutes?: number;
    description?: string;
    deletedAt?: Date | null;
    lockedByTimesheetRevisionId: string | null;
  };
};

function createDb(
  overrides: {
    declaration?: DeclarationRecord | null;
    trackingMode?: "TRACKED" | "DECLARED" | null;
    defaultTrackingMode?: "TRACKED" | "DECLARED";
    assignment?: unknown;
    trackedEntryCount?: number;
    lock?: { id: string } | null;
  } = {},
) {
  const tx = {
    periodLock: {
      findFirst: vi.fn().mockResolvedValue(overrides.lock ?? null),
    },
    projectAssignment: {
      findFirst: vi.fn().mockResolvedValue(
        overrides.assignment === undefined
          ? {
              id: "assignment-1",
              trackingMode: overrides.trackingMode ?? "DECLARED",
              member: { defaultTrackingMode: overrides.defaultTrackingMode ?? "TRACKED" },
            }
          : overrides.assignment,
      ),
    },
    member: {
      findUnique: vi.fn().mockResolvedValue({ timezone: "Europe/Budapest" }),
    },
    timeEntry: {
      count: vi.fn().mockResolvedValue(overrides.trackedEntryCount ?? 0),
      create: vi.fn().mockResolvedValue({ id: "entry-new" }),
      update: vi.fn().mockResolvedValue({ id: "entry-existing" }),
    },
    monthlyHourDeclaration: {
      findUnique: vi.fn().mockResolvedValue(overrides.declaration ?? null),
      create: vi.fn().mockResolvedValue({ id: "declaration-new" }),
      update: vi.fn().mockResolvedValue({ id: "declaration-existing" }),
      delete: vi.fn().mockResolvedValue({ id: "declaration-existing" }),
    },
    document: {
      create: vi.fn().mockResolvedValue({ id: "document-new" }),
      update: vi.fn().mockResolvedValue({ id: "document-old" }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
  };

  const db = {
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    monthlyHourDeclaration: {
      findUnique: vi.fn().mockResolvedValue(overrides.declaration ?? null),
    },
  };

  return { db: db as never, tx };
}

function createStorage() {
  return {
    putObject: vi.fn().mockResolvedValue({ bucket: "sheet-happens", key: "hours-proofs/a.pdf" }),
    getObject: vi.fn(),
    deleteObject: vi.fn().mockResolvedValue(undefined),
    getSignedReadUrl: vi.fn().mockResolvedValue("https://example.test/a.pdf"),
  };
}

function pdfFile(overrides: Partial<{ bytes: Buffer; contentType: string; name: string }> = {}) {
  const bytes = overrides.bytes ?? Buffer.from("%PDF-1.7 nimbus september");

  return {
    bytes,
    originalFilename: overrides.name ?? "nimbus-sep.pdf",
    contentType: overrides.contentType ?? "application/pdf",
    byteSize: bytes.byteLength,
  };
}

const saveInput = {
  memberId: MEMBER_ID,
  actorMemberId: MEMBER_ID,
  projectId: PROJECT_ID,
  periodStart: SEPTEMBER,
  minutes: 3_120,
  note: "Platform migration support",
};

describe("saveMonthlyHourDeclaration", () => {
  /**
   * The materialization contract. The whole financial chain reads `TimeEntry`, so a declaration
   * that failed to produce exactly one — of the right source, on the right date, carrying the note
   * as its description — would go missing from the timesheet without anything reporting it.
   */
  it("materializes exactly one time entry, dated the 1st, carrying the note", async () => {
    const { db, tx } = createDb();

    const result = await saveMonthlyHourDeclaration(saveInput, { db });

    expect(tx.timeEntry.create).toHaveBeenCalledTimes(1);
    expect(tx.timeEntry.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        memberId: MEMBER_ID,
        projectId: PROJECT_ID,
        source: "DECLARED",
        durationMinutes: 3_120,
        description: "Platform migration support",
        localDate: new Date("2026-09-01T00:00:00.000Z"),
      },
    });
    expect(tx.monthlyHourDeclaration.create).toHaveBeenCalledTimes(1);
    expect(tx.monthlyHourDeclaration.create.mock.calls[0]?.[0]).toMatchObject({
      data: { timeEntryId: "entry-new", minutes: 3_120 },
    });
    expect(result).toEqual({
      declarationId: "declaration-new",
      timeEntryId: "entry-new",
      created: true,
    });
  });

  /** Any day of the month names the month; the entry is always dated the 1st. */
  it("normalizes a mid-month date to the first of that month", async () => {
    const { db, tx } = createDb();

    await saveMonthlyHourDeclaration(
      { ...saveInput, periodStart: new Date("2026-09-17T00:00:00.000Z") },
      { db },
    );

    expect(tx.timeEntry.create.mock.calls[0]?.[0]).toMatchObject({
      data: { localDate: new Date("2026-09-01T00:00:00.000Z") },
    });
  });

  it("updates the same entry on a correction instead of writing a second one", async () => {
    const { db, tx } = createDb({
      declaration: {
        id: "declaration-existing",
        minutes: 3_120,
        note: "Platform migration support",
        timeEntryId: "entry-existing",
        timeEntry: { lockedByTimesheetRevisionId: null },
      },
    });

    const result = await saveMonthlyHourDeclaration({ ...saveInput, minutes: 2_400 }, { db });

    expect(tx.timeEntry.create).not.toHaveBeenCalled();
    expect(tx.timeEntry.update).toHaveBeenCalledTimes(1);
    expect(tx.timeEntry.update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "entry-existing" },
      data: { durationMinutes: 2_400, deletedAt: null },
    });
    expect(result.created).toBe(false);
  });

  it("refuses a project that tracks its hours in Sheet Happens", async () => {
    const { db } = createDb({ trackingMode: "TRACKED" });

    await expect(saveMonthlyHourDeclaration(saveInput, { db })).rejects.toMatchObject({
      code: "NOT_DECLARED",
    });
  });

  /** `null` on the assignment inherits the member default, exactly as `resolveTrackingMode` says. */
  it("accepts an assignment that inherits a declared member default", async () => {
    const { db, tx } = createDb({ trackingMode: null, defaultTrackingMode: "DECLARED" });

    await saveMonthlyHourDeclaration(saveInput, { db });

    expect(tx.timeEntry.create).toHaveBeenCalledTimes(1);
  });

  /**
   * The double-count guard from the declared side. A month holding ordinary entries for this
   * project cannot also hold a declaration, or the two are summed together.
   */
  it("refuses a month that already holds tracked entries for the project", async () => {
    const { db } = createDb({ trackedEntryCount: 4 });

    await expect(saveMonthlyHourDeclaration(saveInput, { db })).rejects.toMatchObject({
      code: "TRACKED_ENTRIES_EXIST",
    });
  });

  it("refuses a locked month", async () => {
    const { db } = createDb({ lock: { id: "lock-1" } });

    await expect(saveMonthlyHourDeclaration(saveInput, { db })).rejects.toMatchObject({
      code: "PERIOD_LOCKED",
    });
  });

  it("refuses a declaration whose entry a submitted timesheet already locked", async () => {
    const { db } = createDb({
      declaration: {
        id: "declaration-existing",
        minutes: 3_120,
        note: "Platform migration support",
        timeEntryId: "entry-existing",
        timeEntry: { lockedByTimesheetRevisionId: "revision-1" },
      },
    });

    await expect(saveMonthlyHourDeclaration(saveInput, { db })).rejects.toMatchObject({
      code: "PERIOD_LOCKED",
    });
  });

  /** The note becomes the entry's description, which submission requires — see `submit-timesheet`. */
  it("requires a note", async () => {
    const { db } = createDb();

    await expect(
      saveMonthlyHourDeclaration({ ...saveInput, note: "   " }, { db }),
    ).rejects.toMatchObject({ code: "NOTE_REQUIRED" });
  });

  it("requires a positive whole number of minutes", async () => {
    const { db } = createDb();

    await expect(
      saveMonthlyHourDeclaration({ ...saveInput, minutes: 0 }, { db }),
    ).rejects.toMatchObject({ code: "INVALID_MINUTES" });
  });

  /**
   * An admin correction has to reach the member. The dispatcher reads audit rows through an
   * allowlist and maps them by action name, so the row is written as `time_entry.admin_updated` —
   * and it skips any row naming no member, so `memberId` has to be in the payload.
   */
  it("records an admin correction so the existing notification fires", async () => {
    const { db, tx } = createDb();

    await saveMonthlyHourDeclaration(
      {
        ...saveInput,
        actorMemberId: ADMIN_ID,
        adminModificationReason: "Corrected against the signed timesheet",
      },
      { db },
    );

    expect(tx.timeEntry.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        adminModifiedByMemberId: ADMIN_ID,
        adminModificationReason: "Corrected against the signed timesheet",
      },
    });

    const audit = tx.auditLog.create.mock.calls[0]?.[0] as {
      data: { action: string; targetType: string; after: Record<string, unknown> };
    };

    expect(audit.data.action).toBe("time_entry.admin_updated");
    expect(audit.data.targetType).toBe("time_entry");
    expect(audit.data.after.memberId).toBe(MEMBER_ID);
  });

  it("refuses an admin correction with no reason", async () => {
    const { db } = createDb();

    await expect(
      saveMonthlyHourDeclaration({ ...saveInput, actorMemberId: ADMIN_ID }, { db }),
    ).rejects.toMatchObject({ code: "REASON_REQUIRED" });
  });

  /** A member's own save is not an admin modification and must not notify them about themselves. */
  it("writes a plain declaration audit row for the member's own save", async () => {
    const { db, tx } = createDb();

    await saveMonthlyHourDeclaration(saveInput, { db });

    expect(tx.auditLog.create.mock.calls[0]?.[0]).toMatchObject({
      data: { action: "hours_declaration.created", targetType: "hours_declaration" },
    });
  });
});

describe("deleteMonthlyHourDeclaration", () => {
  /**
   * The declaration row goes and the entry is soft-deleted — never the other way round. The
   * declaration holds `Restrict` keys onto both the entry and the proof, and
   * `TimesheetSnapshotLine.sourceTimeEntryId` restricts a hard delete of the entry once a revision
   * has snapshotted it.
   */
  it("removes the declaration and soft-deletes its entry", async () => {
    const { db, tx } = createDb({
      declaration: {
        id: "declaration-existing",
        minutes: 3_120,
        note: "Platform migration support",
        timeEntryId: "entry-existing",
        proofDocumentId: "document-old",
        timeEntry: { lockedByTimesheetRevisionId: null },
      },
    });

    await deleteMonthlyHourDeclaration(
      {
        memberId: MEMBER_ID,
        actorMemberId: MEMBER_ID,
        projectId: PROJECT_ID,
        periodStart: SEPTEMBER,
      },
      { db },
    );

    expect(tx.monthlyHourDeclaration.delete).toHaveBeenCalledTimes(1);
    expect(tx.timeEntry.update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "entry-existing" },
    });
    expect(
      (tx.timeEntry.update.mock.calls[0]?.[0] as { data: { deletedAt: Date } }).data.deletedAt,
    ).toBeInstanceOf(Date);
    expect(tx.document.update).toHaveBeenCalledTimes(1);
  });

  it("refuses to withdraw a locked declaration", async () => {
    const { db } = createDb({
      declaration: {
        id: "declaration-existing",
        minutes: 3_120,
        note: "Platform migration support",
        timeEntryId: "entry-existing",
        timeEntry: { lockedByTimesheetRevisionId: "revision-1" },
      },
    });

    await expect(
      deleteMonthlyHourDeclaration(
        {
          memberId: MEMBER_ID,
          actorMemberId: MEMBER_ID,
          projectId: PROJECT_ID,
          periodStart: SEPTEMBER,
        },
        { db },
      ),
    ).rejects.toMatchObject({ code: "PERIOD_LOCKED" });
  });
});

describe("the implausible-figure bound", () => {
  it("is 24 hours times the days in the month, and February knows about leap years", () => {
    expect(resolveDeclarationSanityLimit(new Date("2026-09-15T00:00:00.000Z"))).toBe(30 * 24 * 60);
    expect(resolveDeclarationSanityLimit(new Date("2026-02-01T00:00:00.000Z"))).toBe(28 * 24 * 60);
    expect(resolveDeclarationSanityLimit(new Date("2028-02-01T00:00:00.000Z"))).toBe(29 * 24 * 60);
  });

  /** A warning, not a block: an implausible figure still saves. */
  it("warns rather than refusing", async () => {
    const { db, tx } = createDb();
    const overTheBound = 31 * 24 * 60;

    expect(isDeclarationImplausible(overTheBound, SEPTEMBER)).toBe(true);
    expect(isDeclarationImplausible(3_120, SEPTEMBER)).toBe(false);

    await saveMonthlyHourDeclaration({ ...saveInput, minutes: overTheBound }, { db });

    expect(tx.timeEntry.create).toHaveBeenCalledTimes(1);
  });
});

describe("validateHoursProofFile", () => {
  it("accepts a PDF", () => {
    expect(() => validateHoursProofFile(pdfFile())).not.toThrow();
  });

  it("rejects an empty file", () => {
    expect(() => validateHoursProofFile({ ...pdfFile(), byteSize: 0 })).toThrow(DeclarationError);
  });

  it("rejects a file over the size ceiling", () => {
    expect(() => validateHoursProofFile({ ...pdfFile(), byteSize: 11 * 1024 * 1024 })).toThrow(
      /too large/,
    );
  });

  it("rejects a non-PDF content type or extension", () => {
    expect(() => validateHoursProofFile(pdfFile({ contentType: "image/png" }))).toThrow(/PDF/);
    expect(() => validateHoursProofFile(pdfFile({ name: "hours.png" }))).toThrow(/PDF/);
  });

  /** The one check the browser does not get to choose. */
  it("rejects a file whose bytes are not a PDF however it is named", () => {
    expect(() =>
      validateHoursProofFile(pdfFile({ bytes: Buffer.from("GIF89a not really a pdf") })),
    ).toThrow(/PDF/);
  });
});

describe("uploadDeclarationProof", () => {
  it("stores the object, records the document and points the declaration at it", async () => {
    const { db, tx } = createDb({
      declaration: {
        id: "declaration-existing",
        minutes: 3_120,
        note: "Platform migration support",
        timeEntryId: "entry-existing",
        proofDocumentId: null,
        proofDocument: null,
        timeEntry: { lockedByTimesheetRevisionId: null },
      },
    });
    const storage = createStorage();

    const result = await uploadDeclarationProof(
      {
        memberId: MEMBER_ID,
        actorMemberId: MEMBER_ID,
        projectId: PROJECT_ID,
        periodStart: SEPTEMBER,
        file: pdfFile(),
      },
      { db, storage },
    );

    expect(storage.putObject).toHaveBeenCalledTimes(1);
    expect(tx.document.create.mock.calls[0]?.[0]).toMatchObject({
      data: { type: "HOURS_PROOF", status: "AVAILABLE", ownerMemberId: MEMBER_ID },
    });
    expect(tx.monthlyHourDeclaration.update.mock.calls[0]?.[0]).toMatchObject({
      data: { proofDocumentId: "document-new" },
    });
    expect(result.replaced).toBe(false);
  });

  it("refuses a proof before the hours are declared", async () => {
    const { db } = createDb({ declaration: null });
    const storage = createStorage();

    await expect(
      uploadDeclarationProof(
        {
          memberId: MEMBER_ID,
          actorMemberId: MEMBER_ID,
          projectId: PROJECT_ID,
          periodStart: SEPTEMBER,
          file: pdfFile(),
        },
        { db, storage },
      ),
    ).rejects.toMatchObject({ code: "DECLARATION_NOT_FOUND" });
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  /** Put-then-transact leaves an object with no row when the transaction fails; it is cleaned up. */
  it("deletes the orphaned object when the transaction fails", async () => {
    const { db, tx } = createDb({
      declaration: {
        id: "declaration-existing",
        minutes: 3_120,
        note: "Platform migration support",
        timeEntryId: "entry-existing",
        proofDocumentId: null,
        proofDocument: null,
        timeEntry: { lockedByTimesheetRevisionId: null },
      },
    });
    const storage = createStorage();

    tx.document.create.mockRejectedValueOnce(new Error("constraint violation"));

    await expect(
      uploadDeclarationProof(
        {
          memberId: MEMBER_ID,
          actorMemberId: MEMBER_ID,
          projectId: PROJECT_ID,
          periodStart: SEPTEMBER,
          file: pdfFile(),
        },
        { db, storage },
      ),
    ).rejects.toThrow("constraint violation");
    expect(storage.deleteObject).toHaveBeenCalledWith({
      bucket: "sheet-happens",
      key: "hours-proofs/a.pdf",
    });
  });
});
