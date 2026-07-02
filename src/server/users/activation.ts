import { prisma } from "@/src/server/db/client";
import { hashInvitationToken, verifyInvitationToken } from "@/src/server/users/invitation-tokens";

export type ActivateInvitationInput = {
  token: string;
  authUserId: string;
  actorIpAddress?: string;
  actorUserAgent?: string;
};

type ActivateInvitationDb = {
  $transaction<T>(callback: (tx: ActivateInvitationTransaction) => Promise<T>): Promise<T>;
};

type ActivateInvitationTransaction = {
  invitation: {
    findUnique(args: { where: { tokenHash: string }; include: { member: true } }): Promise<{
      id: string;
      email: string;
      tokenHash: string;
      status: string;
      expiresAt: Date;
      memberId: string | null;
      member: {
        id: string;
        status: string;
        deletedAt: Date | null;
        authUserId: string | null;
      } | null;
    } | null>;
    update(args: {
      where: { id: string };
      data: {
        status: "ACCEPTED";
        acceptedAt: Date;
      };
    }): Promise<unknown>;
  };
  user: {
    findUnique(args: {
      where: { id: string };
      select: { id: true; email: true };
    }): Promise<{ id: string; email: string } | null>;
  };
  member: {
    findUnique(args: {
      where: { authUserId: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    update(args: {
      where: { id: string };
      data: {
        authUserId: string;
        status: "ACTIVE";
        activatedAt: Date;
      };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  auditLog: {
    create(args: {
      data: {
        actorMemberId: string | null;
        action: string;
        targetType: string;
        targetId: string;
        after: Record<string, unknown>;
        ipAddress?: string;
        userAgent?: string;
      };
    }): Promise<unknown>;
  };
};

export type ActivateInvitationDeps = {
  db?: ActivateInvitationDb;
  now?: () => Date;
};

export class InvitationActivationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvitationActivationError";
  }
}

export async function activateInvitation(
  input: ActivateInvitationInput,
  deps: ActivateInvitationDeps = {},
) {
  const db: ActivateInvitationDb = deps.db ?? (prisma as unknown as ActivateInvitationDb);
  const now = deps.now?.() ?? new Date();
  const tokenHash = hashInvitationToken(input.token);

  return db.$transaction(async (tx) => {
    const invitation = await tx.invitation.findUnique({
      where: { tokenHash },
      include: { member: true },
    });

    if (!invitation || !verifyInvitationToken(input.token, invitation.tokenHash)) {
      throw new InvitationActivationError("Invitation token is invalid.");
    }

    if (invitation.status !== "PENDING") {
      throw new InvitationActivationError("Invitation is not pending.");
    }

    if (invitation.expiresAt <= now) {
      throw new InvitationActivationError("Invitation has expired.");
    }

    if (!invitation.memberId || !invitation.member) {
      throw new InvitationActivationError("Invitation is not linked to a member.");
    }

    if (invitation.member.deletedAt || invitation.member.status !== "INVITED") {
      throw new InvitationActivationError("Member cannot be activated from this invitation.");
    }

    if (invitation.member.authUserId && invitation.member.authUserId !== input.authUserId) {
      throw new InvitationActivationError("Member is already linked to another auth user.");
    }

    const authUser = await tx.user.findUnique({
      where: { id: input.authUserId },
      select: {
        id: true,
        email: true,
      },
    });

    if (!authUser) {
      throw new InvitationActivationError("Auth user does not exist.");
    }

    if (authUser.email.trim().toLowerCase() !== invitation.email.trim().toLowerCase()) {
      throw new InvitationActivationError("Auth user email does not match invitation email.");
    }

    const linkedMember = await tx.member.findUnique({
      where: { authUserId: input.authUserId },
      select: {
        id: true,
      },
    });

    if (linkedMember && linkedMember.id !== invitation.member.id) {
      throw new InvitationActivationError("Auth user is already linked to another member.");
    }

    const member = await tx.member.update({
      where: {
        id: invitation.member.id,
      },
      data: {
        authUserId: input.authUserId,
        status: "ACTIVE",
        activatedAt: now,
      },
      select: {
        id: true,
      },
    });

    await tx.invitation.update({
      where: {
        id: invitation.id,
      },
      data: {
        status: "ACCEPTED",
        acceptedAt: now,
      },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: member.id,
        action: "member.activated",
        targetType: "member",
        targetId: member.id,
        after: {
          invitationId: invitation.id,
          authUserId: input.authUserId,
        },
        ipAddress: input.actorIpAddress,
        userAgent: input.actorUserAgent,
      },
    });

    return {
      memberId: member.id,
      invitationId: invitation.id,
    };
  });
}
