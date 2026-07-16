"use server";

import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

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
  const t = await getTranslations("TwoFactorActions");
  const normalizedCode = normalizeCode(input);

  if (!normalizedCode) {
    return {
      status: "error",
      message: input.method === "totp" ? t("errors.enterTotp") : t("errors.enterBackupCode"),
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
        message: t("errors.missingUser"),
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
        message: t("errors.missingSession"),
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
      message: t("success.verified"),
    };
  } catch (error) {
    return {
      status: "error",
      message: getSecondFactorErrorMessage(error, t),
    };
  }
}

export async function clearSecondFactorAction(): Promise<VerifySecondFactorActionState> {
  const t = await getTranslations("TwoFactorActions");
  await clearSecondFactorCookie();

  return {
    status: "success",
    message: t("success.cleared"),
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

function getSecondFactorErrorMessage(
  error: unknown,
  t: Awaited<ReturnType<typeof getTranslations>>,
) {
  const maybeError = error as { message?: string; body?: { code?: string; message?: string } };
  const code = maybeError.body?.code;

  if (code === "INVALID_CODE" || code === "INVALID_BACKUP_CODE") {
    return t("errors.invalidCode");
  }

  if (code === "ACCOUNT_TEMPORARILY_LOCKED" || code === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE") {
    return t("errors.tooManyAttempts");
  }

  if (code === "INVALID_TWO_FACTOR_COOKIE") {
    return t("errors.expiredChallenge");
  }

  return maybeError.body?.message ?? maybeError.message ?? t("errors.verifyFailed");
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
