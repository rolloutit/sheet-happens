import { createHash, randomUUID } from "node:crypto";

import { prisma } from "@/src/server/db/client";

const passkeySecondFactorMarkerPrefix = "sheet-happens-passkey-2fa-session:";

export async function createPasskeySecondFactorSessionMarker(input: {
  userId: string;
  sessionToken: string;
  expiresAt: Date;
}) {
  await prisma.verification.create({
    data: {
      id: randomUUID(),
      identifier: getPasskeySecondFactorMarkerIdentifier(input.sessionToken),
      value: input.userId,
      expiresAt: input.expiresAt,
    },
  });
}

export async function hasPasskeySatisfiedSecondFactor(input: {
  userId: string;
  sessionToken: string;
}) {
  const marker = await prisma.verification.findFirst({
    where: {
      identifier: getPasskeySecondFactorMarkerIdentifier(input.sessionToken),
      value: input.userId,
      expiresAt: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(marker);
}

function getPasskeySecondFactorMarkerIdentifier(sessionToken: string) {
  return `${passkeySecondFactorMarkerPrefix}${createHash("sha256")
    .update(sessionToken)
    .digest("base64url")}`;
}
