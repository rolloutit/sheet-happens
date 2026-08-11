import { describe, expect, it, vi } from "vitest";

import {
  clearPasswordSignInFailures,
  getPasswordSignInLockout,
  hashSignInSubject,
  passwordLockoutPolicy,
  recordFailedPasswordSignIn,
  type PasswordSignInLockoutDeps,
} from "./password-lockout";

type LockoutRecord = {
  subjectHash: string;
  memberId: string | null;
  failedAttemptCount: number;
  failureWindowStartedAt: Date;
  lockedUntil: Date | null;
};

function createLockoutDb(memberId = "member-1") {
  const rows = new Map<string, LockoutRecord>();
  const auditLog = {
    create: vi.fn().mockResolvedValue(undefined),
  };

  const transaction = {
    passwordSignInLockout: {
      findUnique: vi.fn(async ({ where }: { where: { subjectHash: string } }) => {
        return rows.get(where.subjectHash) ?? null;
      }),
      create: vi.fn(async ({ data }: { data: LockoutRecord }) => {
        rows.set(data.subjectHash, data);
        return data;
      }),
      update: vi.fn(
        async ({ where, data }: { where: { subjectHash: string }; data: LockoutRecord }) => {
          const next = { ...rows.get(where.subjectHash), ...data } as LockoutRecord;
          rows.set(where.subjectHash, next);
          return next;
        },
      ),
      delete: vi.fn(async ({ where }: { where: { subjectHash: string } }) => {
        rows.delete(where.subjectHash);
      }),
    },
    member: {
      findUnique: vi.fn().mockResolvedValue(memberId ? { id: memberId } : null),
    },
    auditLog,
  };

  const db = {
    $transaction: async <T>(callback: (tx: typeof transaction) => Promise<T>) =>
      callback(transaction),
  };

  return {
    rows,
    auditLog,
    deps: { db } as unknown as PasswordSignInLockoutDeps,
  };
}

describe("password sign-in lockout", () => {
  const secret = "test-secret";
  const email = "person@example.com";

  it("normalizes email addresses before deriving the stored subject identifier", () => {
    expect(hashSignInSubject(" Person@Example.com ", secret)).toBe(
      hashSignInSubject("person@example.com", secret),
    );
  });

  it("locks password sign-in after five failed attempts and audits the lock", async () => {
    const { deps, auditLog } = createLockoutDb();
    const now = new Date("2026-08-11T12:00:00.000Z");

    for (let attempt = 1; attempt < passwordLockoutPolicy.maxFailedAttempts; attempt += 1) {
      await expect(
        recordFailedPasswordSignIn(email, secret, { ...deps, now: () => now }),
      ).resolves.toMatchObject({ locked: false, lockoutStarted: false });
    }

    await expect(
      recordFailedPasswordSignIn(email, secret, { ...deps, now: () => now }),
    ).resolves.toMatchObject({
      locked: true,
      lockoutStarted: true,
      retryAfterSeconds: passwordLockoutPolicy.lockoutDurationMs / 1000,
    });

    await expect(
      getPasswordSignInLockout(email, secret, { ...deps, now: () => now }),
    ).resolves.toEqual({
      locked: true,
      retryAfterSeconds: passwordLockoutPolicy.lockoutDurationMs / 1000,
    });
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "security.password_lockout",
          targetId: "member-1",
        }),
      }),
    );
  });

  it("starts a new failure window after the old window expires", async () => {
    const { deps, rows } = createLockoutDb();
    const firstAttempt = new Date("2026-08-11T12:00:00.000Z");

    await recordFailedPasswordSignIn(email, secret, { ...deps, now: () => firstAttempt });
    await recordFailedPasswordSignIn(email, secret, {
      ...deps,
      now: () => new Date(firstAttempt.getTime() + passwordLockoutPolicy.failureWindowMs + 1),
    });

    expect(rows.get(hashSignInSubject(email, secret))).toMatchObject({ failedAttemptCount: 1 });
  });

  it("clears an expired lock after successful password authentication and audits recovery", async () => {
    const { deps, auditLog } = createLockoutDb();
    const now = new Date("2026-08-11T12:00:00.000Z");

    for (let attempt = 0; attempt < passwordLockoutPolicy.maxFailedAttempts; attempt += 1) {
      await recordFailedPasswordSignIn(email, secret, { ...deps, now: () => now });
    }

    await clearPasswordSignInFailures(email, secret, {
      ...deps,
      now: () => new Date(now.getTime() + passwordLockoutPolicy.lockoutDurationMs),
    });

    await expect(
      getPasswordSignInLockout(email, secret, {
        ...deps,
        now: () => new Date(now.getTime() + passwordLockoutPolicy.lockoutDurationMs),
      }),
    ).resolves.toEqual({ locked: false, retryAfterSeconds: null });
    expect(auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "security.password_lockout_recovered",
          targetId: "member-1",
        }),
      }),
    );
  });
});
