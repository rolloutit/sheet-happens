import { prisma } from "@/src/server/db/client";

export type MemberProfileTransitionProfile = "EMPLOYEE" | "CONTRACTOR";

export type ScheduleMemberProfileTransitionInput = {
  memberId: string;
  actorMemberId: string;
  profile: MemberProfileTransitionProfile;
  validFrom: Date;
  reason?: string;
};

type MemberProfileTransitionDb = {
  $transaction<T>(callback: (tx: MemberProfileTransitionTransaction) => Promise<T>): Promise<T>;
};

type MemberProfileTransitionTransaction = {
  member: {
    findUnique(args: {
      where: { id: string };
      select: {
        id: true;
        currentProfile: true;
        status: true;
        deletedAt: true;
      };
    }): Promise<{
      id: string;
      currentProfile: MemberProfileTransitionProfile;
      status: string;
      deletedAt: Date | null;
    } | null>;
    update(args: {
      where: { id: string };
      data: {
        currentProfile?: MemberProfileTransitionProfile;
      };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  memberProfilePeriod: {
    findMany(args: {
      where: { memberId: string };
      orderBy: { validFrom: "asc" };
      select: {
        id: true;
        profile: true;
        validFrom: true;
        validTo: true;
      };
    }): Promise<MemberProfilePeriod[]>;
    update(args: {
      where: { id: string };
      data: {
        profile?: MemberProfileTransitionProfile;
        validTo?: Date | null;
        reason?: string | null;
      };
      select: { id: true };
    }): Promise<{ id: string }>;
    create(args: {
      data: {
        memberId: string;
        profile: MemberProfileTransitionProfile;
        validFrom: Date;
        validTo: Date | null;
        reason: string | null;
      };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  auditLog: {
    create(args: {
      data: {
        actorMemberId: string;
        action: string;
        targetType: string;
        targetId: string;
        before: Record<string, unknown>;
        after: Record<string, unknown>;
      };
    }): Promise<unknown>;
  };
};

type MemberProfilePeriod = {
  id: string;
  profile: MemberProfileTransitionProfile;
  validFrom: Date;
  validTo: Date | null;
};

export type ScheduleMemberProfileTransitionDeps = {
  db?: MemberProfileTransitionDb;
  now?: () => Date;
};

export class MemberProfileTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberProfileTransitionError";
  }
}

export async function scheduleMemberProfileTransition(
  input: ScheduleMemberProfileTransitionInput,
  deps: ScheduleMemberProfileTransitionDeps = {},
) {
  const db: MemberProfileTransitionDb = deps.db ?? (prisma as unknown as MemberProfileTransitionDb);
  const today = toDateOnly(deps.now?.() ?? new Date());
  const validFrom = toDateOnly(input.validFrom);
  const reason = input.reason?.trim() || null;

  if (validFrom < today) {
    throw new MemberProfileTransitionError("Profile transitions cannot start in the past.");
  }

  return db.$transaction(async (tx) => {
    const member = await tx.member.findUnique({
      where: {
        id: input.memberId,
      },
      select: {
        id: true,
        currentProfile: true,
        status: true,
        deletedAt: true,
      },
    });

    if (!member) {
      throw new MemberProfileTransitionError("Member does not exist.");
    }

    if (member.deletedAt || member.status === "DELETED") {
      throw new MemberProfileTransitionError("Deleted members cannot be changed.");
    }

    const periods = await tx.memberProfilePeriod.findMany({
      where: {
        memberId: member.id,
      },
      orderBy: {
        validFrom: "asc",
      },
      select: {
        id: true,
        profile: true,
        validFrom: true,
        validTo: true,
      },
    });

    if (!periods.length) {
      throw new MemberProfileTransitionError("Member has no profile history.");
    }

    const existingFuturePeriod = periods.find((period) => period.validFrom > today);

    if (existingFuturePeriod) {
      throw new MemberProfileTransitionError("A future profile transition is already scheduled.");
    }

    const activePeriod = findPeriodForDate(periods, today);
    const effectivePeriod = findPeriodForDate(periods, validFrom) ?? activePeriod;

    if (!activePeriod || !effectivePeriod) {
      throw new MemberProfileTransitionError("Member has no active profile period.");
    }

    if (effectivePeriod.profile === input.profile) {
      throw new MemberProfileTransitionError("The selected profile is already effective.");
    }

    const isImmediate = sameDateOnly(validFrom, today);
    const before = {
      currentProfile: member.currentProfile,
      activeProfile: activePeriod.profile,
      activeValidFrom: formatDateOnly(activePeriod.validFrom),
      activeValidTo: activePeriod.validTo ? formatDateOnly(activePeriod.validTo) : null,
    };

    let profilePeriodId: string;

    if (sameDateOnly(activePeriod.validFrom, validFrom)) {
      const updatedPeriod = await tx.memberProfilePeriod.update({
        where: {
          id: activePeriod.id,
        },
        data: {
          profile: input.profile,
          reason,
        },
        select: {
          id: true,
        },
      });
      profilePeriodId = updatedPeriod.id;
    } else {
      await tx.memberProfilePeriod.update({
        where: {
          id: activePeriod.id,
        },
        data: {
          validTo: validFrom,
        },
        select: {
          id: true,
        },
      });

      const createdPeriod = await tx.memberProfilePeriod.create({
        data: {
          memberId: member.id,
          profile: input.profile,
          validFrom,
          validTo: null,
          reason,
        },
        select: {
          id: true,
        },
      });
      profilePeriodId = createdPeriod.id;
    }

    if (isImmediate) {
      await tx.member.update({
        where: {
          id: member.id,
        },
        data: {
          currentProfile: input.profile,
        },
        select: {
          id: true,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: isImmediate ? "member.profile_changed" : "member.profile_transition_scheduled",
        targetType: "member",
        targetId: member.id,
        before,
        after: {
          profilePeriodId,
          profile: input.profile,
          validFrom: formatDateOnly(validFrom),
          reason,
          currentProfileUpdated: isImmediate,
        },
      },
    });

    return {
      memberId: member.id,
      profile: input.profile,
      validFrom: formatDateOnly(validFrom),
      immediate: isImmediate,
    };
  });
}

function findPeriodForDate(periods: MemberProfilePeriod[], date: Date) {
  return periods.find((period) => {
    return period.validFrom <= date && (!period.validTo || period.validTo > date);
  });
}

function toDateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function sameDateOnly(left: Date, right: Date) {
  return formatDateOnly(left) === formatDateOnly(right);
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}
