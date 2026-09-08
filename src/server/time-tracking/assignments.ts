import { isProjectColorToken, projectColorValues } from "@/src/lib/project-colors";
import { prisma } from "@/src/server/db/client";

import { formatDateOnly } from "./dates";
import { resolveTrackingMode, type TrackingMode, type TrackingModeMember } from "./tracking-mode";
import type { TimeGridAssignedProject } from "./time-entries";

/**
 * The two reads `/time` and the MCP context tool must agree on: which projects a member may log
 * time to in a date range, and which of the months that range touches are locked.
 *
 * They live here rather than inline in `getMemberWeeklyTimeGrid` because there are now two callers.
 * A second hand-written copy of the assignment predicate is the failure this module exists to
 * prevent: the grid would offer a project the MCP context withheld, or the other way round, and the
 * mismatch would only show up as a confusing `PROJECT_NOT_AVAILABLE` from an agent.
 */

/** The shape both callers select. Kept next to the query so the two cannot drift. */
export const assignedProjectSelect = {
  id: true,
  validFrom: true,
  validTo: true,
  trackingMode: true,
  project: {
    select: {
      id: true,
      name: true,
      colorToken: true,
      startsOn: true,
      endsOn: true,
      isInternal: true,
    },
  },
} as const;

export type AssignedProjectRecord = {
  id: string;
  validFrom: Date;
  validTo: Date | null;
  trackingMode: TrackingMode | null;
  project: {
    id: string;
    name: string;
    colorToken: string;
    startsOn: Date | null;
    endsOn: Date | null;
    isInternal: boolean;
  };
};

type AssignmentClient = {
  projectAssignment: {
    findMany: (args: unknown) => Promise<AssignedProjectRecord[]>;
  };
};

type PeriodLockClient = {
  periodLock: {
    findMany: (args: unknown) => Promise<Array<{ periodStart: Date }>>;
  };
};

/**
 * The `where` clause for "assignments this member can log against somewhere in `[from, to]`".
 *
 * An assignment qualifies when its own validity window overlaps the range *and* the project is
 * live, not deleted and its own start/end window overlaps too. All four windows are half-open on
 * `null`, which is why each is an `OR` rather than a comparison.
 */
export function buildAssignedProjectWhere(input: { memberId: string; from: Date; to: Date }) {
  return {
    memberId: input.memberId,
    active: true,
    validFrom: {
      lte: input.to,
    },
    OR: [{ validTo: null }, { validTo: { gte: input.from } }],
    project: {
      deletedAt: null,
      status: "ACTIVE",
      AND: [
        { OR: [{ startsOn: null }, { startsOn: { lte: input.to } }] },
        { OR: [{ endsOn: null }, { endsOn: { gte: input.from } }] },
      ],
    },
  };
}

export function mapAssignedProject(
  assignment: AssignedProjectRecord,
  member: TrackingModeMember,
): TimeGridAssignedProject {
  const colorToken = isProjectColorToken(assignment.project.colorToken)
    ? assignment.project.colorToken
    : "teal";

  return {
    assignmentId: assignment.id,
    projectId: assignment.project.id,
    name: assignment.project.name,
    color: projectColorValues[colorToken],
    isInternal: assignment.project.isInternal,
    validFrom: formatDateOnly(assignment.validFrom),
    validTo: assignment.validTo ? formatDateOnly(assignment.validTo) : null,
    projectStartsOn: assignment.project.startsOn
      ? formatDateOnly(assignment.project.startsOn)
      : null,
    projectEndsOn: assignment.project.endsOn ? formatDateOnly(assignment.project.endsOn) : null,
    trackingMode: resolveTrackingMode(member, assignment).mode,
  };
}

export async function loadAssignedProjects(input: {
  memberId: string;
  member: TrackingModeMember;
  from: Date;
  to: Date;
  db?: AssignmentClient;
}): Promise<TimeGridAssignedProject[]> {
  const db = input.db ?? (prisma as unknown as AssignmentClient);

  const assignments = await db.projectAssignment.findMany({
    where: buildAssignedProjectWhere({ memberId: input.memberId, from: input.from, to: input.to }),
    orderBy: [{ project: { name: "asc" } }, { validFrom: "asc" }],
    select: assignedProjectSelect,
  });

  return assignments.map((assignment) => mapAssignedProject(assignment, input.member));
}

/**
 * The active period locks among `monthStarts`, as `YYYY-MM-DD` month firsts.
 *
 * `unlockedAt: null` is the whole definition of "locked" — an unlocked row is history, not a lock —
 * and it is the same predicate `assertDateOpen`, `assertWeekOpen` and `assertMonthOpen` use.
 */
export async function loadLockedMonthStarts(input: {
  memberId: string;
  monthStarts: readonly Date[];
  db?: PeriodLockClient;
}): Promise<Set<string>> {
  if (input.monthStarts.length === 0) {
    return new Set();
  }

  const db = input.db ?? (prisma as unknown as PeriodLockClient);

  const locks = await db.periodLock.findMany({
    where: {
      memberId: input.memberId,
      periodStart: {
        in: [...input.monthStarts],
      },
      unlockedAt: null,
    },
    select: {
      periodStart: true,
    },
  });

  return new Set(locks.map((lock) => formatDateOnly(lock.periodStart)));
}
