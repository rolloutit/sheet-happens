import { isSupportedCurrencyCode, normalizeCurrencyCode } from "@/src/lib/member-preferences";
import { prisma } from "@/src/server/db/client";

export type RateMemberProfile = "CONTRACTOR" | "EMPLOYEE";
export type RateMemberStatus = "INVITED" | "ACTIVE" | "INACTIVE" | "DELETED";

export type RateRequestMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type RatePeriodInput = {
  validFrom: Date;
  validTo?: Date | null;
  hourlyRate: string | number;
  currencyCode: string;
  note?: string | null;
};

export type CreateMemberDefaultRateInput = RatePeriodInput & {
  memberId: string;
  actorMemberId: string;
  requestMetadata?: RateRequestMetadata;
};

export type CreateAssignmentOverrideRateInput = RatePeriodInput & {
  projectAssignmentId: string;
  actorMemberId: string;
  requestMetadata?: RateRequestMetadata;
};

export type AdminRatePeriodRow = {
  id: string;
  validFrom: string;
  validTo: string | null;
  hourlyRate: string;
  currencyCode: string;
  createdAt: string;
  createdByName: string;
  note: string | null;
};

export type AdminMemberRateRow = {
  memberId: string;
  memberName: string;
  memberEmail: string;
  memberStatus: RateMemberStatus;
  memberProfile: RateMemberProfile;
  defaultCurrencyCode: string;
  currentRate: AdminRatePeriodRow | null;
  ratePeriods: AdminRatePeriodRow[];
};

export type AdminAssignmentRateRow = {
  assignmentId: string;
  projectId: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  memberProfile: RateMemberProfile;
  memberDefaultCurrencyCode: string;
  projectName: string;
  currentOverrideRate: AdminRatePeriodRow | null;
  overrideRatePeriods: AdminRatePeriodRow[];
};

type RateManagementDb = {
  $transaction<T>(callback: (tx: RateManagementTransaction) => Promise<T>): Promise<T>;
  member: {
    findMany(args: {
      where: {
        deletedAt: null;
      };
      orderBy: Array<Record<string, "asc" | "desc">>;
      select: MemberRateListSelect;
    }): Promise<MemberRateListRecord[]>;
  };
  projectAssignment: {
    findMany(args: {
      where: {
        project: {
          deletedAt: null;
        };
      };
      orderBy: Array<Record<string, "asc" | "desc">>;
      select: AssignmentRateListSelect;
    }): Promise<AssignmentRateListRecord[]>;
  };
};

type RateManagementTransaction = {
  member: {
    findUnique(args: {
      where: {
        id: string;
      };
      select: MemberSelect;
    }): Promise<MemberRecord | null>;
  };
  projectAssignment: {
    findUnique(args: {
      where: {
        id: string;
      };
      select: AssignmentSelect;
    }): Promise<AssignmentRecord | null>;
  };
  memberDefaultRatePeriod: {
    findMany(args: {
      where: {
        memberId: string;
      };
      orderBy: Array<Record<string, "asc" | "desc">>;
      select: RatePeriodSelect;
    }): Promise<RatePeriodRecord[]>;
    create(args: {
      data: {
        memberId: string;
        validFrom: Date;
        validTo: Date | null;
        hourlyRate: string;
        currencyCode: string;
        createdByMemberId: string;
        note: string | null;
      };
      select: {
        id: true;
      };
    }): Promise<{ id: string }>;
    update(args: {
      where: {
        id: string;
      };
      data: {
        validTo: Date;
      };
      select: RatePeriodSelect;
    }): Promise<RatePeriodRecord>;
  };
  assignmentRatePeriod: {
    findMany(args: {
      where: {
        projectAssignmentId: string;
      };
      orderBy: Array<Record<string, "asc" | "desc">>;
      select: RatePeriodSelect;
    }): Promise<RatePeriodRecord[]>;
    create(args: {
      data: {
        projectAssignmentId: string;
        validFrom: Date;
        validTo: Date | null;
        hourlyRate: string;
        currencyCode: string;
        createdByMemberId: string;
        note: string | null;
      };
      select: {
        id: true;
      };
    }): Promise<{ id: string }>;
    update(args: {
      where: {
        id: string;
      };
      data: {
        validTo: Date;
      };
      select: RatePeriodSelect;
    }): Promise<RatePeriodRecord>;
  };
  auditLog: {
    create(args: {
      data: {
        actorMemberId: string;
        action: string;
        targetType: "member_default_rate_period" | "assignment_rate_period";
        targetId: string;
        before?: Record<string, unknown>;
        after?: Record<string, unknown>;
        ipAddress?: string | null;
        userAgent?: string | null;
      };
    }): Promise<unknown>;
  };
};

type MemberSelect = {
  id: true;
  email: true;
  firstName: true;
  lastName: true;
  displayName: true;
  status: true;
  currentProfile: true;
  defaultCurrencyCode: true;
  deletedAt: true;
};

type MemberRecord = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  status: RateMemberStatus;
  currentProfile: RateMemberProfile;
  defaultCurrencyCode: string;
  deletedAt: Date | null;
};

type RatePeriodSelect = {
  id: true;
  validFrom: true;
  validTo: true;
  hourlyRate: true;
  currencyCode: true;
  createdAt: true;
  createdBy: {
    select: RateCreatedBySelect;
  };
  note: true;
};

type RatePeriodRecord = {
  id: string;
  validFrom: Date;
  validTo: Date | null;
  hourlyRate: { toString(): string };
  currencyCode: string;
  createdAt: Date;
  createdBy: RateCreatedByRecord;
  note: string | null;
};

type RateCreatedBySelect = {
  firstName: true;
  lastName: true;
  displayName: true;
  email: true;
};

type RateCreatedByRecord = {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
};

type MemberRateListSelect = MemberSelect & {
  defaultRatePeriods: {
    orderBy: Array<Record<string, "asc" | "desc">>;
    select: RatePeriodSelect;
  };
};

type MemberRateListRecord = MemberRecord & {
  defaultRatePeriods: RatePeriodRecord[];
};

type AssignmentSelect = {
  id: true;
  projectId: true;
  memberId: true;
  member: {
    select: MemberSelect;
  };
  project: {
    select: {
      id: true;
      name: true;
      deletedAt: true;
    };
  };
};

type AssignmentRecord = {
  id: string;
  projectId: string;
  memberId: string;
  member: MemberRecord;
  project: {
    id: string;
    name: string;
    deletedAt: Date | null;
  };
};

type AssignmentRateListSelect = AssignmentSelect & {
  overrideRates: {
    orderBy: Array<Record<string, "asc" | "desc">>;
    select: RatePeriodSelect;
  };
};

type AssignmentRateListRecord = AssignmentRecord & {
  overrideRates: RatePeriodRecord[];
};

type NormalizedRateInput = {
  validFrom: Date;
  validTo: Date | null;
  hourlyRate: string;
  currencyCode: string;
  note: string | null;
};

const memberSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  displayName: true,
  status: true,
  currentProfile: true,
  defaultCurrencyCode: true,
  deletedAt: true,
} satisfies MemberSelect;

const ratePeriodSelect = {
  id: true,
  validFrom: true,
  validTo: true,
  hourlyRate: true,
  currencyCode: true,
  createdAt: true,
  createdBy: {
    select: {
      firstName: true,
      lastName: true,
      displayName: true,
      email: true,
    },
  },
  note: true,
} satisfies RatePeriodSelect;

const assignmentSelect = {
  id: true,
  projectId: true,
  memberId: true,
  member: {
    select: memberSelect,
  },
  project: {
    select: {
      id: true,
      name: true,
      deletedAt: true,
    },
  },
} satisfies AssignmentSelect;

export class RateManagementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateManagementError";
  }
}

export async function listMemberRatesForAdmin(
  deps: { db?: RateManagementDb; now?: () => Date } = {},
): Promise<AdminMemberRateRow[]> {
  const db = deps.db ?? (prisma as unknown as RateManagementDb);
  const today = toDateOnly(deps.now?.() ?? new Date());
  const members = await db.member.findMany({
    where: {
      deletedAt: null,
    },
    orderBy: [{ displayName: "asc" }, { email: "asc" }],
    select: {
      ...memberSelect,
      defaultRatePeriods: {
        orderBy: [{ validFrom: "desc" }],
        select: ratePeriodSelect,
      },
    },
  });

  return members.map((member) => mapMemberRateRow(member, today));
}

export async function listAssignmentRatesForAdmin(
  deps: { db?: RateManagementDb; now?: () => Date } = {},
): Promise<AdminAssignmentRateRow[]> {
  const db = deps.db ?? (prisma as unknown as RateManagementDb);
  const today = toDateOnly(deps.now?.() ?? new Date());
  const assignments = await db.projectAssignment.findMany({
    where: {
      project: {
        deletedAt: null,
      },
    },
    orderBy: [{ projectId: "asc" }, { memberId: "asc" }],
    select: {
      ...assignmentSelect,
      overrideRates: {
        orderBy: [{ validFrom: "desc" }],
        select: ratePeriodSelect,
      },
    },
  });

  return assignments.map((assignment) => mapAssignmentRateRow(assignment, today));
}

export async function createMemberDefaultRate(
  input: CreateMemberDefaultRateInput,
  deps: { db?: RateManagementDb; now?: () => Date } = {},
) {
  const db = deps.db ?? (prisma as unknown as RateManagementDb);
  const rate = normalizeRateInput(input);
  const today = toDateOnly(deps.now?.() ?? new Date());

  return db.$transaction(async (tx) => {
    await findRateMember(tx, input.memberId);
    const existingRates = await tx.memberDefaultRatePeriod.findMany({
      where: {
        memberId: input.memberId,
      },
      orderBy: [{ validFrom: "asc" }],
      select: ratePeriodSelect,
    });

    const previousOpenEndedRate = getOpenEndedPredecessorToClose(existingRates, rate);
    assertNoRateOverlap(
      getRatesWithAutomaticClose(existingRates, previousOpenEndedRate, rate),
      rate,
    );
    assertCurrencyChangeAllowed(existingRates, rate, today);

    const created = await tx.memberDefaultRatePeriod.create({
      data: {
        memberId: input.memberId,
        ...rate,
        createdByMemberId: input.actorMemberId,
      },
      select: {
        id: true,
      },
    });

    if (previousOpenEndedRate) {
      const closedRate = await tx.memberDefaultRatePeriod.update({
        where: {
          id: previousOpenEndedRate.id,
        },
        data: {
          validTo: rate.validFrom,
        },
        select: ratePeriodSelect,
      });

      await tx.auditLog.create({
        data: {
          actorMemberId: input.actorMemberId,
          action: "rate.member_default.closed_for_successor",
          targetType: "member_default_rate_period",
          targetId: previousOpenEndedRate.id,
          before: serializeRatePeriodRecord(previousOpenEndedRate),
          after: {
            ...serializeRatePeriodRecord(closedRate),
            successorRatePeriodId: created.id,
          },
          ...input.requestMetadata,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "rate.member_default.created",
        targetType: "member_default_rate_period",
        targetId: created.id,
        after: {
          memberId: input.memberId,
          supersededRatePeriodId: previousOpenEndedRate?.id ?? null,
          ...serializeRateInput(rate),
        },
        ...input.requestMetadata,
      },
    });

    return {
      ratePeriodId: created.id,
    };
  });
}

export async function createAssignmentOverrideRate(
  input: CreateAssignmentOverrideRateInput,
  deps: { db?: RateManagementDb; now?: () => Date } = {},
) {
  const db = deps.db ?? (prisma as unknown as RateManagementDb);
  const rate = normalizeRateInput(input);
  const today = toDateOnly(deps.now?.() ?? new Date());

  return db.$transaction(async (tx) => {
    const assignment = await findRateAssignment(tx, input.projectAssignmentId);

    if (assignment.member.currentProfile !== "CONTRACTOR") {
      throw new RateManagementError(
        "Only contractor assignments can have project-specific override rates.",
      );
    }

    const existingRates = await tx.assignmentRatePeriod.findMany({
      where: {
        projectAssignmentId: input.projectAssignmentId,
      },
      orderBy: [{ validFrom: "asc" }],
      select: ratePeriodSelect,
    });

    const previousOpenEndedRate = getOpenEndedPredecessorToClose(existingRates, rate);
    assertNoRateOverlap(
      getRatesWithAutomaticClose(existingRates, previousOpenEndedRate, rate),
      rate,
    );
    assertCurrencyChangeAllowed(existingRates, rate, today);

    const created = await tx.assignmentRatePeriod.create({
      data: {
        projectAssignmentId: input.projectAssignmentId,
        ...rate,
        createdByMemberId: input.actorMemberId,
      },
      select: {
        id: true,
      },
    });

    if (previousOpenEndedRate) {
      const closedRate = await tx.assignmentRatePeriod.update({
        where: {
          id: previousOpenEndedRate.id,
        },
        data: {
          validTo: rate.validFrom,
        },
        select: ratePeriodSelect,
      });

      await tx.auditLog.create({
        data: {
          actorMemberId: input.actorMemberId,
          action: "rate.assignment_override.closed_for_successor",
          targetType: "assignment_rate_period",
          targetId: previousOpenEndedRate.id,
          before: serializeRatePeriodRecord(previousOpenEndedRate),
          after: {
            ...serializeRatePeriodRecord(closedRate),
            successorRatePeriodId: created.id,
          },
          ...input.requestMetadata,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "rate.assignment_override.created",
        targetType: "assignment_rate_period",
        targetId: created.id,
        after: {
          projectAssignmentId: input.projectAssignmentId,
          memberId: assignment.memberId,
          projectId: assignment.projectId,
          supersededRatePeriodId: previousOpenEndedRate?.id ?? null,
          ...serializeRateInput(rate),
        },
        ...input.requestMetadata,
      },
    });

    return {
      ratePeriodId: created.id,
    };
  });
}

function normalizeRateInput(input: RatePeriodInput): NormalizedRateInput {
  const validFrom = normalizeDateOnly(input.validFrom, "Rate start date is required.");
  const validTo = input.validTo
    ? normalizeDateOnly(input.validTo, "Choose a valid rate end date.")
    : null;
  const hourlyRate = normalizeHourlyRate(input.hourlyRate);
  const currencyCode = normalizeCurrencyCode(input.currencyCode);
  const note = input.note?.trim() || null;

  if (validTo && validTo <= validFrom) {
    throw new RateManagementError("Rate end date must be after the start date.");
  }

  if (!isSupportedCurrencyCode(currencyCode)) {
    throw new RateManagementError("Choose a supported currency.");
  }

  return {
    validFrom,
    validTo,
    hourlyRate,
    currencyCode,
    note,
  };
}

function normalizeHourlyRate(value: string | number) {
  const rawValue = String(value).trim();

  if (!/^\d+(\.\d{1,2})?$/.test(rawValue)) {
    throw new RateManagementError(
      "Hourly rate must be a non-negative amount with up to 2 decimals.",
    );
  }

  const numericValue = Number(rawValue);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new RateManagementError("Hourly rate must be a non-negative amount.");
  }

  return numericValue.toFixed(2);
}

async function findRateMember(tx: RateManagementTransaction, memberId: string) {
  const member = await tx.member.findUnique({
    where: {
      id: memberId,
    },
    select: memberSelect,
  });

  if (!member || member.deletedAt || member.status === "DELETED") {
    throw new RateManagementError("Member does not exist.");
  }

  return member;
}

async function findRateAssignment(tx: RateManagementTransaction, assignmentId: string) {
  const assignment = await tx.projectAssignment.findUnique({
    where: {
      id: assignmentId,
    },
    select: assignmentSelect,
  });

  if (!assignment || assignment.project.deletedAt || assignment.member.deletedAt) {
    throw new RateManagementError("Project assignment does not exist.");
  }

  return assignment;
}

function assertNoRateOverlap(existingRates: RatePeriodRecord[], nextRate: NormalizedRateInput) {
  const overlappingRate = existingRates.find((rate) => ratePeriodsOverlap(nextRate, rate));

  if (overlappingRate) {
    throw new RateManagementError("A rate period already exists in the selected date range.");
  }
}

function getOpenEndedPredecessorToClose(
  existingRates: RatePeriodRecord[],
  nextRate: NormalizedRateInput,
) {
  return (
    existingRates.find(
      (rate) =>
        !rate.validTo &&
        rate.validFrom.getTime() < nextRate.validFrom.getTime() &&
        ratePeriodsOverlap(nextRate, rate),
    ) ?? null
  );
}

function getRatesWithAutomaticClose(
  existingRates: RatePeriodRecord[],
  previousOpenEndedRate: RatePeriodRecord | null,
  nextRate: NormalizedRateInput,
) {
  if (!previousOpenEndedRate) return existingRates;

  return existingRates.map((rate) =>
    rate.id === previousOpenEndedRate.id
      ? {
          ...rate,
          validTo: nextRate.validFrom,
        }
      : rate,
  );
}

function ratePeriodsOverlap(
  left: { validFrom: Date; validTo: Date | null },
  right: { validFrom: Date; validTo: Date | null },
) {
  const leftEnd = left.validTo?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightEnd = right.validTo?.getTime() ?? Number.POSITIVE_INFINITY;

  return left.validFrom.getTime() < rightEnd && right.validFrom.getTime() < leftEnd;
}

function assertCurrencyChangeAllowed(
  existingRates: RatePeriodRecord[],
  nextRate: NormalizedRateInput,
  today: Date,
) {
  const changesCurrency = existingRates.some((rate) => rate.currencyCode !== nextRate.currencyCode);

  if (!changesCurrency) return;

  const earliestAllowedDate = today.getUTCDate() === 1 ? today : firstDayOfNextMonth(today);

  if (nextRate.validFrom.getUTCDate() !== 1 || nextRate.validFrom < earliestAllowedDate) {
    throw new RateManagementError(
      "Currency-changing rates must start on the first day of a future month.",
    );
  }
}

function mapMemberRateRow(member: MemberRateListRecord, today: Date): AdminMemberRateRow {
  const ratePeriods = member.defaultRatePeriods.map(mapRatePeriodRow);

  return {
    memberId: member.id,
    memberName: getMemberName(member),
    memberEmail: member.email,
    memberStatus: member.status,
    memberProfile: member.currentProfile,
    defaultCurrencyCode: member.defaultCurrencyCode,
    currentRate: getCurrentRatePeriod(member.defaultRatePeriods, today),
    ratePeriods,
  };
}

function mapAssignmentRateRow(
  assignment: AssignmentRateListRecord,
  today: Date,
): AdminAssignmentRateRow {
  const overrideRatePeriods = assignment.overrideRates.map(mapRatePeriodRow);

  return {
    assignmentId: assignment.id,
    projectId: assignment.projectId,
    memberId: assignment.memberId,
    memberName: getMemberName(assignment.member),
    memberEmail: assignment.member.email,
    memberProfile: assignment.member.currentProfile,
    memberDefaultCurrencyCode: assignment.member.defaultCurrencyCode,
    projectName: assignment.project.name,
    currentOverrideRate: getCurrentRatePeriod(assignment.overrideRates, today),
    overrideRatePeriods,
  };
}

function getCurrentRatePeriod(periods: RatePeriodRecord[], today: Date) {
  const period = periods.find((candidate) => {
    const starts = candidate.validFrom <= today;
    const hasNotEnded = !candidate.validTo || candidate.validTo > today;
    return starts && hasNotEnded;
  });

  return period ? mapRatePeriodRow(period) : null;
}

function mapRatePeriodRow(period: RatePeriodRecord): AdminRatePeriodRow {
  return {
    id: period.id,
    validFrom: formatDateOnly(period.validFrom),
    validTo: period.validTo ? formatDateOnly(period.validTo) : null,
    hourlyRate: period.hourlyRate.toString(),
    currencyCode: period.currencyCode,
    createdAt: period.createdAt.toISOString(),
    createdByName: getMemberName(period.createdBy),
    note: period.note,
  };
}

function getMemberName(
  member: Pick<MemberRecord, "displayName" | "firstName" | "lastName" | "email">,
) {
  return (
    member.displayName.trim() ||
    [member.firstName.trim(), member.lastName.trim()].filter(Boolean).join(" ") ||
    member.email
  );
}

function serializeRateInput(rate: NormalizedRateInput) {
  return {
    ...rate,
    validFrom: formatDateOnly(rate.validFrom),
    validTo: rate.validTo ? formatDateOnly(rate.validTo) : null,
  };
}

function serializeRatePeriodRecord(rate: RatePeriodRecord) {
  return {
    id: rate.id,
    validFrom: formatDateOnly(rate.validFrom),
    validTo: rate.validTo ? formatDateOnly(rate.validTo) : null,
    hourlyRate: rate.hourlyRate.toString(),
    currencyCode: rate.currencyCode,
    createdAt: rate.createdAt.toISOString(),
    createdByName: getMemberName(rate.createdBy),
    note: rate.note,
  };
}

function normalizeDateOnly(date: Date, message: string) {
  if (Number.isNaN(date.getTime())) {
    throw new RateManagementError(message);
  }

  return toDateOnly(date);
}

function toDateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function firstDayOfNextMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}
