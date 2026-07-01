import { prisma } from "@/src/server/db/client";

const allowedExistingMemberStatuses = ["ACTIVE", "INVITED"] as const;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function canSendAuthLink(email: string) {
  const normalizedEmail = normalizeEmail(email);

  const member = await prisma.member.findUnique({
    where: { email: normalizedEmail },
    select: {
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

  const invitation = await prisma.invitation.findFirst({
    where: {
      email: normalizedEmail,
      expiresAt: {
        gt: new Date(),
      },
      status: "PENDING",
    },
    select: {
      id: true,
    },
  });

  return Boolean(invitation);
}
