import { describe, expect, it } from "vitest";

import {
  buildDeclaredHoursRoster,
  type AdminDeclaredHoursAssignment,
  type AdminDeclaredHoursDeclarationRow,
} from "./admin-declarations";

const MONTH_START = "2026-09-01";
const MONTH_END = "2026-09-30";

function assignment(
  memberId: string,
  projectId: string,
  overrides: Partial<AdminDeclaredHoursAssignment> = {},
): AdminDeclaredHoursAssignment {
  return {
    assignmentId: `assignment-${memberId}-${projectId}`,
    memberId,
    memberName: memberId,
    memberProfile: "CONTRACTOR",
    projectId,
    projectName: projectId,
    projectColor: "#f2b8ff",
    trackingMode: "DECLARED",
    member: { defaultTrackingMode: "TRACKED" },
    active: true,
    validFrom: "2026-01-01",
    validTo: null,
    projectStartsOn: null,
    projectEndsOn: null,
    projectRetired: false,
    ...overrides,
  };
}

function declaration(
  memberId: string,
  projectId: string,
  minutes: number,
  overrides: Partial<AdminDeclaredHoursDeclarationRow> = {},
): AdminDeclaredHoursDeclarationRow {
  return {
    memberId,
    memberName: memberId,
    memberProfile: "CONTRACTOR",
    projectId,
    projectName: projectId,
    projectColor: "#f2b8ff",
    minutes,
    note: "Platform migration support",
    proof: null,
    correction: null,
    ...overrides,
  };
}

function build(input: {
  assignments?: AdminDeclaredHoursAssignment[];
  declarations?: AdminDeclaredHoursDeclarationRow[];
  lockedMemberIds?: string[];
}) {
  return buildDeclaredHoursRoster({
    monthStart: MONTH_START,
    monthEnd: MONTH_END,
    assignments: input.assignments ?? [],
    declarations: input.declarations ?? [],
    lockedMemberIds: input.lockedMemberIds ?? [],
  });
}

const proof = {
  declarationId: "declaration-1",
  documentId: "document-1",
  filename: "nimbus-sep.pdf",
  contentType: "application/pdf",
  byteSize: 421_888,
  uploadedAt: "2026-09-30T15:20:00.000Z",
};

describe("buildDeclaredHoursRoster", () => {
  it("gives a live declared assignment an empty, correctable row", () => {
    const month = build({ assignments: [assignment("anna", "nimbus")] });

    expect(month.rows).toEqual([
      expect.objectContaining({
        memberId: "anna",
        projectId: "nimbus",
        assignmentId: "assignment-anna-nimbus",
        minutes: null,
        note: "",
        proof: null,
        locked: false,
        correctable: true,
      }),
    ]);
    // `null` is "nothing declared yet"; `0` would be a claim that no hours were worked.
    expect(month.missingCount).toBe(1);
    expect(month.declaredMinutes).toBe(0);
  });

  it("reports a declared figure with its proof and its last correction", () => {
    const month = build({
      assignments: [assignment("anna", "nimbus")],
      declarations: [
        declaration("anna", "nimbus", 3_120, {
          proof,
          correction: { at: "2026-10-02T09:00:00.000Z", by: "David", reason: "Proof shows 52 h" },
        }),
      ],
    });

    expect(month.rows[0]).toMatchObject({
      minutes: 3_120,
      note: "Platform migration support",
      proof,
      correctable: true,
      correction: { by: "David", reason: "Proof shows 52 h" },
    });
    expect(month.declaredMinutes).toBe(3_120);
    expect(month.missingCount).toBe(0);
    expect(month.missingProofCount).toBe(0);
  });

  it("leaves a tracked assignment off the roster entirely", () => {
    const month = build({
      assignments: [
        assignment("anna", "atlas", { trackingMode: "TRACKED" }),
        assignment("anna", "nimbus"),
      ],
    });

    expect(month.rows.map((row) => row.projectId)).toEqual(["nimbus"]);
  });

  /** Both halves of `resolveTrackingMode`, and the roster says which one applied. */
  it("reads the mode from the assignment override or the member default", () => {
    const month = build({
      assignments: [
        assignment("anna", "nimbus"),
        assignment("bela", "orion", {
          trackingMode: null,
          member: { defaultTrackingMode: "DECLARED" },
        }),
      ],
    });

    expect(month.rows.map((row) => [row.memberId, row.modeSource])).toEqual([
      ["anna", "ASSIGNMENT_OVERRIDE"],
      ["bela", "MEMBER_DEFAULT"],
    ]);
  });

  /**
   * The same collapse `findDeclaredAssignmentForMonth` performs: a pair with two periods inside one
   * month is one row, and a correction resolves to the later-starting period. Two rows would offer
   * the same figure twice.
   */
  it("collapses two assignment periods in one month to the later one", () => {
    const month = build({
      assignments: [
        assignment("anna", "nimbus", {
          assignmentId: "early",
          validFrom: "2026-01-01",
          validTo: "2026-09-09",
        }),
        assignment("anna", "nimbus", { assignmentId: "late", validFrom: "2026-09-10" }),
      ],
    });

    expect(month.rows).toHaveLength(1);
    expect(month.rows[0]?.assignmentId).toBe("late");
  });

  it("shows a locked member's month but never offers to correct it", () => {
    const month = build({
      assignments: [assignment("anna", "nimbus")],
      declarations: [declaration("anna", "nimbus", 3_120, { proof })],
      lockedMemberIds: ["anna"],
    });

    expect(month.rows[0]).toMatchObject({ locked: true, correctable: false, minutes: 3_120 });
  });

  /**
   * A figure whose assignment window was narrowed after the fact.
   *
   * It still shows — those hours are in the timesheet either way, and a roster that quietly
   * dropped them would disagree with the month a revision was submitted from. It is not
   * correctable, because `saveMonthlyHourDeclaration` resolves the assignment itself and would
   * throw `ASSIGNMENT_NOT_FOUND`: offering the drawer would promise a write the server refuses.
   */
  it("keeps a declaration whose assignment no longer covers the month, uncorrectable", () => {
    const month = build({
      assignments: [assignment("anna", "nimbus", { validTo: "2026-08-31" })],
      declarations: [declaration("anna", "nimbus", 3_120)],
    });

    expect(month.rows[0]).toMatchObject({
      minutes: 3_120,
      assignmentId: null,
      modeSource: null,
      correctable: false,
      locked: false,
    });
  });

  /**
   * The declaration is the record, not the mode. The mode governs only what may be created now and
   * is deliberately not time-versioned, so reading it here would let a switch made in November hide
   * a September figure that is still sitting in a submitted timesheet.
   */
  it("keeps a declaration whose pair reads as tracked today", () => {
    const month = build({
      assignments: [assignment("anna", "nimbus", { trackingMode: "TRACKED" })],
      declarations: [declaration("anna", "nimbus", 3_120)],
    });

    expect(month.rows[0]).toMatchObject({ minutes: 3_120, correctable: false });
  });

  it("offers no empty row for an assignment that is not live in the month", () => {
    const month = build({
      assignments: [
        assignment("anna", "ended", { validTo: "2026-08-31" }),
        assignment("anna", "future", { validFrom: "2026-10-01" }),
        assignment("anna", "inactive", { active: false }),
        assignment("anna", "retired", { projectRetired: true }),
        assignment("anna", "closed", { projectEndsOn: "2026-08-15" }),
        assignment("anna", "unstarted", { projectStartsOn: "2026-10-05" }),
      ],
    });

    expect(month.rows).toEqual([]);
  });

  it("counts declared figures that have no proof behind them", () => {
    const month = build({
      assignments: [assignment("anna", "nimbus"), assignment("bela", "orion")],
      declarations: [
        declaration("anna", "nimbus", 3_120, { proof }),
        declaration("bela", "orion", 1_200, { memberName: "bela" }),
      ],
    });

    expect(month.declaredMinutes).toBe(4_320);
    expect(month.missingProofCount).toBe(1);
    expect(month.missingCount).toBe(0);
  });

  it("orders by member, then project", () => {
    const month = build({
      assignments: [
        assignment("Nagy Bela", "Orion"),
        assignment("Kiss Anna", "Nimbus"),
        assignment("Kiss Anna", "Atlas"),
      ],
    });

    expect(month.rows.map((row) => `${row.memberName}/${row.projectName}`)).toEqual([
      "Kiss Anna/Atlas",
      "Kiss Anna/Nimbus",
      "Nagy Bela/Orion",
    ]);
  });

  it("carries the month it was built for", () => {
    const month = build({});

    expect(month).toMatchObject({ monthStart: MONTH_START, monthEnd: MONTH_END, rows: [] });
  });
});
