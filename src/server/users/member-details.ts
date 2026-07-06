import {
  isSupportedCurrencyCode,
  isSupportedLocale,
  isSupportedTimeZone,
  normalizeCurrencyCode,
  normalizeLocale,
  normalizeTimeZone,
} from "@/src/lib/member-preferences";
import { prisma } from "@/src/server/db/client";

export type UpdateMemberDetailsInput = {
  memberId: string;
  actorMemberId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  defaultCurrencyCode: string;
  timezone: string;
  locale: string;
};

type EditableMemberDetails = Omit<UpdateMemberDetailsInput, "memberId" | "actorMemberId">;

type UpdateMemberDetailsDb = {
  $transaction<T>(callback: (tx: UpdateMemberDetailsTransaction) => Promise<T>): Promise<T>;
};

type UpdateMemberDetailsTransaction = {
  member: {
    findUnique(args: {
      where: { id: string };
      select: {
        id: true;
        firstName: true;
        lastName: true;
        displayName: true;
        defaultCurrencyCode: true;
        timezone: true;
        locale: true;
        status: true;
        deletedAt: true;
      };
    }): Promise<{
      id: string;
      firstName: string;
      lastName: string;
      displayName: string;
      defaultCurrencyCode: string;
      timezone: string;
      locale: string;
      status: string;
      deletedAt: Date | null;
    } | null>;
    update(args: {
      where: { id: string };
      data: Partial<EditableMemberDetails>;
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

export type UpdateMemberDetailsDeps = {
  db?: UpdateMemberDetailsDb;
};

export class MemberDetailsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberDetailsError";
  }
}

export async function updateMemberDetails(
  input: UpdateMemberDetailsInput,
  deps: UpdateMemberDetailsDeps = {},
) {
  const db: UpdateMemberDetailsDb = deps.db ?? (prisma as unknown as UpdateMemberDetailsDb);
  const nextDetails = getNextDetails(input);

  return db.$transaction(async (tx) => {
    const member = await tx.member.findUnique({
      where: {
        id: input.memberId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        defaultCurrencyCode: true,
        timezone: true,
        locale: true,
        status: true,
        deletedAt: true,
      },
    });

    if (!member) {
      throw new MemberDetailsError("Member does not exist.");
    }

    if (member.deletedAt || member.status === "DELETED") {
      throw new MemberDetailsError("Deleted members cannot be changed.");
    }

    const changes = getChangedDetails(member, nextDetails);

    if (!Object.keys(changes.after).length) {
      return {
        memberId: member.id,
        changed: false,
      };
    }

    await tx.member.update({
      where: {
        id: member.id,
      },
      data: changes.after,
      select: {
        id: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "member.updated",
        targetType: "member",
        targetId: member.id,
        before: changes.before,
        after: changes.after,
      },
    });

    return {
      memberId: member.id,
      changed: true,
    };
  });
}

function getNextDetails(input: UpdateMemberDetailsInput): EditableMemberDetails {
  const nextDetails = {
    firstName: input.firstName,
    lastName: input.lastName,
    displayName: input.displayName,
    defaultCurrencyCode: normalizeCurrencyCode(input.defaultCurrencyCode),
    timezone: normalizeTimeZone(input.timezone),
    locale: normalizeLocale(input.locale),
  } satisfies EditableMemberDetails;

  if (
    !isSupportedCurrencyCode(nextDetails.defaultCurrencyCode) ||
    !isSupportedTimeZone(nextDetails.timezone) ||
    !isSupportedLocale(nextDetails.locale)
  ) {
    throw new MemberDetailsError(
      "Member details require supported currency, timezone, and locale.",
    );
  }

  return nextDetails;
}

function getChangedDetails(current: EditableMemberDetails, next: EditableMemberDetails) {
  const before: Record<string, unknown> = {};
  const after: Partial<EditableMemberDetails> = {};

  for (const key of Object.keys(next) as Array<keyof EditableMemberDetails>) {
    if (current[key] !== next[key]) {
      before[key] = current[key];
      after[key] = next[key];
    }
  }

  return {
    before,
    after,
  };
}
