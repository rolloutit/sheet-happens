import { isProjectColorToken, projectColorValues } from "@/src/lib/project-colors";
import { DAILY_HARD_LIMIT_MINUTES } from "@/src/lib/time-entry-limits";
import { prisma } from "@/src/server/db/client";
import { Prisma } from "@/src/server/db/generated/client";

import {
  addDays,
  buildWeekDays,
  formatDateOnly,
  formatTimeInTimezone,
  formatWeekRange,
  getMonday,
  getMonthStart,
  getMonthStartsInRange,
  getTodayIsoInTimezone,
  getWeekEnd,
  localIntervalToUtc,
  normalizeDateOnly,
  parseDateOnly,
} from "./dates";
import type { TimeGridDay } from "./dates";

export type TimeEntrySource = "GRID" | "FORM" | "TIMER";
export type TimeEntryTimingMode = "DURATION" | "INTERVAL";

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
  startTime: string | null;
  endTime: string | null;
  locked: boolean;
  updatedAt: string;
  adminModification: {
    modifiedAt: string;
    modifiedByName: string | null;
    reason: string;
    timezone: string;
  } | null;
};

export type RunningTimerView = {
  id: string;
  projectId: string;
  projectAssignmentId: string;
  projectName: string;
  projectColor: string;
  description: string;
  startedAt: string;
};

export type InactiveProjectWeekRow = {
  projectId: string;
  weekStartDate: string;
  note: string | null;
};

export type TimeEntryDraftPayload = {
  kind: "time-entry-form";
  version: 1;
  source: Extract<TimeEntrySource, "GRID" | "FORM">;
  projectId: string;
  localDate: string;
  timingMode: TimeEntryTimingMode;
  durationText: string;
  startTime: string;
  endTime: string;
  description: string;
  prefill?: boolean;
};

export type TimeEntryDraftView = {
  draftKey: string;
  payload: TimeEntryDraftPayload;
  updatedAt: string;
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
  recentProjects: TimeGridAssignedProject[];
  entries: TimeGridEntry[];
  runningTimer: RunningTimerView | null;
  inactiveWeeks: InactiveProjectWeekRow[];
  entryDraft: TimeEntryDraftView | null;
};

export type TimeEntryMutationInput = {
  memberId: string;
  actorMemberId: string;
  projectId: string;
  localDate: Date;
  timingMode?: TimeEntryTimingMode;
  durationMinutes?: number;
  startTime?: string | null;
  endTime?: string | null;
  description: string;
  source?: Extract<TimeEntrySource, "GRID" | "FORM">;
  requestMetadata?: TimeTrackingRequestMetadata;
};

export type TimeEntryUpdateInput = Partial<
  Pick<
    TimeEntryMutationInput,
    | "projectId"
    | "localDate"
    | "timingMode"
    | "durationMinutes"
    | "startTime"
    | "endTime"
    | "description"
  >
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

export type RunningTimerStartInput = {
  memberId: string;
  actorMemberId: string;
  projectId: string;
  description: string;
  now?: Date;
  requestMetadata?: TimeTrackingRequestMetadata;
};

export type RunningTimerStopInput = {
  memberId: string;
  actorMemberId: string;
  now?: Date;
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

export type CopyPreviousDayEntriesInput = {
  memberId: string;
  actorMemberId: string;
  targetDate: Date;
  requestMetadata?: TimeTrackingRequestMetadata;
};

export type DuplicatePreviousWeekInput = {
  memberId: string;
  actorMemberId: string;
  weekStartDate: Date;
  requestMetadata?: TimeTrackingRequestMetadata;
};

export type CopyTimeEntriesResult = {
  sourceCount: number;
  createdCount: number;
  skippedCount: number;
};

export type SaveTimeEntryDraftInput = {
  memberId: string;
  draftKey: string;
  payload: TimeEntryDraftPayload;
};

export type DeleteTimeEntryDraftInput = {
  memberId: string;
  draftKey: string;
};

type TimeTrackingDeps = {
  db?: typeof prisma;
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
  timezone: string;
  lockedByTimesheetRevisionId: string | null;
  updatedAt: Date;
  adminModifiedAt: Date | null;
  adminModificationReason: string | null;
  adminModifiedBy: {
    displayName: string;
  } | null;
};

type EntryForCopy = {
  id: string;
  projectId: string;
  projectAssignmentId: string;
  localDate: Date;
  durationMinutes: number;
  description: string;
  startedAt: Date | null;
  endedAt: Date | null;
  timezone: string;
};

type RunningTimerRecord = {
  id: string;
  projectId: string;
  projectAssignmentId: string;
  description: string;
  startedAt: Date;
  projectAssignment: {
    project: {
      name: string;
      colorToken: string;
    };
  };
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

  const [periodLocks, projects, entries, recentEntries, runningTimer, inactiveWeeks, entryDraft] =
    await Promise.all([
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
          timezone: true,
          lockedByTimesheetRevisionId: true,
          updatedAt: true,
          adminModifiedAt: true,
          adminModificationReason: true,
          adminModifiedBy: {
            select: {
              displayName: true,
            },
          },
        },
      }),
      prisma.timeEntry.findMany({
        where: {
          memberId: member.id,
          deletedAt: null,
          localDate: {
            gte: addDays(weekEnd, -90),
            lte: weekEnd,
          },
        },
        distinct: ["projectId"],
        orderBy: [{ localDate: "desc" }, { updatedAt: "desc" }],
        select: {
          projectId: true,
        },
      }),
      prisma.runningTimer.findUnique({
        where: {
          memberId: member.id,
        },
        select: {
          id: true,
          projectId: true,
          projectAssignmentId: true,
          description: true,
          startedAt: true,
          projectAssignment: {
            select: {
              project: {
                select: {
                  name: true,
                  colorToken: true,
                },
              },
            },
          },
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
      prisma.timeEntryDraft.findUnique({
        where: {
          memberId_draftKey: {
            memberId: member.id,
            draftKey: "time-entry-form",
          },
        },
        select: {
          draftKey: true,
          payload: true,
          updatedAt: true,
        },
      }),
    ]);

  const lockedMonthStarts = new Set(periodLocks.map((lock) => formatDateOnly(lock.periodStart)));
  const projectRows = projects.map(mapAssignmentToProjectRow);
  const projectsById = new Map(projectRows.map((project) => [project.projectId, project]));
  const recentProjects = unique(recentEntries.map((entry) => entry.projectId))
    .map((projectId) => projectsById.get(projectId))
    .filter((project): project is TimeGridAssignedProject => Boolean(project));

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
    projects: projectRows,
    recentProjects,
    entries: entries.map(mapTimeEntry),
    runningTimer: runningTimer ? mapRunningTimer(runningTimer) : null,
    inactiveWeeks: inactiveWeeks.map((inactiveWeek) => ({
      projectId: inactiveWeek.projectId,
      weekStartDate: formatDateOnly(inactiveWeek.weekStartDate),
      note: inactiveWeek.note,
    })),
    entryDraft: mapTimeEntryDraft(entryDraft),
  };
}

export async function createTimeEntry(input: TimeEntryMutationInput) {
  const normalized = normalizeTimeEntryMutationBase(input);

  return prisma.$transaction(async (tx) => {
    await assertDateOpen(tx, input.memberId, normalized.localDate);
    const assignment = await findAssignmentForDate(tx, {
      memberId: input.memberId,
      projectId: normalized.projectId,
      localDate: normalized.localDate,
    });
    const timezone = await getMemberTimezone(tx, input.memberId);
    const timing = normalizeTimeEntryTiming({
      localDate: normalized.localDate,
      timezone,
      timingMode: input.timingMode,
      durationMinutes: input.durationMinutes,
      startTime: input.startTime,
      endTime: input.endTime,
    });

    await assertDailyTotalWithinHardLimit(tx, {
      memberId: input.memberId,
      localDate: normalized.localDate,
      addedMinutes: timing.durationMinutes,
    });

    const created = await tx.timeEntry.create({
      data: {
        memberId: input.memberId,
        projectId: assignment.projectId,
        projectAssignmentId: assignment.id,
        localDate: normalized.localDate,
        timezone,
        durationMinutes: timing.durationMinutes,
        startedAt: timing.startedAt,
        endedAt: timing.endedAt,
        description: normalized.description,
        source: input.source ?? "GRID",
        createdByMemberId: input.actorMemberId,
        updatedByMemberId: input.actorMemberId,
      },
      select: {
        id: true,
      },
    });

    await clearInactiveMarkerForEntryDate(tx, {
      memberId: input.memberId,
      projectId: assignment.projectId,
      localDate: normalized.localDate,
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
          durationMinutes: timing.durationMinutes,
          startedAt: timing.startedAt?.toISOString() ?? null,
          endedAt: timing.endedAt?.toISOString() ?? null,
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
        timezone: true,
        startedAt: true,
        endedAt: true,
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
    const nextDescription =
      input.description === undefined
        ? current.description
        : normalizeDescription(input.description);
    const timingChanged =
      input.timingMode !== undefined ||
      input.durationMinutes !== undefined ||
      input.startTime !== undefined ||
      input.endTime !== undefined;
    const nextTiming = timingChanged
      ? normalizeTimeEntryTiming({
          localDate: nextLocalDate,
          timezone: current.timezone,
          timingMode: input.timingMode,
          durationMinutes: input.durationMinutes,
          startTime: input.startTime,
          endTime: input.endTime,
        })
      : {
          durationMinutes: current.durationMinutes,
          startedAt: current.startedAt,
          endedAt: current.endedAt,
        };

    await assertDateOpen(tx, input.memberId, nextLocalDate);
    await assertDailyTotalWithinHardLimit(tx, {
      memberId: input.memberId,
      localDate: nextLocalDate,
      addedMinutes: nextTiming.durationMinutes,
      excludingTimeEntryId: current.id,
    });

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
      durationMinutes: nextTiming.durationMinutes,
      description: nextDescription,
      startedAt: nextTiming.startedAt?.toISOString() ?? null,
      endedAt: nextTiming.endedAt?.toISOString() ?? null,
    };

    await tx.timeEntry.update({
      where: {
        id: current.id,
      },
      data: {
        projectId: nextProjectId,
        projectAssignmentId: assignment?.id ?? current.projectAssignmentId,
        localDate: nextLocalDate,
        durationMinutes: nextTiming.durationMinutes,
        startedAt: nextTiming.startedAt,
        endedAt: nextTiming.endedAt,
        description: nextDescription,
        updatedByMemberId: input.actorMemberId,
      },
      select: {
        id: true,
      },
    });

    await clearInactiveMarkerForEntryDate(tx, {
      memberId: input.memberId,
      projectId: nextProjectId,
      localDate: nextLocalDate,
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

export async function startRunningTimer(input: RunningTimerStartInput) {
  const description = normalizeDescription(input.description);
  const now = input.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    const timezone = await getMemberTimezone(tx, input.memberId);
    const localDate = parseDateOnly(getTodayIsoInTimezone(timezone, now));

    await assertDateOpen(tx, input.memberId, localDate);

    const assignment = await findAssignmentForDate(tx, {
      memberId: input.memberId,
      projectId: input.projectId,
      localDate,
    });

    const existing = await tx.runningTimer.findUnique({
      where: {
        memberId: input.memberId,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new TimeTrackingError("Stop the running timer before starting another one.");
    }

    const timer = await tx.runningTimer.create({
      data: {
        memberId: input.memberId,
        projectId: assignment.projectId,
        projectAssignmentId: assignment.id,
        description,
        startedAt: now,
        timezone,
      },
      select: {
        id: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "running_timer.started",
        targetType: "running_timer",
        targetId: timer.id,
        after: {
          projectId: assignment.projectId,
          projectAssignmentId: assignment.id,
          description,
          startedAt: now.toISOString(),
          timezone,
        },
        ...input.requestMetadata,
      },
    });

    return {
      id: timer.id,
    };
  });
}

export async function stopRunningTimer(input: RunningTimerStopInput) {
  const endedAt = input.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    const timer = await tx.runningTimer.findUnique({
      where: {
        memberId: input.memberId,
      },
      select: {
        id: true,
        memberId: true,
        projectId: true,
        projectAssignmentId: true,
        description: true,
        startedAt: true,
        timezone: true,
      },
    });

    if (!timer || timer.memberId !== input.memberId) {
      throw new TimeTrackingError("No timer is running.");
    }

    if (endedAt <= timer.startedAt) {
      throw new TimeTrackingError("Timer end time must be after start time.");
    }

    const localDate = parseDateOnly(getTodayIsoInTimezone(timer.timezone, timer.startedAt));
    await assertDateOpen(tx, input.memberId, localDate);

    const durationMinutes = Math.max(
      1,
      Math.ceil((endedAt.getTime() - timer.startedAt.getTime()) / 60_000),
    );
    const description = timer.description.trim() || "Tracked with timer";

    const currentDailyMinutes = await getDailyLoggedMinutes(tx, {
      memberId: input.memberId,
      localDate,
    });

    if (currentDailyMinutes + durationMinutes > DAILY_HARD_LIMIT_MINUTES) {
      await tx.runningTimer.delete({
        where: {
          id: timer.id,
        },
        select: {
          id: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorMemberId: input.actorMemberId,
          action: "running_timer.discarded_daily_limit",
          targetType: "running_timer",
          targetId: timer.id,
          before: {
            projectId: timer.projectId,
            projectAssignmentId: timer.projectAssignmentId,
            startedAt: timer.startedAt.toISOString(),
            endedAt: endedAt.toISOString(),
            durationMinutes,
            currentDailyMinutes,
          },
          after: {
            saved: false,
            reason: "daily_total_limit",
          },
          ...input.requestMetadata,
        },
      });

      return {
        discarded: true as const,
        reason: "DAILY_LIMIT" as const,
      };
    }

    const entry = await tx.timeEntry.create({
      data: {
        memberId: input.memberId,
        projectId: timer.projectId,
        projectAssignmentId: timer.projectAssignmentId,
        localDate,
        timezone: timer.timezone,
        startedAt: timer.startedAt,
        endedAt,
        durationMinutes,
        description,
        source: "TIMER",
        createdByMemberId: input.actorMemberId,
        updatedByMemberId: input.actorMemberId,
      },
      select: {
        id: true,
      },
    });

    await tx.runningTimer.delete({
      where: {
        id: timer.id,
      },
      select: {
        id: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "running_timer.stopped",
        targetType: "time_entry",
        targetId: entry.id,
        before: {
          runningTimerId: timer.id,
          projectId: timer.projectId,
          projectAssignmentId: timer.projectAssignmentId,
          startedAt: timer.startedAt.toISOString(),
        },
        after: {
          localDate: formatDateOnly(localDate),
          durationMinutes,
          endedAt: endedAt.toISOString(),
          source: "TIMER",
        },
        ...input.requestMetadata,
      },
    });

    return {
      id: entry.id,
      saved: true as const,
    };
  });
}

export async function copyPreviousDayEntries(
  input: CopyPreviousDayEntriesInput,
  deps: TimeTrackingDeps = {},
): Promise<CopyTimeEntriesResult> {
  const targetDate = normalizeDateOnly(input.targetDate);
  const sourceDate = addDays(targetDate, -1);

  return copyEntriesByDateShift({
    memberId: input.memberId,
    actorMemberId: input.actorMemberId,
    sourceStartDate: sourceDate,
    sourceEndDate: sourceDate,
    dayShift: 1,
    auditAction: "time_entries.copy_previous_day",
    requestMetadata: input.requestMetadata,
    db: deps.db,
  });
}

export async function duplicatePreviousWeek(
  input: DuplicatePreviousWeekInput,
  deps: TimeTrackingDeps = {},
): Promise<CopyTimeEntriesResult> {
  const weekStartDate = getMonday(input.weekStartDate);

  return copyEntriesByDateShift({
    memberId: input.memberId,
    actorMemberId: input.actorMemberId,
    sourceStartDate: addDays(weekStartDate, -7),
    sourceEndDate: addDays(weekStartDate, -1),
    dayShift: 7,
    auditAction: "time_entries.duplicate_previous_week",
    requestMetadata: input.requestMetadata,
    db: deps.db,
  });
}

export async function saveTimeEntryDraft(
  input: SaveTimeEntryDraftInput,
  deps: TimeTrackingDeps = {},
) {
  const db = deps.db ?? prisma;
  const draftKey = normalizeDraftKey(input.draftKey);

  return db.timeEntryDraft.upsert({
    where: {
      memberId_draftKey: {
        memberId: input.memberId,
        draftKey,
      },
    },
    create: {
      memberId: input.memberId,
      draftKey,
      payload: input.payload,
    },
    update: {
      payload: input.payload,
    },
    select: {
      draftKey: true,
    },
  });
}

export async function deleteTimeEntryDraft(
  input: DeleteTimeEntryDraftInput,
  deps: TimeTrackingDeps = {},
) {
  const db = deps.db ?? prisma;
  const draftKey = normalizeDraftKey(input.draftKey);

  return db.timeEntryDraft.deleteMany({
    where: {
      memberId: input.memberId,
      draftKey,
    },
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
      throw new TimeTrackingError(
        "Remove this week's entries before marking the project inactive.",
      );
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

async function copyEntriesByDateShift(input: {
  memberId: string;
  actorMemberId: string;
  sourceStartDate: Date;
  sourceEndDate: Date;
  dayShift: number;
  auditAction: string;
  requestMetadata?: TimeTrackingRequestMetadata;
  db?: typeof prisma;
}): Promise<CopyTimeEntriesResult> {
  const db = input.db ?? prisma;
  const sourceStartDate = normalizeDateOnly(input.sourceStartDate);
  const sourceEndDate = normalizeDateOnly(input.sourceEndDate);

  return db.$transaction(async (tx) => {
    const sourceEntries = await tx.timeEntry.findMany({
      where: {
        memberId: input.memberId,
        deletedAt: null,
        localDate: {
          gte: sourceStartDate,
          lte: sourceEndDate,
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
        startedAt: true,
        endedAt: true,
        timezone: true,
      },
    });

    if (!sourceEntries.length) {
      return {
        sourceCount: 0,
        createdCount: 0,
        skippedCount: 0,
      };
    }

    const timezone = await getMemberTimezone(tx, input.memberId);
    const targetDates = unique(
      sourceEntries.map((entry) => formatDateOnly(addDays(entry.localDate, input.dayShift))),
    );
    const existingTargetEntries = await tx.timeEntry.findMany({
      where: {
        memberId: input.memberId,
        deletedAt: null,
        localDate: {
          in: targetDates.map((targetDate) => parseDateOnly(targetDate)),
        },
      },
      select: {
        projectId: true,
        localDate: true,
        durationMinutes: true,
      },
    });
    const occupiedTargetCells = new Set(
      existingTargetEntries.map((entry) =>
        copiedEntryCellKey(entry.projectId, formatDateOnly(entry.localDate)),
      ),
    );
    const targetDailyMinutes = new Map<string, number>();

    for (const entry of existingTargetEntries) {
      const localDate = formatDateOnly(entry.localDate);
      targetDailyMinutes.set(
        localDate,
        (targetDailyMinutes.get(localDate) ?? 0) + entry.durationMinutes,
      );
    }

    for (const targetDate of targetDates) {
      await assertDateOpen(tx, input.memberId, parseDateOnly(targetDate));
    }

    let createdCount = 0;
    let skippedCount = 0;
    const createdEntryIds: string[] = [];

    for (const sourceEntry of sourceEntries) {
      const targetDate = addDays(sourceEntry.localDate, input.dayShift);
      const targetDateIso = formatDateOnly(targetDate);

      if (occupiedTargetCells.has(copiedEntryCellKey(sourceEntry.projectId, targetDateIso))) {
        skippedCount += 1;
        continue;
      }

      const assignment = await findOptionalAssignmentForDate(tx, {
        memberId: input.memberId,
        projectId: sourceEntry.projectId,
        localDate: targetDate,
      });

      if (!assignment) {
        skippedCount += 1;
        continue;
      }

      const copiedTiming = getCopiedEntryTiming(sourceEntry, targetDate, timezone);
      const nextDailyTotal =
        (targetDailyMinutes.get(targetDateIso) ?? 0) + copiedTiming.durationMinutes;

      if (nextDailyTotal > DAILY_HARD_LIMIT_MINUTES) {
        throw new TimeTrackingError("Daily total cannot exceed 24 hours.");
      }

      targetDailyMinutes.set(targetDateIso, nextDailyTotal);

      const created = await tx.timeEntry.create({
        data: {
          memberId: input.memberId,
          projectId: assignment.projectId,
          projectAssignmentId: assignment.id,
          localDate: targetDate,
          timezone,
          durationMinutes: copiedTiming.durationMinutes,
          startedAt: copiedTiming.startedAt,
          endedAt: copiedTiming.endedAt,
          description: sourceEntry.description,
          source: "GRID",
          createdByMemberId: input.actorMemberId,
          updatedByMemberId: input.actorMemberId,
        },
        select: {
          id: true,
        },
      });

      await clearInactiveMarkerForEntryDate(tx, {
        memberId: input.memberId,
        projectId: assignment.projectId,
        localDate: targetDate,
      });

      createdEntryIds.push(created.id);
      createdCount += 1;
    }

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: input.auditAction,
        targetType: "time_entries",
        targetId: `${input.memberId}:${formatDateOnly(sourceStartDate)}:${formatDateOnly(sourceEndDate)}`,
        after: {
          sourceStartDate: formatDateOnly(sourceStartDate),
          sourceEndDate: formatDateOnly(sourceEndDate),
          dayShift: input.dayShift,
          sourceCount: sourceEntries.length,
          createdCount,
          skippedCount,
          createdEntryIds,
        },
        ...input.requestMetadata,
      },
    });

    return {
      sourceCount: sourceEntries.length,
      createdCount,
      skippedCount,
    };
  });
}

function normalizeTimeEntryMutationBase(input: TimeEntryMutationInput) {
  return {
    projectId: normalizeId(input.projectId, "Choose a project."),
    localDate: normalizeDateOnly(input.localDate),
    description: normalizeDescription(input.description),
  };
}

function normalizeTimeEntryTiming(input: {
  localDate: Date;
  timezone: string;
  timingMode?: TimeEntryTimingMode;
  durationMinutes?: number;
  startTime?: string | null;
  endTime?: string | null;
}) {
  if (input.timingMode === "INTERVAL" || input.startTime || input.endTime) {
    if (!input.startTime || !input.endTime) {
      throw new TimeTrackingError("Start and end time are required.");
    }

    try {
      return localIntervalToUtc({
        localDate: input.localDate,
        startTime: input.startTime,
        endTime: input.endTime,
        timezone: input.timezone,
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new TimeTrackingError(error.message);
      }

      throw error;
    }
  }

  if (input.durationMinutes === undefined) {
    throw new TimeTrackingError("Duration must be greater than zero.");
  }

  return {
    durationMinutes: normalizeDurationMinutes(input.durationMinutes),
    startedAt: null,
    endedAt: null,
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

  if (value > DAILY_HARD_LIMIT_MINUTES) {
    throw new TimeTrackingError("Daily total cannot exceed 24 hours.");
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

function normalizeDraftKey(value: string) {
  const normalized = value.trim();

  if (!/^[a-z0-9:_-]{1,80}$/.test(normalized)) {
    throw new TimeTrackingError("Draft key is invalid.");
  }

  return normalized;
}

function getCopiedEntryTiming(entry: EntryForCopy, targetDate: Date, timezone: string) {
  if (entry.startedAt && entry.endedAt) {
    const startTime = formatTimeInTimezone(entry.startedAt, entry.timezone);
    const endTime = formatTimeInTimezone(entry.endedAt, entry.timezone);

    return localIntervalToUtc({
      localDate: targetDate,
      startTime,
      endTime,
      timezone,
    });
  }

  return {
    durationMinutes: entry.durationMinutes,
    startedAt: null,
    endedAt: null,
  };
}

function copiedEntryCellKey(projectId: string, localDate: string) {
  return `${projectId}:${localDate}`;
}

async function assertDateOpen(tx: TimeTrackingTransaction, memberId: string, localDate: Date) {
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

async function assertDailyTotalWithinHardLimit(
  tx: TimeTrackingTransaction,
  input: {
    memberId: string;
    localDate: Date;
    addedMinutes: number;
    excludingTimeEntryId?: string;
  },
) {
  if (input.addedMinutes > DAILY_HARD_LIMIT_MINUTES) {
    throw new TimeTrackingError("Daily total cannot exceed 24 hours.");
  }

  const currentMinutes = await getDailyLoggedMinutes(tx, {
    memberId: input.memberId,
    localDate: input.localDate,
    excludingTimeEntryId: input.excludingTimeEntryId,
  });

  if (currentMinutes + input.addedMinutes > DAILY_HARD_LIMIT_MINUTES) {
    throw new TimeTrackingError("Daily total cannot exceed 24 hours.");
  }
}

async function getDailyLoggedMinutes(
  tx: TimeTrackingTransaction,
  input: {
    memberId: string;
    localDate: Date;
    excludingTimeEntryId?: string;
  },
) {
  const aggregate = await tx.timeEntry.aggregate({
    where: {
      memberId: input.memberId,
      deletedAt: null,
      localDate: input.localDate,
      ...(input.excludingTimeEntryId ? { NOT: { id: input.excludingTimeEntryId } } : {}),
    },
    _sum: {
      durationMinutes: true,
    },
  });

  return aggregate._sum.durationMinutes ?? 0;
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

async function clearInactiveMarkerForEntryDate(
  tx: TimeTrackingTransaction,
  input: {
    memberId: string;
    projectId: string;
    localDate: Date;
  },
) {
  await tx.inactiveProjectWeek.deleteMany({
    where: {
      memberId: input.memberId,
      projectId: input.projectId,
      weekStartDate: getMonday(input.localDate),
    },
  });
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

async function findOptionalAssignmentForDate(
  tx: TimeTrackingTransaction,
  input: {
    memberId: string;
    projectId: string;
    localDate: Date;
  },
): Promise<AssignmentForMutation | null> {
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
    projectStartsOn: assignment.project.startsOn
      ? formatDateOnly(assignment.project.startsOn)
      : null,
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
    startTime: entry.startedAt ? formatTimeInTimezone(entry.startedAt, entry.timezone) : null,
    endTime: entry.endedAt ? formatTimeInTimezone(entry.endedAt, entry.timezone) : null,
    locked: Boolean(entry.lockedByTimesheetRevisionId),
    updatedAt: entry.updatedAt.toISOString(),
    adminModification:
      entry.adminModifiedAt && entry.adminModificationReason
        ? {
            modifiedAt: entry.adminModifiedAt.toISOString(),
            modifiedByName: entry.adminModifiedBy?.displayName ?? null,
            reason: entry.adminModificationReason,
            timezone: entry.timezone,
          }
        : null,
  };
}

function mapRunningTimer(timer: RunningTimerRecord): RunningTimerView {
  const colorToken = isProjectColorToken(timer.projectAssignment.project.colorToken)
    ? timer.projectAssignment.project.colorToken
    : "teal";

  return {
    id: timer.id,
    projectId: timer.projectId,
    projectAssignmentId: timer.projectAssignmentId,
    projectName: timer.projectAssignment.project.name,
    projectColor: projectColorValues[colorToken],
    description: timer.description,
    startedAt: timer.startedAt.toISOString(),
  };
}

function mapTimeEntryDraft(
  draft: {
    draftKey: string;
    payload: Prisma.JsonValue;
    updatedAt: Date;
  } | null,
): TimeEntryDraftView | null {
  if (!draft || !isTimeEntryDraftPayload(draft.payload)) return null;

  return {
    draftKey: draft.draftKey,
    payload: draft.payload,
    updatedAt: draft.updatedAt.toISOString(),
  };
}

function serializeTimeEntryForAudit(entry: {
  projectId: string;
  projectAssignmentId: string;
  localDate: Date;
  durationMinutes: number;
  description: string;
  startedAt?: Date | null;
  endedAt?: Date | null;
}) {
  return {
    projectId: entry.projectId,
    projectAssignmentId: entry.projectAssignmentId,
    localDate: formatDateOnly(entry.localDate),
    durationMinutes: entry.durationMinutes,
    description: entry.description,
    startedAt: entry.startedAt?.toISOString() ?? null,
    endedAt: entry.endedAt?.toISOString() ?? null,
  };
}

function isTimeEntryDraftPayload(value: Prisma.JsonValue): value is TimeEntryDraftPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const record = value as Record<string, unknown>;

  return (
    record.kind === "time-entry-form" &&
    record.version === 1 &&
    (record.source === "GRID" || record.source === "FORM") &&
    typeof record.projectId === "string" &&
    typeof record.localDate === "string" &&
    (record.timingMode === "DURATION" || record.timingMode === "INTERVAL") &&
    typeof record.durationText === "string" &&
    typeof record.startTime === "string" &&
    typeof record.endTime === "string" &&
    typeof record.description === "string" &&
    (record.prefill === undefined || typeof record.prefill === "boolean")
  );
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

type TimeTrackingTransaction = Prisma.TransactionClient;
