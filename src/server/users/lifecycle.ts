import { prisma } from "@/src/server/db/client";
import { sendInvitationEmail } from "@/src/server/auth/auth-emails";
import {
  buildInvitationAcceptUrl,
  getDisplayName,
  normalizeInvitationEmail,
} from "@/src/server/users/invitations";
import { createInvitationToken, hashInvitationToken } from "@/src/server/users/invitation-tokens";

export type MemberLifecycleRole = "ADMIN" | "MEMBER";
export type SessionRevocationReason = "admin_revoke" | "member_deactivated";

export type MemberLifecycleInput = {
  memberId: string;
  actorMemberId: string;
};

export type ChangeMemberRoleInput = MemberLifecycleInput & {
  role: MemberLifecycleRole;
};

type MemberLifecycleDb = {
  $transaction<T>(callback: (tx: MemberLifecycleTransaction) => Promise<T>): Promise<T>;
};

type MemberLifecycleTransaction = {
  member: {
    findUnique(args: {
      where: { id: string };
      select: {
        id: true;
        authUserId: true;
        email: true;
        firstName: true;
        lastName: true;
        displayName: true;
        role: true;
        status: true;
        deletedAt: true;
      };
    }): Promise<{
      id: string;
      authUserId: string | null;
      email: string;
      firstName: string;
      lastName: string;
      displayName: string;
      role: MemberLifecycleRole;
      status: string;
      deletedAt: Date | null;
    } | null>;
    update(args: {
      where: { id: string };
      data: Record<string, unknown>;
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  invitation: {
    findFirst(args: {
      where: {
        memberId: string;
        status: "PENDING";
        expiresAt?: { gt: Date };
      };
      select: { id: true };
      orderBy?: { createdAt: "desc" };
    }): Promise<{ id: string } | null>;
    update(args: {
      where: { id: string };
      data: Record<string, unknown>;
      select?: { id: true };
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
  session: {
    deleteMany(args: { where: { userId: string } }): Promise<{ count: number }>;
  };
};

export type MemberLifecycleDeps = {
  db?: MemberLifecycleDb;
  now?: () => Date;
  createToken?: typeof createInvitationToken;
  sendEmail?: typeof sendInvitationEmail;
};

export class MemberLifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemberLifecycleError";
  }
}

export async function resendMemberInvitation(
  input: MemberLifecycleInput,
  deps: MemberLifecycleDeps = {},
) {
  const db: MemberLifecycleDb = deps.db ?? (prisma as unknown as MemberLifecycleDb);
  const sendEmail = deps.sendEmail ?? sendInvitationEmail;
  const createToken = deps.createToken ?? createInvitationToken;
  const now = deps.now?.() ?? new Date();
  const expiresAt = addDays(now, 14);
  const token = createToken();
  const tokenHash = hashInvitationToken(token);

  const result = await db.$transaction(async (tx) => {
    const member = await findMember(tx, input.memberId);

    if (member.deletedAt || member.status !== "INVITED") {
      throw new MemberLifecycleError("Only pending invited members can be resent an invite.");
    }

    const invitation = await tx.invitation.findFirst({
      where: {
        memberId: member.id,
        status: "PENDING",
        expiresAt: {
          gt: now,
        },
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    if (!invitation) {
      throw new MemberLifecycleError("No active pending invitation exists for this member.");
    }

    await tx.invitation.update({
      where: { id: invitation.id },
      data: {
        tokenHash,
        expiresAt,
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "member.invitation_resent",
        targetType: "member",
        targetId: member.id,
        after: {
          invitationId: invitation.id,
          email: member.email,
          expiresAt,
        },
      },
    });

    return {
      invitationId: invitation.id,
      email: normalizeInvitationEmail(member.email),
      name: getDisplayName(member.firstName, member.lastName) || member.displayName,
    };
  });

  await sendEmail({
    email: result.email,
    name: result.name,
    acceptUrl: buildInvitationAcceptUrl(undefined, token),
  });

  return {
    ...result,
    expiresAt,
  };
}

export async function revokeMemberInvitation(
  input: MemberLifecycleInput,
  deps: MemberLifecycleDeps = {},
) {
  const db: MemberLifecycleDb = deps.db ?? (prisma as unknown as MemberLifecycleDb);
  const now = deps.now?.() ?? new Date();

  return db.$transaction(async (tx) => {
    const member = await findMember(tx, input.memberId);

    if (member.deletedAt || member.status !== "INVITED") {
      throw new MemberLifecycleError("Only pending invited members can have invites revoked.");
    }

    const invitation = await tx.invitation.findFirst({
      where: {
        memberId: member.id,
        status: "PENDING",
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    if (!invitation) {
      throw new MemberLifecycleError("No pending invitation exists for this member.");
    }

    await tx.invitation.update({
      where: { id: invitation.id },
      data: {
        status: "REVOKED",
        revokedAt: now,
      },
      select: { id: true },
    });

    await tx.member.update({
      where: { id: member.id },
      data: {
        status: "INACTIVE",
        inactivatedAt: now,
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "member.invitation_revoked",
        targetType: "member",
        targetId: member.id,
        after: {
          invitationId: invitation.id,
          email: member.email,
        },
      },
    });

    return {
      memberId: member.id,
      invitationId: invitation.id,
    };
  });
}

export async function deactivateMember(
  input: MemberLifecycleInput,
  deps: MemberLifecycleDeps = {},
) {
  const db: MemberLifecycleDb = deps.db ?? (prisma as unknown as MemberLifecycleDb);
  const now = deps.now?.() ?? new Date();

  return db.$transaction(async (tx) => {
    const member = await findMember(tx, input.memberId);

    if (member.id === input.actorMemberId) {
      throw new MemberLifecycleError("You cannot deactivate your own account.");
    }

    if (member.deletedAt || member.status !== "ACTIVE") {
      throw new MemberLifecycleError("Only active members can be deactivated.");
    }

    await tx.member.update({
      where: { id: member.id },
      data: {
        status: "INACTIVE",
        inactivatedAt: now,
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "member.deactivated",
        targetType: "member",
        targetId: member.id,
        after: {
          previousStatus: member.status,
          status: "INACTIVE",
        },
      },
    });

    const revokedSessionCount = await revokeAuthSessionsForMember(tx, {
      member,
      actorMemberId: input.actorMemberId,
      reason: "member_deactivated",
    });

    return {
      memberId: member.id,
      revokedSessionCount,
    };
  });
}

export async function revokeMemberSessions(
  input: MemberLifecycleInput,
  deps: MemberLifecycleDeps = {},
) {
  const db: MemberLifecycleDb = deps.db ?? (prisma as unknown as MemberLifecycleDb);

  return db.$transaction(async (tx) => {
    const member = await findMember(tx, input.memberId);

    if (member.id === input.actorMemberId) {
      throw new MemberLifecycleError("You cannot revoke your own sessions here.");
    }

    if (member.deletedAt) {
      throw new MemberLifecycleError("Deleted members cannot be changed.");
    }

    if (!member.authUserId) {
      throw new MemberLifecycleError("This member has no linked auth account.");
    }

    const revokedSessionCount = await revokeAuthSessionsForMember(tx, {
      member,
      actorMemberId: input.actorMemberId,
      reason: "admin_revoke",
    });

    return {
      memberId: member.id,
      revokedSessionCount,
    };
  });
}

export async function reactivateMember(
  input: MemberLifecycleInput,
  deps: MemberLifecycleDeps = {},
) {
  const db: MemberLifecycleDb = deps.db ?? (prisma as unknown as MemberLifecycleDb);

  return db.$transaction(async (tx) => {
    const member = await findMember(tx, input.memberId);

    if (member.deletedAt || member.status !== "INACTIVE") {
      throw new MemberLifecycleError("Only inactive members can be reactivated.");
    }

    if (!member.authUserId) {
      throw new MemberLifecycleError("Members without an auth account need a new invitation.");
    }

    await tx.member.update({
      where: { id: member.id },
      data: {
        status: "ACTIVE",
        inactivatedAt: null,
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "member.reactivated",
        targetType: "member",
        targetId: member.id,
        after: {
          previousStatus: member.status,
          status: "ACTIVE",
        },
      },
    });

    return {
      memberId: member.id,
    };
  });
}

export async function changeMemberRole(
  input: ChangeMemberRoleInput,
  deps: MemberLifecycleDeps = {},
) {
  const db: MemberLifecycleDb = deps.db ?? (prisma as unknown as MemberLifecycleDb);

  return db.$transaction(async (tx) => {
    const member = await findMember(tx, input.memberId);

    if (member.id === input.actorMemberId) {
      throw new MemberLifecycleError("You cannot change your own role.");
    }

    if (member.deletedAt) {
      throw new MemberLifecycleError("Deleted members cannot be changed.");
    }

    await tx.member.update({
      where: { id: member.id },
      data: {
        role: input.role,
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "member.role_changed",
        targetType: "member",
        targetId: member.id,
        after: {
          previousRole: member.role,
          role: input.role,
        },
      },
    });

    return {
      memberId: member.id,
    };
  });
}

async function findMember(tx: MemberLifecycleTransaction, memberId: string) {
  const member = await tx.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      authUserId: true,
      email: true,
      firstName: true,
      lastName: true,
      displayName: true,
      role: true,
      status: true,
      deletedAt: true,
    },
  });

  if (!member) {
    throw new MemberLifecycleError("Member does not exist.");
  }

  return member;
}

async function revokeAuthSessionsForMember(
  tx: MemberLifecycleTransaction,
  input: {
    member: {
      id: string;
      authUserId: string | null;
    };
    actorMemberId: string;
    reason: SessionRevocationReason;
  },
) {
  if (!input.member.authUserId) return 0;

  const result = await tx.session.deleteMany({
    where: {
      userId: input.member.authUserId,
    },
  });

  await tx.auditLog.create({
    data: {
      actorMemberId: input.actorMemberId,
      action: "member.session_revoked",
      targetType: "member",
      targetId: input.member.id,
      after: {
        reason: input.reason,
        revokedSessionCount: result.count,
      },
    },
  });

  return result.count;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
