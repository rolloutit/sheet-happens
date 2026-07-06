import {
  isSupportedCurrencyCode,
  isSupportedLocale,
  isSupportedTimeZone,
  normalizeCurrencyCode,
  normalizeLocale,
  normalizeTimeZone,
} from "@/src/lib/member-preferences";
import { prisma } from "@/src/server/db/client";
import { sendInvitationEmail } from "@/src/server/auth/auth-emails";
import { createInvitationToken, hashInvitationToken } from "@/src/server/users/invitation-tokens";

export type InviteMemberInput = {
  email: string;
  firstName: string;
  lastName: string;
  role?: "ADMIN" | "MEMBER";
  profile: "CONTRACTOR" | "EMPLOYEE";
  timezone: string;
  locale: string;
  defaultCurrencyCode?: string;
  validFrom?: Date;
  invitedByMemberId: string;
  expiresAt?: Date;
  appUrl?: string;
};

type InviteMemberDb = {
  $transaction<T>(callback: (tx: InviteMemberTransaction) => Promise<T>): Promise<T>;
};

type InviteMemberTransaction = {
  member: {
    findUnique(args: {
      where: { email: string };
      select: {
        id: true;
        status: true;
        deletedAt: true;
        authUserId: true;
      };
    }): Promise<{
      id: string;
      status: string;
      deletedAt: Date | null;
      authUserId: string | null;
    } | null>;
    create(args: {
      data: {
        email: string;
        firstName: string;
        lastName: string;
        displayName: string;
        role: "ADMIN" | "MEMBER";
        status: "INVITED";
        currentProfile: "CONTRACTOR" | "EMPLOYEE";
        defaultCurrencyCode: string;
        timezone: string;
        locale: string;
      };
      select: { id: true };
    }): Promise<{ id: string }>;
    update(args: {
      where: { id: string };
      data: {
        firstName: string;
        lastName: string;
        displayName: string;
        role: "ADMIN" | "MEMBER";
        status: "INVITED";
        currentProfile: "CONTRACTOR" | "EMPLOYEE";
        defaultCurrencyCode: string;
        timezone: string;
        locale: string;
        inactivatedAt: null;
      };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  memberProfilePeriod: {
    create(args: {
      data: {
        memberId: string;
        profile: "CONTRACTOR" | "EMPLOYEE";
        validFrom: Date;
        reason: string;
      };
    }): Promise<unknown>;
  };
  invitation: {
    findFirst(args: {
      where: {
        email: string;
        status: "PENDING";
        expiresAt: { gt: Date };
      };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    create(args: {
      data: {
        email: string;
        firstName: string;
        lastName: string;
        role: "ADMIN" | "MEMBER";
        profile: "CONTRACTOR" | "EMPLOYEE";
        status: "PENDING";
        memberId: string;
        tokenHash: string;
        expiresAt: Date;
        invitedByMemberId: string;
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
        after: Record<string, unknown>;
      };
    }): Promise<unknown>;
  };
};

export type InviteMemberDeps = {
  db?: InviteMemberDb;
  sendEmail?: typeof sendInvitationEmail;
  createToken?: typeof createInvitationToken;
  now?: () => Date;
};

export class InvitationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvitationConflictError";
  }
}

export function normalizeInvitationEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getDisplayName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getAppUrl(inputUrl?: string) {
  return (
    inputUrl ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function buildInvitationAcceptUrl(appUrl: string | undefined, token: string) {
  const url = new URL("/accept-invite", getAppUrl(appUrl));
  url.searchParams.set("token", token);
  return url.toString();
}

export async function inviteMember(input: InviteMemberInput, deps: InviteMemberDeps = {}) {
  const db: InviteMemberDb = deps.db ?? (prisma as unknown as InviteMemberDb);
  const sendEmail = deps.sendEmail ?? sendInvitationEmail;
  const now = deps.now?.() ?? new Date();
  const createToken = deps.createToken ?? createInvitationToken;

  const email = normalizeInvitationEmail(input.email);
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const displayName = getDisplayName(firstName, lastName);
  const role = input.role ?? "MEMBER";
  const defaultCurrencyCode = normalizeCurrencyCode(input.defaultCurrencyCode ?? "EUR");
  const timezone = normalizeTimeZone(input.timezone);
  const locale = normalizeLocale(input.locale);
  const validFrom = input.validFrom ?? now;
  const expiresAt = input.expiresAt ?? addDays(now, 14);
  const token = createToken();
  const tokenHash = hashInvitationToken(token);

  if (!email || !firstName || !lastName || !displayName) {
    throw new InvitationConflictError("Invitation requires email, first name, and last name.");
  }

  if (
    !isSupportedCurrencyCode(defaultCurrencyCode) ||
    !isSupportedTimeZone(timezone) ||
    !isSupportedLocale(locale)
  ) {
    throw new InvitationConflictError(
      "Invitation requires supported currency, timezone, and locale.",
    );
  }

  const result = await db.$transaction(async (tx) => {
    const existingMember = await tx.member.findUnique({
      where: { email },
      select: {
        id: true,
        status: true,
        deletedAt: true,
        authUserId: true,
      },
    });

    if (existingMember && !canInviteExistingMember(existingMember)) {
      throw new InvitationConflictError("A non-invited member already exists for this email.");
    }

    const pendingInvitation = await tx.invitation.findFirst({
      where: {
        email,
        status: "PENDING",
        expiresAt: {
          gt: now,
        },
      },
      select: {
        id: true,
      },
    });

    if (pendingInvitation) {
      throw new InvitationConflictError("A pending invitation already exists for this email.");
    }

    const member = existingMember
      ? await tx.member.update({
          where: {
            id: existingMember.id,
          },
          data: {
            firstName,
            lastName,
            displayName,
            role,
            status: "INVITED",
            currentProfile: input.profile,
            defaultCurrencyCode,
            timezone,
            locale,
            inactivatedAt: null,
          },
          select: {
            id: true,
          },
        })
      : await tx.member.create({
          data: {
            email,
            firstName,
            lastName,
            displayName,
            role,
            status: "INVITED",
            currentProfile: input.profile,
            defaultCurrencyCode,
            timezone,
            locale,
          },
          select: {
            id: true,
          },
        });

    if (!existingMember) {
      await tx.memberProfilePeriod.create({
        data: {
          memberId: member.id,
          profile: input.profile,
          validFrom,
          reason: "Initial invitation",
        },
      });
    }

    const invitation = await tx.invitation.create({
      data: {
        email,
        firstName,
        lastName,
        role,
        profile: input.profile,
        status: "PENDING",
        memberId: member.id,
        tokenHash,
        expiresAt,
        invitedByMemberId: input.invitedByMemberId,
      },
      select: {
        id: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.invitedByMemberId,
        action: "member.invited",
        targetType: "member",
        targetId: member.id,
        after: {
          invitationId: invitation.id,
          email,
          role,
          profile: input.profile,
        },
      },
    });

    return {
      invitationId: invitation.id,
      memberId: member.id,
    };
  });

  const acceptUrl = buildInvitationAcceptUrl(input.appUrl, token);
  await sendEmail({
    email,
    name: displayName,
    acceptUrl,
  });

  return {
    ...result,
    email,
    acceptUrl,
    expiresAt,
  };
}

function canInviteExistingMember(member: {
  status: string;
  deletedAt: Date | null;
  authUserId: string | null;
}) {
  if (member.deletedAt) {
    return false;
  }

  if (member.status === "INVITED") {
    return true;
  }

  return member.status === "INACTIVE" && !member.authUserId;
}
