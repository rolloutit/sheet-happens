import { formatDateOnly, getMonthStart } from "./dates";

/**
 * Which tracking mode governs a member/project pair, and the guard that stops an admin switching
 * a mode out from under a month that already holds data of the other kind.
 *
 * `resolveTrackingMode` is the single authority for the mode the way `resolveTimesheetLineRate` is
 * the single authority for rates: a pure function over rows the caller has already fetched, with
 * no client and no I/O. The mode is deliberately **not** time-versioned — it governs what a member
 * may create now, not how past records are read, because a declaration and a time entry are
 * distinct records and history is therefore self-describing.
 */

export type TrackingMode = "TRACKED" | "DECLARED";

/** Where the resolved mode came from, mirroring `RateSource` for rates. */
export type TrackingModeSource = "MEMBER_DEFAULT" | "ASSIGNMENT_OVERRIDE";

export type TrackingModeMember = {
  defaultTrackingMode: TrackingMode;
};

export type TrackingModeAssignment = {
  trackingMode: TrackingMode | null;
};

export type ResolvedTrackingMode = {
  mode: TrackingMode;
  source: TrackingModeSource;
};

/** What blocks a switch: a month that already holds data the target mode cannot account for. */
export type TrackingModeConflictKind = "TRACKED_ENTRIES" | "DECLARATION";

export type TrackingModeConflict = {
  kind: TrackingModeConflictKind;
  projectId: string;
  projectName: string;
  /** The first of the month, `YYYY-MM-DD`. */
  periodStart: string;
  count: number;
};

/** One month of one project, as counted for the guard. */
export type TrackingModeMonthData = {
  projectId: string;
  projectName: string;
  periodStart: string;
  trackedEntryCount: number;
  declarationCount: number;
};

export class TrackingModeSwitchError extends Error {
  readonly targetMode: TrackingMode;
  readonly conflicts: TrackingModeConflict[];

  constructor(targetMode: TrackingMode, conflicts: TrackingModeConflict[]) {
    super(
      `Cannot switch to ${targetMode.toLowerCase()} hours while ${conflicts.length} month(s) still hold data of the other kind.`,
    );
    this.name = "TrackingModeSwitchError";
    this.targetMode = targetMode;
    this.conflicts = conflicts;
  }
}

/**
 * `null` on the assignment inherits the member default, which is what makes a hybrid member fall
 * out for free: one member, some assignments overridden, some not.
 */
export function resolveTrackingMode(
  member: TrackingModeMember,
  assignment: TrackingModeAssignment | null,
): ResolvedTrackingMode {
  if (assignment?.trackingMode) {
    return {
      mode: assignment.trackingMode,
      source: "ASSIGNMENT_OVERRIDE",
    };
  }

  return {
    mode: member.defaultTrackingMode,
    source: "MEMBER_DEFAULT",
  };
}

/**
 * The months that refuse the switch, newest first.
 *
 * **An open month is any month that is not locked.** For a contractor that is the months without
 * an active `PeriodLock`; for an employee there is no lock at all, so every month holding data is
 * open — the accepted asymmetry recorded in the design doc, not an oversight. Scoping the check to
 * the current calendar month instead would make it decorative: an employee with July entries could
 * be switched to declared in September and then declare July on top of them. Locked months are
 * excluded because their data is frozen and cannot take part in a double count, and because
 * history must never leave an admin unable to fix a misconfiguration.
 */
export function collectTrackingModeConflicts(input: {
  targetMode: TrackingMode;
  months: readonly TrackingModeMonthData[];
  lockedPeriodStarts: readonly string[];
}): TrackingModeConflict[] {
  const locked = new Set(input.lockedPeriodStarts);
  const kind: TrackingModeConflictKind =
    input.targetMode === "DECLARED" ? "TRACKED_ENTRIES" : "DECLARATION";

  return input.months
    .filter((month) => !locked.has(month.periodStart))
    .map((month) => ({
      kind,
      projectId: month.projectId,
      projectName: month.projectName,
      periodStart: month.periodStart,
      count: kind === "TRACKED_ENTRIES" ? month.trackedEntryCount : month.declarationCount,
    }))
    .filter((conflict) => conflict.count > 0)
    .sort(
      (left, right) =>
        right.periodStart.localeCompare(left.periodStart) ||
        left.projectName.localeCompare(right.projectName),
    );
}

/**
 * The rows the guard reads. Exported so a caller's own transaction type can intersect it and the
 * two stay in step, rather than each write path restating the shape.
 */
export type TrackingModeConflictClient = {
  timeEntry: {
    findMany(args: {
      where: {
        projectAssignmentId: {
          in: string[];
        };
        deletedAt: null;
        source: {
          not: "DECLARED";
        };
      };
      select: TrackingModeEntrySelect;
    }): Promise<TrackingModeEntryRecord[]>;
  };
  monthlyHourDeclaration: {
    findMany(args: {
      where: {
        projectAssignmentId: {
          in: string[];
        };
      };
      select: TrackingModeDeclarationSelect;
    }): Promise<TrackingModeDeclarationRecord[]>;
  };
  periodLock: {
    findMany(args: {
      where: {
        memberId: string;
        unlockedAt: null;
      };
      select: {
        periodStart: true;
      };
    }): Promise<Array<{ periodStart: Date }>>;
  };
};

export type TrackingModeAssignmentClient = {
  projectAssignment: {
    findMany(args: {
      where: {
        memberId: string;
        trackingMode: null;
      };
      select: {
        id: true;
      };
    }): Promise<Array<{ id: string }>>;
  };
};

type TrackingModeProjectSelect = {
  select: {
    name: true;
  };
};

type TrackingModeEntrySelect = {
  projectId: true;
  localDate: true;
  project: TrackingModeProjectSelect;
};

type TrackingModeEntryRecord = {
  projectId: string;
  localDate: Date;
  project: {
    name: string;
  };
};

type TrackingModeDeclarationSelect = {
  projectId: true;
  periodStart: true;
  project: TrackingModeProjectSelect;
};

type TrackingModeDeclarationRecord = {
  projectId: string;
  periodStart: Date;
  project: {
    name: string;
  };
};

/**
 * The assignments a change to `Member.defaultTrackingMode` actually moves. An assignment carrying
 * an explicit override is unaffected by the default, so it must not block the switch.
 */
export async function findInheritingAssignmentIds(
  client: TrackingModeAssignmentClient,
  memberId: string,
): Promise<string[]> {
  const assignments = await client.projectAssignment.findMany({
    where: {
      memberId,
      trackingMode: null,
    },
    select: {
      id: true,
    },
  });

  return assignments.map((assignment) => assignment.id);
}

export async function findTrackingModeConflicts(
  client: TrackingModeConflictClient,
  input: {
    memberId: string;
    assignmentIds: readonly string[];
    targetMode: TrackingMode;
  },
): Promise<TrackingModeConflict[]> {
  const assignmentIds = [...new Set(input.assignmentIds)];

  if (!assignmentIds.length) return [];

  const months = new Map<string, TrackingModeMonthData>();
  const addMonth = (
    projectId: string,
    projectName: string,
    date: Date,
    field: "trackedEntryCount" | "declarationCount",
  ) => {
    const periodStart = formatDateOnly(getMonthStart(date));
    const key = `${projectId}:${periodStart}`;
    const month =
      months.get(key) ??
      ({
        projectId,
        projectName,
        periodStart,
        trackedEntryCount: 0,
        declarationCount: 0,
      } satisfies TrackingModeMonthData);

    month[field] += 1;
    months.set(key, month);
  };

  // Only the direction being switched into needs counting: switching to declared collides with
  // ordinary entries, switching back to tracked collides with a declaration.
  if (input.targetMode === "DECLARED") {
    const entries = await client.timeEntry.findMany({
      where: {
        projectAssignmentId: {
          in: assignmentIds,
        },
        deletedAt: null,
        source: {
          not: "DECLARED",
        },
      },
      select: {
        projectId: true,
        localDate: true,
        project: {
          select: {
            name: true,
          },
        },
      },
    });

    for (const entry of entries) {
      addMonth(entry.projectId, entry.project.name, entry.localDate, "trackedEntryCount");
    }
  } else {
    const declarations = await client.monthlyHourDeclaration.findMany({
      where: {
        projectAssignmentId: {
          in: assignmentIds,
        },
      },
      select: {
        projectId: true,
        periodStart: true,
        project: {
          select: {
            name: true,
          },
        },
      },
    });

    for (const declaration of declarations) {
      addMonth(
        declaration.projectId,
        declaration.project.name,
        declaration.periodStart,
        "declarationCount",
      );
    }
  }

  if (!months.size) return [];

  const locks = await client.periodLock.findMany({
    where: {
      memberId: input.memberId,
      unlockedAt: null,
    },
    select: {
      periodStart: true,
    },
  });

  return collectTrackingModeConflicts({
    targetMode: input.targetMode,
    months: [...months.values()],
    lockedPeriodStarts: locks.map((lock) => formatDateOnly(getMonthStart(lock.periodStart))),
  });
}

export async function assertTrackingModeSwitchAllowed(
  client: TrackingModeConflictClient,
  input: {
    memberId: string;
    assignmentIds: readonly string[];
    targetMode: TrackingMode;
  },
) {
  const conflicts = await findTrackingModeConflicts(client, input);

  if (conflicts.length) {
    throw new TrackingModeSwitchError(input.targetMode, conflicts);
  }
}
