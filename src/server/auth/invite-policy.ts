import { prisma } from "@/src/server/db/client";

const allowedExistingMemberStatuses = ["ACTIVE", "INVITED"] as const;

type AuthInvitePolicyDb = {
  member: {
    findUnique(args: {
      where: { email: string };
      select: {
        authUserId: true;
        deletedAt: true;
        status: true;
      };
    }): Promise<{
      authUserId: string | null;
      deletedAt: Date | null;
      status: string;
    } | null>;
  };
  invitation: {
    findFirst(args: {
      where: {
        email: string;
        expiresAt: { gt: Date };
        status: "PENDING";
      };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
};

type AuthInvitationSessionPolicyDb = AuthInvitePolicyDb & {
  user: {
    findUnique(args: {
      where: { id: string };
      select: { email: true };
    }): Promise<{ email: string } | null>;
  };
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function canSendAuthLink(email: string, db: AuthInvitePolicyDb = prisma) {
  const normalizedEmail = normalizeEmail(email);

  const member = await db.member.findUnique({
    where: { email: normalizedEmail },
    select: {
      authUserId: true,
      deletedAt: true,
      status: true,
    },
  });

  if (
    member &&
    !member.deletedAt &&
    allowedExistingMemberStatuses.some((status) => status === member.status)
  ) {
    return true;
  }

  const invitation = await findPendingInvitation(db, normalizedEmail);

  return Boolean(invitation);
}

export async function canCreateAuthUser(email: string, db: AuthInvitePolicyDb = prisma) {
  const normalizedEmail = normalizeEmail(email);
  const [member, invitation] = await Promise.all([
    db.member.findUnique({
      where: { email: normalizedEmail },
      select: {
        authUserId: true,
        deletedAt: true,
        status: true,
      },
    }),
    findPendingInvitation(db, normalizedEmail),
  ]);

  return Boolean(
    member && !member.authUserId && !member.deletedAt && member.status === "INVITED" && invitation,
  );
}

export async function canCreateInvitationSession(
  authUserId: string,
  db: AuthInvitationSessionPolicyDb = prisma,
) {
  const authUser = await db.user.findUnique({
    where: { id: authUserId },
    select: { email: true },
  });

  if (!authUser) {
    return false;
  }

  return canCreateAuthUser(authUser.email, db);
}

function findPendingInvitation(db: AuthInvitePolicyDb, email: string) {
  return db.invitation.findFirst({
    where: {
      email,
      expiresAt: {
        gt: new Date(),
      },
      status: "PENDING",
    },
    select: {
      id: true,
    },
  });
}
