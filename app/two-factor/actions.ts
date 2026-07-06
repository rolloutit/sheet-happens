"use server";

import { headers } from "next/headers";

import { auth } from "@/src/server/auth/auth";
import { clearSecondFactorCookie, setSecondFactorCookie } from "@/src/server/auth/second-factor";
import { prisma } from "@/src/server/db/client";
import type { VerifySecondFactorActionInput, VerifySecondFactorActionState } from "./actions.types";

type VerificationResult = {
  token?: string;
  user?: {
    id?: string;
  };
};

export async function verifySecondFactorAction(
  input: VerifySecondFactorActionInput,
): Promise<VerifySecondFactorActionState> {
  const normalizedCode = normalizeCode(input);

  if (!normalizedCode) {
    return {
      status: "error",
      message:
        input.method === "totp" ? "Enter the 6 digit authenticator code." : "Enter a backup code.",
    };
  }

  try {
    const requestHeaders = await headers();
    const existingSession = await auth.api
      .getSession({
        headers: requestHeaders,
      })
      .catch(() => null);
    const setupSessionUserId = existingSession?.user.id;
    const wasTotpEnabled = Boolean(
      (existingSession?.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled,
    );
    const verificationStartedAt = new Date(Date.now() - 1000);
    const result =
      input.method === "totp"
        ? await auth.api.verifyTOTP({
            headers: requestHeaders,
            body: {
              code: normalizedCode,
              trustDevice: input.trustDevice,
            },
          })
        : await auth.api.verifyBackupCode({
            headers: requestHeaders,
            body: {
              code: normalizedCode,
              trustDevice: input.trustDevice,
            },
          });
    const normalizedResult = normalizeVerificationResult(result);

    if (!normalizedResult.userId) {
      return {
        status: "error",
        message: "Second-factor verification did not return an authenticated user.",
      };
    }

    const sessionToken = await resolveVerifiedSessionToken({
      userId: normalizedResult.userId,
      candidateToken: normalizedResult.token,
      previousSessionToken: existingSession?.session.token,
      verificationStartedAt,
    });

    if (!sessionToken) {
      return {
        status: "error",
        message: "Second-factor verification did not return an active session.",
      };
    }

    await setSecondFactorCookie({
      userId: normalizedResult.userId,
      sessionToken,
      trustDevice: input.trustDevice,
    });

    if (
      input.method === "totp" &&
      setupSessionUserId &&
      normalizedResult.userId === setupSessionUserId &&
      !wasTotpEnabled
    ) {
      await auditTotpEnabled({
        userId: normalizedResult.userId,
        requestHeaders,
      });
    }

    return {
      status: "success",
      message: "Second factor verified.",
    };
  } catch (error) {
    return {
      status: "error",
      message: getSecondFactorErrorMessage(error),
    };
  }
}

export async function clearSecondFactorAction(): Promise<VerifySecondFactorActionState> {
  await clearSecondFactorCookie();

  return {
    status: "success",
    message: "Second-factor state cleared.",
  };
}

function normalizeCode(input: VerifySecondFactorActionInput) {
  if (input.method === "totp") {
    const code = input.code.replace(/\D/g, "").slice(0, 6);
    return code.length === 6 ? code : "";
  }

  return input.code.trim();
}

function normalizeVerificationResult(result: unknown) {
  const verificationResult = result as VerificationResult;

  return {
    token: verificationResult.token,
    userId: verificationResult.user?.id,
  };
}

async function resolveVerifiedSessionToken(input: {
  userId: string;
  candidateToken?: string;
  previousSessionToken?: string;
  verificationStartedAt: Date;
}) {
  if (input.candidateToken) {
    const candidateSession = await prisma.session.findUnique({
      where: {
        token: input.candidateToken,
      },
      select: {
        token: true,
        userId: true,
      },
    });

    if (candidateSession?.userId === input.userId) {
      return candidateSession.token;
    }
  }

  const createdSession = await prisma.session.findFirst({
    where: {
      userId: input.userId,
      createdAt: {
        gte: input.verificationStartedAt,
      },
      ...(input.previousSessionToken
        ? {
            token: {
              not: input.previousSessionToken,
            },
          }
        : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      token: true,
    },
  });

  return createdSession?.token ?? null;
}

function getSecondFactorErrorMessage(error: unknown) {
  const maybeError = error as { message?: string; body?: { code?: string; message?: string } };
  const code = maybeError.body?.code;

  if (code === "INVALID_CODE" || code === "INVALID_BACKUP_CODE") {
    return "The code is invalid. Try again.";
  }

  if (code === "ACCOUNT_TEMPORARILY_LOCKED" || code === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE") {
    return "Too many failed attempts. Try again later.";
  }

  if (code === "INVALID_TWO_FACTOR_COOKIE") {
    return "This second-factor challenge expired. Start sign-in again.";
  }

  return maybeError.body?.message ?? maybeError.message ?? "Could not verify the second factor.";
}

async function auditTotpEnabled(input: { userId: string; requestHeaders: Headers }) {
  const member = await prisma.member.findUnique({
    where: {
      authUserId: input.userId,
    },
    select: {
      id: true,
    },
  });

  if (!member) return;

  await prisma.auditLog.create({
    data: {
      actorMemberId: member.id,
      action: "security.totp_enabled",
      targetType: "member",
      targetId: member.id,
      after: {
        authUserId: input.userId,
      },
      ipAddress: input.requestHeaders.get("x-forwarded-for"),
      userAgent: input.requestHeaders.get("user-agent"),
    },
  });
}
