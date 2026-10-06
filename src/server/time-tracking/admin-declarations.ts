import { isProjectColorToken, projectColorValues } from "@/src/lib/project-colors";
import { prisma } from "@/src/server/db/client";

import { formatDateOnly, getMonthEnd, getMonthStart } from "./dates";
import {
  resolveTrackingMode,
  type TrackingMode,
  type TrackingModeMember,
  type TrackingModeSource,
} from "./tracking-mode";

/**
 * One month of declared hours across everybody, for the admin surface that corrects them.
 *
 * **Why this exists as its own query rather than reusing `getMemberMonthOverview`.** That one is
 * per-member and ships with the `/time` page; calling it once per member would be an N+1 over the
 * whole company to render one table. The rules it encodes are the same, though, so they are
 * repeated deliberately and not re-derived — see {@link buildDeclaredHoursRoster}.
 *
 * The month is the unit because a declared figure has no finer resolution (§3 of
 * `docs/time-view-zoom-axis.md`), which is also why the page carries the month in its URL and this
 * function takes one month rather than a range.
 *
 * **What it deliberately does not do:** resolve rates, sum money, or read snapshots. A correction
 * rewrites the materialized `TimeEntry`, and everything downstream — the submission snapshot, the
 * admin review, the invoice comparison — recomputes from it on its own. This is the write surface's
 * roster, not a financial report.
 */

export type AdminDeclaredHoursProof = {
  declarationId: string;
  documentId: string;
  filename: string;
  contentType: string;
  byteSize: number;
  uploadedAt: string;
};

/** The last admin correction on a declaration, from the `adminModified*` fields it mirrors. */
export type AdminDeclaredHoursCorrection = {
  at: string;
  /** `null` when the correcting admin's member row has since been removed. */
  by: string | null;
  reason: string;
};

export type AdminDeclaredHoursRow = {
  memberId: string;
  memberName: string;
  memberProfile: "EMPLOYEE" | "CONTRACTOR";
  projectId: string;
  projectName: string;
  projectColor: string;
  /**
   * The assignment a correction would be written against, or `null` when no live declared
   * assignment covers this month any more.
   *
   * `null` is not cosmetic: `saveMonthlyHourDeclaration` resolves the assignment itself and throws
   * `ASSIGNMENT_NOT_FOUND` when there is none, so a row without one must not be offered a
   * correction the server already knows it will refuse.
   */
  assignmentId: string | null;
  /** Which side of `resolveTrackingMode` put this pair in the declared band, when it still applies. */
  modeSource: TrackingModeSource | null;
  /** `null` before anything has been declared — the truth, where `0` would be a claim of no hours. */
  minutes: number | null;
  note: string;
  proof: AdminDeclaredHoursProof | null;
  /** A submitted timesheet holds the month: still readable here, never correctable. */
  locked: boolean;
  /** `false` when the month is locked or no live declared assignment covers it. */
  correctable: boolean;
  correction: AdminDeclaredHoursCorrection | null;
};

export type AdminDeclaredHoursMonth = {
  /** The first of the month, `YYYY-MM-DD`. Named on the client, in the admin's locale. */
  monthStart: string;
  monthEnd: string;
  rows: AdminDeclaredHoursRow[];
  declaredMinutes: number;
  /** Rows still waiting for a figure — the count this page exists to make visible. */
  missingCount: number;
  /** Declared figures with nothing behind them, which blocks a contractor's submission. */
  missingProofCount: number;
};

/**
 * One assignment as the roster reads it.
 *
 * Dates are `YYYY-MM-DD` strings so every overlap test is a string comparison — for a zero-padded
 * ISO date that is the same ordering as the calendar, with no timezone left to get wrong. The same
 * choice `MonthOverviewAssignment` makes, for the same reason.
 */
export type AdminDeclaredHoursAssignment = {
  assignmentId: string;
  memberId: string;
  memberName: string;
  memberProfile: "EMPLOYEE" | "CONTRACTOR";
  projectId: string;
  projectName: string;
  projectColor: string;
  /** `null` inherits {@link member}'s default — see `resolveTrackingMode`. */
  trackingMode: TrackingMode | null;
  member: TrackingModeMember;
  active: boolean;
  validFrom: string;
  validTo: string | null;
  projectStartsOn: string | null;
  projectEndsOn: string | null;
  projectRetired: boolean;
};

/** A declaration as the database holds it: a figure exists, so `minutes` is never `null` here. */
export type AdminDeclaredHoursDeclarationRow = {
  memberId: string;
  memberName: string;
  memberProfile: "EMPLOYEE" | "CONTRACTOR";
  projectId: string;
  projectName: string;
  projectColor: string;
  minutes: number;
  note: string;
  proof: AdminDeclaredHoursProof | null;
  correction: AdminDeclaredHoursCorrection | null;
};

export type BuildDeclaredHoursRosterInput = {
  monthStart: string;
  monthEnd: string;
  assignments: readonly AdminDeclaredHoursAssignment[];
  declarations: readonly AdminDeclaredHoursDeclarationRow[];
  /** Members whose month is held by an active `PeriodLock`. */
  lockedMemberIds: readonly string[];
};

/**
 * The month's roster, from rows the caller has already fetched.
 *
 * Two rules decide which pairs earn a row, and they are the declared band's rules from
 * `buildMonthOverview` read company-wide:
 *
 * - **A declaration always earns a row, whatever the pair's mode says today.** The declaration is
 *   the record; the mode governs only what may be created now and is deliberately not
 *   time-versioned (§3). Reading the mode instead would let a switch made in November hide a
 *   September figure that is still sitting in a submitted timesheet.
 * - **A live declared assignment earns a row before anything is declared against it**, because
 *   that row is the form the figure gets entered into — and an empty one is the whole reason an
 *   admin opens this page.
 *
 * A pair with two assignment periods inside one month collapses to one row, the later-starting one
 * winning, which is the same assignment `findDeclaredAssignmentForMonth` resolves a write to.
 */
export function buildDeclaredHoursRoster(
  input: BuildDeclaredHoursRosterInput,
): AdminDeclaredHoursMonth {
  const locked = new Set(input.lockedMemberIds);
  const latestByPair = new Map<string, AdminDeclaredHoursAssignment>();

  for (const assignment of input.assignments) {
    const key = pairKey(assignment.memberId, assignment.projectId);
    const held = latestByPair.get(key);

    if (!held || held.validFrom <= assignment.validFrom) {
      latestByPair.set(key, assignment);
    }
  }

  /* Only an assignment that is *live* and *declared* can take a correction. A row keyed here is
     therefore the set of pairs the write path would accept, which is what `correctable` reports. */
  const writableByPair = new Map<string, AdminDeclaredHoursAssignment>();

  for (const [key, assignment] of latestByPair) {
    if (resolveTrackingMode(assignment.member, assignment).mode !== "DECLARED") continue;
    if (!isLiveInMonth(assignment, input.monthStart, input.monthEnd)) continue;

    writableByPair.set(key, assignment);
  }

  const rowsByPair = new Map<string, AdminDeclaredHoursRow>();

  for (const declaration of input.declarations) {
    const key = pairKey(declaration.memberId, declaration.projectId);
    const assignment = writableByPair.get(key);
    const memberLocked = locked.has(declaration.memberId);

    rowsByPair.set(key, {
      memberId: declaration.memberId,
      memberName: declaration.memberName,
      memberProfile: declaration.memberProfile,
      projectId: declaration.projectId,
      projectName: declaration.projectName,
      projectColor: declaration.projectColor,
      assignmentId: assignment?.assignmentId ?? null,
      modeSource: assignment ? resolveTrackingMode(assignment.member, assignment).source : null,
      minutes: declaration.minutes,
      note: declaration.note,
      proof: declaration.proof,
      locked: memberLocked,
      correctable: Boolean(assignment) && !memberLocked,
      correction: declaration.correction,
    });
  }

  for (const [key, assignment] of writableByPair) {
    if (rowsByPair.has(key)) continue;

    const memberLocked = locked.has(assignment.memberId);

    rowsByPair.set(key, {
      memberId: assignment.memberId,
      memberName: assignment.memberName,
      memberProfile: assignment.memberProfile,
      projectId: assignment.projectId,
      projectName: assignment.projectName,
      projectColor: assignment.projectColor,
      assignmentId: assignment.assignmentId,
      modeSource: resolveTrackingMode(assignment.member, assignment).source,
      minutes: null,
      note: "",
      proof: null,
      locked: memberLocked,
      correctable: !memberLocked,
      correction: null,
    });
  }

  const rows = [...rowsByPair.values()].sort(
    (left, right) =>
      left.memberName.localeCompare(right.memberName) ||
      left.projectName.localeCompare(right.projectName),
  );

  return {
    monthStart: input.monthStart,
    monthEnd: input.monthEnd,
    rows,
    declaredMinutes: rows.reduce((total, row) => total + (row.minutes ?? 0), 0),
    missingCount: rows.filter((row) => row.minutes === null).length,
    missingProofCount: rows.filter((row) => row.minutes !== null && !row.proof).length,
  };
}

/**
 * The month's declared-hours roster for every member.
 *
 * Three indexed queries and no per-member fan-out. Deliberately does not authorize: the page and
 * the action own that, the same way `getMemberMonthOverview` leaves the member check to its caller.
 */
export async function listDeclaredHoursForMonth(input: {
  monthStart: Date;
}): Promise<AdminDeclaredHoursMonth> {
  const monthStart = getMonthStart(input.monthStart);
  const monthEnd = getMonthEnd(monthStart);

  const [assignments, declarations, locks] = await Promise.all([
    /* No `active: true` and no project-status filter, matching `getMemberMonthOverview`: whether an
       assignment is *live* is decided in the pure core, which keeps the liveness rule out of a
       `where` clause and in one readable place. A hard-deleted member is filtered here, because
       their rows are not history anyone can act on. */
    prisma.projectAssignment.findMany({
      where: {
        member: {
          deletedAt: null,
        },
        validFrom: {
          lte: monthEnd,
        },
        OR: [{ validTo: null }, { validTo: { gte: monthStart } }],
      },
      orderBy: [
        { member: { displayName: "asc" } },
        { project: { name: "asc" } },
        { validFrom: "asc" },
      ],
      select: {
        id: true,
        active: true,
        validFrom: true,
        validTo: true,
        trackingMode: true,
        member: {
          select: {
            id: true,
            displayName: true,
            currentProfile: true,
            defaultTrackingMode: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            colorToken: true,
            startsOn: true,
            endsOn: true,
            status: true,
            deletedAt: true,
          },
        },
      },
    }),
    prisma.monthlyHourDeclaration.findMany({
      where: {
        periodStart: monthStart,
        member: {
          deletedAt: null,
        },
      },
      select: {
        id: true,
        memberId: true,
        projectId: true,
        minutes: true,
        note: true,
        adminModifiedAt: true,
        adminModificationReason: true,
        adminModifiedBy: {
          select: {
            displayName: true,
          },
        },
        member: {
          select: {
            displayName: true,
            currentProfile: true,
          },
        },
        project: {
          select: {
            name: true,
            colorToken: true,
          },
        },
        /* A join rather than a fourth query. `deletedAt` and `status` come along so a replaced or
           removed document reads as a missing proof instead of as a link to nothing — a to-one
           relation cannot be filtered in the query, so that test lives in the mapper. */
        proofDocument: {
          select: {
            id: true,
            originalFilename: true,
            contentType: true,
            byteSize: true,
            createdAt: true,
            deletedAt: true,
            status: true,
          },
        },
      },
    }),
    prisma.periodLock.findMany({
      where: {
        periodStart: monthStart,
        unlockedAt: null,
      },
      select: {
        memberId: true,
      },
    }),
  ]);

  return buildDeclaredHoursRoster({
    monthStart: formatDateOnly(monthStart),
    monthEnd: formatDateOnly(monthEnd),
    assignments: assignments.map((assignment) => ({
      assignmentId: assignment.id,
      memberId: assignment.member.id,
      memberName: assignment.member.displayName,
      memberProfile: assignment.member.currentProfile,
      projectId: assignment.project.id,
      projectName: assignment.project.name,
      projectColor: resolveProjectColor(assignment.project.colorToken),
      trackingMode: assignment.trackingMode,
      member: {
        defaultTrackingMode: assignment.member.defaultTrackingMode,
      },
      active: assignment.active,
      validFrom: formatDateOnly(assignment.validFrom),
      validTo: assignment.validTo ? formatDateOnly(assignment.validTo) : null,
      projectStartsOn: assignment.project.startsOn
        ? formatDateOnly(assignment.project.startsOn)
        : null,
      projectEndsOn: assignment.project.endsOn ? formatDateOnly(assignment.project.endsOn) : null,
      projectRetired:
        Boolean(assignment.project.deletedAt) || assignment.project.status !== "ACTIVE",
    })),
    declarations: declarations.map((declaration) => ({
      memberId: declaration.memberId,
      memberName: declaration.member.displayName,
      memberProfile: declaration.member.currentProfile,
      projectId: declaration.projectId,
      projectName: declaration.project.name,
      projectColor: resolveProjectColor(declaration.project.colorToken),
      minutes: declaration.minutes,
      note: declaration.note,
      proof: isLiveProof(declaration.proofDocument)
        ? {
            declarationId: declaration.id,
            documentId: declaration.proofDocument.id,
            filename: declaration.proofDocument.originalFilename,
            contentType: declaration.proofDocument.contentType,
            byteSize: Number(declaration.proofDocument.byteSize),
            uploadedAt: declaration.proofDocument.createdAt.toISOString(),
          }
        : null,
      correction: declaration.adminModifiedAt
        ? {
            at: declaration.adminModifiedAt.toISOString(),
            by: declaration.adminModifiedBy?.displayName ?? null,
            reason: declaration.adminModificationReason ?? "",
          }
        : null,
    })),
    lockedMemberIds: locks.map((lock) => lock.memberId),
  });
}

/** A proof only counts while its document is still the live one — see the query's comment. */
function isLiveProof<T extends { deletedAt: Date | null; status: string }>(
  document: T | null,
): document is T {
  return Boolean(document && !document.deletedAt && document.status === "AVAILABLE");
}

/** Whether a day of the month exists that this assignment would accept a declaration for. */
function isLiveInMonth(
  assignment: AdminDeclaredHoursAssignment,
  monthStart: string,
  monthEnd: string,
): boolean {
  if (!assignment.active || assignment.projectRetired) return false;
  if (assignment.validFrom > monthEnd) return false;
  if (assignment.validTo && assignment.validTo < monthStart) return false;
  if (assignment.projectStartsOn && assignment.projectStartsOn > monthEnd) return false;
  if (assignment.projectEndsOn && assignment.projectEndsOn < monthStart) return false;

  return true;
}

function pairKey(memberId: string, projectId: string) {
  return `${memberId}:${projectId}`;
}

function resolveProjectColor(colorToken: string) {
  return projectColorValues[isProjectColorToken(colorToken) ? colorToken : "teal"];
}
