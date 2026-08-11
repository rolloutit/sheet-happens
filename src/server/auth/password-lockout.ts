import { createHmac } from "node:crypto";

import { Prisma } from "@/src/server/db/generated/client";
import { prisma } from "@/src/server/db/client";
import { normalizeEmail } from "./invite-policy";

export const passwordLockoutPolicy = {
  maxFailedAttempts: 5,
  failureWindowMs: 15 * 60 * 1000,
  lockoutDurationMs: 15 * 60 * 1000,
} as const;

type PasswordLockoutRecord = {
  subjectHash: string;
  memberId: string | null;
  failedAttemptCount: number;
  failureWindowStartedAt: Date;
  lockedUntil: Date | null;
};

type PasswordLockoutTransaction = {
  passwordSignInLockout: {
    findUnique(args: { where: { subjectHash: string } }): Promise<PasswordLockoutRecord | null>;
    create(args: {
      data: {
        subjectHash: string;
        memberId: string | null;
        failedAttemptCount: number;
        failureWindowStartedAt: Date;
        lockedUntil: Date | null;
      };
    }): Promise<PasswordLockoutRecord>;
    update(args: {
      where: { subjectHash: string };
      data: {
        memberId?: string | null;
        failedAttemptCount: number;
        failureWindowStartedAt: Date;
        lockedUntil: Date | null;
      };
    }): Promise<PasswordLockoutRecord>;
    delete(args: { where: { subjectHash: string } }): Promise<unknown>;
  };
  member: {
    findUnique(args: {
      where: { email: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
  auditLog: {
    create(args: {
      data: {
        actorMemberId: null;
        action: string;
        targetType: string;
        targetId: string;
        after: Record<string, unknown>;
      };
    }): Promise<unknown>;
  };
};

type PasswordLockoutDb = {
  $transaction<T>(
    callback: (tx: PasswordLockoutTransaction) => Promise<T>,
    options?: { isolationLevel: Prisma.TransactionIsolationLevel },
  ): Promise<T>;
};

export type PasswordSignInLockoutDeps = {
  db?: PasswordLockoutDb;
  now?: () => Date;
};

export type PasswordSignInLockoutState = {
  locked: boolean;
  retryAfterSeconds: number | null;
};

export type PasswordSignInFailureResult = PasswordSignInLockoutState & {
  lockoutStarted: boolean;
};

export async function getPasswordSignInLockout(
  email: string,
  secret: string,
  deps: PasswordSignInLockoutDeps = {},
): Promise<PasswordSignInLockoutState> {
  const db = deps.db ?? (prisma as unknown as PasswordLockoutDb);
  const now = deps.now?.() ?? new Date();
  const record = await db.$transaction((tx) =>
    tx.passwordSignInLockout.findUnique({
      where: {
        subjectHash: hashSignInSubject(email, secret),
      },
    }),
  );

  if (!record?.lockedUntil || record.lockedUntil <= now) {
    return { locked: false, retryAfterSeconds: null };
  }

  return {
    locked: true,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((record.lockedUntil.getTime() - now.getTime()) / 1000),
    ),
  };
}

export async function recordFailedPasswordSignIn(
  email: string,
  secret: string,
  deps: PasswordSignInLockoutDeps = {},
): Promise<PasswordSignInFailureResult> {
  const db = deps.db ?? (prisma as unknown as PasswordLockoutDb);
  const now = deps.now?.() ?? new Date();
  const normalizedEmail = normalizeEmail(email);
  const subjectHash = hashSignInSubject(normalizedEmail, secret);

  return runSerializable(db, async (tx) => {
    const [record, member] = await Promise.all([
      tx.passwordSignInLockout.findUnique({ where: { subjectHash } }),
      tx.member.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
    ]);

    if (record?.lockedUntil && record.lockedUntil > now) {
      return {
        locked: true,
        lockoutStarted: false,
        retryAfterSeconds: secondsUntil(record.lockedUntil, now),
      };
    }

    const withinFailureWindow = Boolean(
      record &&
      now.getTime() - record.failureWindowStartedAt.getTime() <=
        passwordLockoutPolicy.failureWindowMs,
    );
    const failedAttemptCount = withinFailureWindow ? (record?.failedAttemptCount ?? 0) + 1 : 1;
    const failureWindowStartedAt = withinFailureWindow ? record!.failureWindowStartedAt : now;
    const lockedUntil =
      failedAttemptCount >= passwordLockoutPolicy.maxFailedAttempts
        ? new Date(now.getTime() + passwordLockoutPolicy.lockoutDurationMs)
        : null;
    const memberId = member?.id ?? record?.memberId ?? null;

    if (record) {
      await tx.passwordSignInLockout.update({
        where: { subjectHash },
        data: {
          memberId,
          failedAttemptCount,
          failureWindowStartedAt,
          lockedUntil,
        },
      });
    } else {
      await tx.passwordSignInLockout.create({
        data: {
          subjectHash,
          memberId,
          failedAttemptCount,
          failureWindowStartedAt,
          lockedUntil,
        },
      });
    }

    if (lockedUntil && memberId) {
      await tx.auditLog.create({
        data: {
          actorMemberId: null,
          action: "security.password_lockout",
          targetType: "member",
          targetId: memberId,
          after: {
            failedAttemptCount,
            lockedUntil: lockedUntil.toISOString(),
          },
        },
      });
    }

    return {
      locked: Boolean(lockedUntil),
      lockoutStarted: Boolean(lockedUntil),
      retryAfterSeconds: lockedUntil ? secondsUntil(lockedUntil, now) : null,
    };
  });
}

export async function clearPasswordSignInFailures(
  email: string,
  secret: string,
  deps: PasswordSignInLockoutDeps = {},
): Promise<void> {
  const db = deps.db ?? (prisma as unknown as PasswordLockoutDb);
  const now = deps.now?.() ?? new Date();
  const subjectHash = hashSignInSubject(email, secret);

  await runSerializable(db, async (tx) => {
    const record = await tx.passwordSignInLockout.findUnique({ where: { subjectHash } });

    if (!record) return;

    await tx.passwordSignInLockout.delete({ where: { subjectHash } });

    if (record.memberId && record.lockedUntil && record.lockedUntil <= now) {
      await tx.auditLog.create({
        data: {
          actorMemberId: null,
          action: "security.password_lockout_recovered",
          targetType: "member",
          targetId: record.memberId,
          after: {
            previousLockedUntil: record.lockedUntil.toISOString(),
          },
        },
      });
    }
  });
}

export function hashSignInSubject(email: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`password-sign-in:${normalizeEmail(email)}`)
    .digest("base64url");
}

async function runSerializable<T>(
  db: PasswordLockoutDb,
  callback: (tx: PasswordLockoutTransaction) => Promise<T>,
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      lastError = error;

      if (!isRetryableLockoutWriteConflict(error) || attempt === 2) {
        throw error;
      }
    }
  }

  throw lastError;
}

function isRetryableLockoutWriteConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (["P2002", "P2034"] as const).includes((error as { code?: unknown }).code as "P2002" | "P2034")
  );
}

function secondsUntil(date: Date, now: Date) {
  return Math.max(1, Math.ceil((date.getTime() - now.getTime()) / 1000));
}
