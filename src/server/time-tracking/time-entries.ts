import { isProjectColorToken, projectColorValues } from "@/src/lib/project-colors";
import { prisma } from "@/src/server/db/client";
import { Prisma } from "@/src/server/db/generated/client";

import {
  addDays,
  buildWeekDays,
  formatDateOnly,
  formatWeekRange,
  getMonday,
  getMonthStart,
  getMonthStartsInRange,
  getTodayIsoInTimezone,
  getWeekEnd,
  normalizeDateOnly,
  parseDateOnly,
} from "./dates";
import type { TimeGridDay } from "./dates";

export type TimeEntrySource = "GRID" | "FORM" | "TIMER";

export type TimeTrackingRequestMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type TimeGridAssignedProject = {
  assignmentId: string;
  projectId: string;
  name: string;
  color: string;
  isInternal: boolean;
  validFrom: string;
  validTo: string | null;
  projectStartsOn: string | null;
  projectEndsOn: string | null;
};

export type TimeGridEntry = {
  id: string;
  projectId: string;
  projectAssignmentId: string;
  localDate: string;
  durationMinutes: number;
  description: string;
  source: TimeEntrySource;
  startedAt: string | null;
  endedAt: string | null;
  locked: boolean;
  updatedAt: string;
};

export type InactiveProjectWeekRow = {
  projectId: string;
  weekStartDate: string;
  note: string | null;
};

export type TimeGridWeek = {
  memberId: string;
  timezone: string;
  todayIso: string;
  weekStart: string;
  weekEnd: string;
  previousWeek: string;
  nextWeek: string;
  thisWeek: string;
  weekLabel: string;
  lockedMonthStarts: string[];
  days: TimeGridDay[];
  projects: TimeGridAssignedProject[];
  entries: TimeGridEntry[];
  inactiveWeeks: InactiveProjectWeekRow[];
};

export type TimeEntryMutationInput = {
  memberId: string;
  actorMemberId: string;
  projectId: string;
  localDate: Date;
  durationMinutes: number;
  description: string;
  source?: Extract<TimeEntrySource, "GRID" | "FORM">;
  requestMetadata?: TimeTrackingRequestMetadata;
};

export type TimeEntryUpdateInput = Partial<
  Pick<TimeEntryMutationInput, "projectId" | "localDate" | "durationMinutes" | "description">
> & {
  memberId: string;
  actorMemberId: string;
  timeEntryId: string;
  requestMetadata?: TimeTrackingRequestMetadata;
};

export type TimeEntryDeleteInput = {
  memberId: string;
  actorMemberId: string;
  timeEntryId: string;
  requestMetadata?: TimeTrackingRequestMetadata;
};

export type InactiveProjectWeekInput = {
  memberId: string;
  actorMemberId: string;
  projectId: string;
  weekStartDate: Date;
  note?: string | null;
  requestMetadata?: TimeTrackingRequestMetadata;
};

type AssignmentForTimeGrid = {
  id: string;
  validFrom: Date;
  validTo: Date | null;
  project: {
    id: string;
    name: string;
    colorToken: string;
    startsOn: Date | null;
    endsOn: Date | null;
    isInternal: boolean;
  };
};

type AssignmentForMutation = {
  id: string;
  projectId: string;
  project: {
    id: string;
  };
};

type EntryRecord = {
  id: string;
  projectId: string;
  projectAssignmentId: string;
  localDate: Date;
  durationMinutes: number;
  description: string;
  source: TimeEntrySource;
  startedAt: Date | null;
  endedAt: Date | null;
  lockedByTimesheetRevisionId: string | null;
  updatedAt: Date;
};

export class TimeTrackingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeTrackingError";
  }
}

export async function getMemberWeeklyTimeGrid(input: {
  memberId: string;
  weekStart?: Date | null;
  now?: Date;
}): Promise<TimeGridWeek> {
  const member = await prisma.member.findUnique({
    where: {
      id: input.memberId,
    },
    select: {
      id: true,
      timezone: true,
      deletedAt: true,
    },
  });

  if (!member || member.deletedAt) {
    throw new TimeTrackingError("Member not found.");
  }

  const todayIso = getTodayIsoInTimezone(member.timezone, input.now);
  const thisWeekStart = getMonday(parseDateOnly(todayIso));
  const weekStart = getMonday(input.weekStart ?? thisWeekStart);
  const weekEnd = getWeekEnd(weekStart);
  const monthStarts = getMonthStartsInRange(weekStart, weekEnd);

  const [periodLocks, projects, entries, inactiveWeeks] = await Promise.all([
    prisma.periodLock.findMany({
      where: {
        memberId: member.id,
        periodStart: {
          in: monthStarts,
        },
        unlockedAt: null,
      },
      select: {
        periodStart: true,
      },
    }),
    prisma.projectAssignment.findMany({
      where: {
        memberId: member.id,
        active: true,
        validFrom: {
          lte: weekEnd,
        },
        OR: [{ validTo: null }, { validTo: { gte: weekStart } }],
        project: {
          deletedAt: null,
          status: "ACTIVE",
          AND: [
            { OR: [{ startsOn: null }, { startsOn: { lte: weekEnd } }] },
            { OR: [{ endsOn: null }, { endsOn: { gte: weekStart } }] },
          ],
        },
      },
      orderBy: [{ project: { name: "asc" } }, { validFrom: "asc" }],
      select: {
        id: true,
        validFrom: true,
        validTo: true,
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
      },
    }),
    prisma.timeEntry.findMany({
      where: {
        memberId: member.id,
        deletedAt: null,
        localDate: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      orderBy: [{ localDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        projectId: true,
        projectAssignmentId: true,
        localDate: true,
        durationMinutes: true,
        description: true,
        source: true,
        startedAt: true,
        endedAt: true,
        lockedByTimesheetRevisionId: true,
        updatedAt: true,
      },
    }),
    prisma.inactiveProjectWeek.findMany({
      where: {
        memberId: member.id,
        weekStartDate: weekStart,
      },
      select: {
        projectId: true,
        weekStartDate: true,
        note: true,
      },
    }),
  ]);

  const lockedMonthStarts = new Set(periodLocks.map((lock) => formatDateOnly(lock.periodStart)));

  return {
    memberId: member.id,
    timezone: member.timezone,
    todayIso,
    weekStart: formatDateOnly(weekStart),
    weekEnd: formatDateOnly(weekEnd),
    previousWeek: formatDateOnly(addDays(weekStart, -7)),
    nextWeek: formatDateOnly(addDays(weekStart, 7)),
    thisWeek: formatDateOnly(thisWeekStart),
    weekLabel: formatWeekRange(weekStart),
    lockedMonthStarts: [...lockedMonthStarts],
    days: buildWeekDays({
      weekStart,
      todayIso,
      lockedMonthStarts,
    }),
    projects: projects.map(mapAssignmentToProjectRow),
    entries: entries.map(mapTimeEntry),
    inactiveWeeks: inactiveWeeks.map((inactiveWeek) => ({
      projectId: inactiveWeek.projectId,
      weekStartDate: formatDateOnly(inactiveWeek.weekStartDate),
      note: inactiveWeek.note,
    })),
  };
}

export async function createTimeEntry(input: TimeEntryMutationInput) {
  const normalized = normalizeTimeEntryMutation(input);

  return prisma.$transaction(async (tx) => {
    await assertDateOpen(tx, input.memberId, normalized.localDate);
    const assignment = await findAssignmentForDate(tx, {
      memberId: input.memberId,
      projectId: normalized.projectId,
      localDate: normalized.localDate,
    });
    const timezone = await getMemberTimezone(tx, input.memberId);

    const created = await tx.timeEntry.create({
      data: {
        memberId: input.memberId,
        projectId: assignment.projectId,
        projectAssignmentId: assignment.id,
        localDate: normalized.localDate,
        timezone,
        durationMinutes: normalized.durationMinutes,
        description: normalized.description,
        source: input.source ?? "GRID",
        createdByMemberId: input.actorMemberId,
        updatedByMemberId: input.actorMemberId,
      },
      select: {
        id: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "time_entry.created",
        targetType: "time_entry",
        targetId: created.id,
        after: {
          projectId: assignment.projectId,
          projectAssignmentId: assignment.id,
          localDate: formatDateOnly(normalized.localDate),
          durationMinutes: normalized.durationMinutes,
          source: input.source ?? "GRID",
        },
        ...input.requestMetadata,
      },
    });

    return {
      id: created.id,
    };
  });
}

export async function updateTimeEntry(input: TimeEntryUpdateInput) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.timeEntry.findUnique({
      where: {
        id: input.timeEntryId,
      },
      select: {
        id: true,
        memberId: true,
        projectId: true,
        projectAssignmentId: true,
        localDate: true,
        durationMinutes: true,
        description: true,
        lockedByTimesheetRevisionId: true,
        deletedAt: true,
      },
    });

    if (!current || current.memberId !== input.memberId || current.deletedAt) {
      throw new TimeTrackingError("Time entry not found.");
    }

    if (current.lockedByTimesheetRevisionId) {
      throw new TimeTrackingError("This entry is locked by a submitted timesheet.");
    }

    const nextLocalDate = input.localDate
      ? normalizeDateOnly(input.localDate)
      : normalizeDateOnly(current.localDate);
    const nextProjectId = input.projectId?.trim() || current.projectId;
    const nextDurationMinutes =
      input.durationMinutes === undefined
        ? current.durationMinutes
        : normalizeDurationMinutes(input.durationMinutes);
    const nextDescription =
      input.description === undefined
        ? current.description
        : normalizeDescription(input.description);

    await assertDateOpen(tx, input.memberId, nextLocalDate);

    const needsAssignment =
      nextProjectId !== current.projectId ||
      formatDateOnly(nextLocalDate) !== formatDateOnly(current.localDate);
    const assignment = needsAssignment
      ? await findAssignmentForDate(tx, {
          memberId: input.memberId,
          projectId: nextProjectId,
          localDate: nextLocalDate,
        })
      : null;

    const before = serializeTimeEntryForAudit(current);
    const after = {
      projectId: nextProjectId,
      projectAssignmentId: assignment?.id ?? current.projectAssignmentId,
      localDate: formatDateOnly(nextLocalDate),
      durationMinutes: nextDurationMinutes,
      description: nextDescription,
    };

    await tx.timeEntry.update({
      where: {
        id: current.id,
      },
      data: {
        projectId: nextProjectId,
        projectAssignmentId: assignment?.id ?? current.projectAssignmentId,
        localDate: nextLocalDate,
        durationMinutes: nextDurationMinutes,
        description: nextDescription,
        updatedByMemberId: input.actorMemberId,
      },
      select: {
        id: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "time_entry.updated",
        targetType: "time_entry",
        targetId: current.id,
        before,
        after,
        ...input.requestMetadata,
      },
    });

    return {
      id: current.id,
    };
  });
}

export async function deleteTimeEntry(input: TimeEntryDeleteInput) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.timeEntry.findUnique({
      where: {
        id: input.timeEntryId,
      },
      select: {
        id: true,
        memberId: true,
        projectId: true,
        projectAssignmentId: true,
        localDate: true,
        durationMinutes: true,
        description: true,
        lockedByTimesheetRevisionId: true,
        deletedAt: true,
      },
    });

    if (!current || current.memberId !== input.memberId || current.deletedAt) {
      throw new TimeTrackingError("Time entry not found.");
    }

    if (current.lockedByTimesheetRevisionId) {
      throw new TimeTrackingError("This entry is locked by a submitted timesheet.");
    }

    await assertDateOpen(tx, input.memberId, current.localDate);

    await tx.timeEntry.update({
      where: {
        id: current.id,
      },
      data: {
        deletedAt: new Date(),
        updatedByMemberId: input.actorMemberId,
      },
      select: {
        id: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "time_entry.deleted",
        targetType: "time_entry",
        targetId: current.id,
        before: serializeTimeEntryForAudit(current),
        after: {
          deletedAt: "now",
        },
        ...input.requestMetadata,
      },
    });

    return {
      id: current.id,
    };
  });
}

export async function markInactiveProjectWeek(input: InactiveProjectWeekInput) {
  const weekStartDate = getMonday(input.weekStartDate);
  const weekEndDate = getWeekEnd(weekStartDate);
  const note = input.note?.trim() || null;

  return prisma.$transaction(async (tx) => {
    await assertWeekOpen(tx, input.memberId, weekStartDate, weekEndDate);
    await findAssignmentForWeek(tx, {
      memberId: input.memberId,
      projectId: input.projectId,
      weekStartDate,
      weekEndDate,
    });

    const entryCount = await tx.timeEntry.count({
      where: {
        memberId: input.memberId,
        projectId: input.projectId,
        deletedAt: null,
        localDate: {
          gte: weekStartDate,
          lte: weekEndDate,
        },
      },
    });

    if (entryCount > 0) {
      throw new TimeTrackingError("Remove this week's entries before marking the project inactive.");
    }

    const inactiveWeek = await tx.inactiveProjectWeek.upsert({
      where: {
        memberId_projectId_weekStartDate: {
          memberId: input.memberId,
          projectId: input.projectId,
          weekStartDate,
        },
      },
      create: {
        memberId: input.memberId,
        projectId: input.projectId,
        weekStartDate,
        timezone: await getMemberTimezone(tx, input.memberId),
        note,
      },
      update: {
        note,
      },
      select: {
        id: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "inactive_project_week.marked",
        targetType: "inactive_project_week",
        targetId: inactiveWeek.id,
        after: {
          projectId: input.projectId,
          weekStartDate: formatDateOnly(weekStartDate),
          note,
        },
        ...input.requestMetadata,
      },
    });

    return {
      id: inactiveWeek.id,
    };
  });
}

export async function unmarkInactiveProjectWeek(input: InactiveProjectWeekInput) {
  const weekStartDate = getMonday(input.weekStartDate);
  const weekEndDate = getWeekEnd(weekStartDate);

  return prisma.$transaction(async (tx) => {
    await assertWeekOpen(tx, input.memberId, weekStartDate, weekEndDate);

    const deleted = await tx.inactiveProjectWeek.deleteMany({
      where: {
        memberId: input.memberId,
        projectId: input.projectId,
        weekStartDate,
      },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "inactive_project_week.unmarked",
        targetType: "inactive_project_week",
        targetId: `${input.memberId}:${input.projectId}:${formatDateOnly(weekStartDate)}`,
        before: {
          projectId: input.projectId,
          weekStartDate: formatDateOnly(weekStartDate),
          deletedCount: deleted.count,
        },
        ...input.requestMetadata,
      },
    });

    return {
      deletedCount: deleted.count,
    };
  });
}

function normalizeTimeEntryMutation(input: TimeEntryMutationInput) {
  return {
    projectId: normalizeId(input.projectId, "Choose a project."),
    localDate: normalizeDateOnly(input.localDate),
    durationMinutes: normalizeDurationMinutes(input.durationMinutes),
    description: normalizeDescription(input.description),
  };
}

function normalizeId(value: string, message: string) {
  const normalized = value.trim();
  if (!normalized) throw new TimeTrackingError(message);
  return normalized;
}

function normalizeDurationMinutes(value: number) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TimeTrackingError("Duration must be greater than zero.");
  }

  if (value > 10_080) {
    throw new TimeTrackingError("Duration is too large.");
  }

  return value;
}

function normalizeDescription(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new TimeTrackingError("Description is required.");
  }

  if (normalized.length > 1000) {
    throw new TimeTrackingError("Description must be 1000 characters or less.");
  }

  return normalized;
}

async function assertDateOpen(
  tx: TimeTrackingTransaction,
  memberId: string,
  localDate: Date,
) {
  const lockedPeriod = await tx.periodLock.findFirst({
    where: {
      memberId,
      periodStart: getMonthStart(localDate),
      unlockedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (lockedPeriod) {
    throw new TimeTrackingError("This period is locked by a submitted timesheet.");
  }
}

async function assertWeekOpen(
  tx: TimeTrackingTransaction,
  memberId: string,
  weekStartDate: Date,
  weekEndDate: Date,
) {
  const lockedPeriod = await tx.periodLock.findFirst({
    where: {
      memberId,
      periodStart: {
        in: getMonthStartsInRange(weekStartDate, weekEndDate),
      },
      unlockedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (lockedPeriod) {
    throw new TimeTrackingError("This week touches a locked period.");
  }
}

async function findAssignmentForDate(
  tx: TimeTrackingTransaction,
  input: {
    memberId: string;
    projectId: string;
    localDate: Date;
  },
): Promise<AssignmentForMutation> {
  const assignment = await tx.projectAssignment.findFirst({
    where: {
      memberId: input.memberId,
      projectId: input.projectId,
      active: true,
      validFrom: {
        lte: input.localDate,
      },
      OR: [{ validTo: null }, { validTo: { gte: input.localDate } }],
      project: {
        deletedAt: null,
        status: "ACTIVE",
        AND: [
          { OR: [{ startsOn: null }, { startsOn: { lte: input.localDate } }] },
          { OR: [{ endsOn: null }, { endsOn: { gte: input.localDate } }] },
        ],
      },
    },
    orderBy: {
      validFrom: "desc",
    },
    select: {
      id: true,
      projectId: true,
      project: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!assignment) {
    throw new TimeTrackingError("This project is not active for the selected date.");
  }

  return assignment;
}

async function findAssignmentForWeek(
  tx: TimeTrackingTransaction,
  input: {
    memberId: string;
    projectId: string;
    weekStartDate: Date;
    weekEndDate: Date;
  },
) {
  const assignment = await tx.projectAssignment.findFirst({
    where: {
      memberId: input.memberId,
      projectId: input.projectId,
      active: true,
      validFrom: {
        lte: input.weekEndDate,
      },
      OR: [{ validTo: null }, { validTo: { gte: input.weekStartDate } }],
      project: {
        deletedAt: null,
        status: "ACTIVE",
      },
    },
    select: {
      id: true,
    },
  });

  if (!assignment) {
    throw new TimeTrackingError("This project is not assigned for the selected week.");
  }

  return assignment;
}

async function getMemberTimezone(tx: TimeTrackingTransaction, memberId: string) {
  const member = await tx.member.findUnique({
    where: {
      id: memberId,
    },
    select: {
      timezone: true,
    },
  });

  return member?.timezone ?? "Europe/Budapest";
}

function mapAssignmentToProjectRow(assignment: AssignmentForTimeGrid): TimeGridAssignedProject {
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
    projectStartsOn: assignment.project.startsOn ? formatDateOnly(assignment.project.startsOn) : null,
    projectEndsOn: assignment.project.endsOn ? formatDateOnly(assignment.project.endsOn) : null,
  };
}

function mapTimeEntry(entry: EntryRecord): TimeGridEntry {
  return {
    id: entry.id,
    projectId: entry.projectId,
    projectAssignmentId: entry.projectAssignmentId,
    localDate: formatDateOnly(entry.localDate),
    durationMinutes: entry.durationMinutes,
    description: entry.description,
    source: entry.source,
    startedAt: entry.startedAt?.toISOString() ?? null,
    endedAt: entry.endedAt?.toISOString() ?? null,
    locked: Boolean(entry.lockedByTimesheetRevisionId),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

function serializeTimeEntryForAudit(entry: {
  projectId: string;
  projectAssignmentId: string;
  localDate: Date;
  durationMinutes: number;
  description: string;
}) {
  return {
    projectId: entry.projectId,
    projectAssignmentId: entry.projectAssignmentId,
    localDate: formatDateOnly(entry.localDate),
    durationMinutes: entry.durationMinutes,
    description: entry.description,
  };
}

type TimeTrackingTransaction = Prisma.TransactionClient;
