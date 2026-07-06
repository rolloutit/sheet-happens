import { describe, expect, it, vi } from "vitest";

import {
  MemberProfileTransitionError,
  scheduleMemberProfileTransition,
} from "./profile-transition";

type TestProfilePeriod = {
  id: string;
  profile: "EMPLOYEE" | "CONTRACTOR";
  validFrom: Date;
  validTo: Date | null;
};

const baseMember = {
  id: "member-1",
  currentProfile: "CONTRACTOR" as const,
  status: "ACTIVE",
  deletedAt: null,
};

const basePeriod: TestProfilePeriod = {
  id: "period-1",
  profile: "CONTRACTOR",
  validFrom: new Date("2026-07-01T00:00:00.000Z"),
  validTo: null,
};

function createProfileTransitionDb(
  overrides: {
    member?: typeof baseMember | null;
    periods?: TestProfilePeriod[];
  } = {},
) {
  const tx = {
    member: {
      findUnique: vi.fn().mockResolvedValue(overrides.member ?? baseMember),
      update: vi.fn().mockResolvedValue({ id: "member-1" }),
    },
    memberProfilePeriod: {
      findMany: vi.fn().mockResolvedValue(overrides.periods ?? [basePeriod]),
      update: vi.fn().mockResolvedValue({ id: "period-1" }),
      create: vi.fn().mockResolvedValue({ id: "period-2" }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
  };

  return {
    tx,
    db: {
      $transaction: vi.fn((callback) => callback(tx)),
    },
  };
}

describe("scheduleMemberProfileTransition", () => {
  it("schedules a future profile period without changing the current profile", async () => {
    const { db, tx } = createProfileTransitionDb();

    const result = await scheduleMemberProfileTransition(
      {
        memberId: "member-1",
        actorMemberId: "admin-1",
        profile: "EMPLOYEE",
        validFrom: new Date("2026-08-01T00:00:00.000Z"),
        reason: "Employment contract starts",
      },
      {
        db,
        now: () => new Date("2026-07-06T12:00:00.000Z"),
      },
    );

    expect(tx.memberProfilePeriod.update).toHaveBeenCalledWith({
      where: {
        id: "period-1",
      },
      data: {
        validTo: new Date("2026-08-01T00:00:00.000Z"),
      },
      select: {
        id: true,
      },
    });
    expect(tx.memberProfilePeriod.create).toHaveBeenCalledWith({
      data: {
        memberId: "member-1",
        profile: "EMPLOYEE",
        validFrom: new Date("2026-08-01T00:00:00.000Z"),
        validTo: null,
        reason: "Employment contract starts",
      },
      select: {
        id: true,
      },
    });
    expect(tx.member.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "member.profile_transition_scheduled",
          after: expect.objectContaining({
            currentProfileUpdated: false,
            profile: "EMPLOYEE",
            validFrom: "2026-08-01",
          }),
        }),
      }),
    );
    expect(result).toEqual({
      memberId: "member-1",
      profile: "EMPLOYEE",
      validFrom: "2026-08-01",
      immediate: false,
    });
  });

  it("applies same-day transitions to the current member profile", async () => {
    const { db, tx } = createProfileTransitionDb();

    const result = await scheduleMemberProfileTransition(
      {
        memberId: "member-1",
        actorMemberId: "admin-1",
        profile: "EMPLOYEE",
        validFrom: new Date("2026-07-06T00:00:00.000Z"),
      },
      {
        db,
        now: () => new Date("2026-07-06T12:00:00.000Z"),
      },
    );

    expect(tx.memberProfilePeriod.update).toHaveBeenCalledWith({
      where: {
        id: "period-1",
      },
      data: {
        validTo: new Date("2026-07-06T00:00:00.000Z"),
      },
      select: {
        id: true,
      },
    });
    expect(tx.memberProfilePeriod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          profile: "EMPLOYEE",
          validFrom: new Date("2026-07-06T00:00:00.000Z"),
        }),
      }),
    );
    expect(tx.member.update).toHaveBeenCalledWith({
      where: {
        id: "member-1",
      },
      data: {
        currentProfile: "EMPLOYEE",
      },
      select: {
        id: true,
      },
    });
    expect(result.immediate).toBe(true);
  });

  it("updates a same-day initial period instead of creating a zero-length period", async () => {
    const { db, tx } = createProfileTransitionDb({
      periods: [
        {
          ...basePeriod,
          validFrom: new Date("2026-07-06T00:00:00.000Z"),
        },
      ],
    });

    await scheduleMemberProfileTransition(
      {
        memberId: "member-1",
        actorMemberId: "admin-1",
        profile: "EMPLOYEE",
        validFrom: new Date("2026-07-06T00:00:00.000Z"),
      },
      {
        db,
        now: () => new Date("2026-07-06T12:00:00.000Z"),
      },
    );

    expect(tx.memberProfilePeriod.update).toHaveBeenCalledWith({
      where: {
        id: "period-1",
      },
      data: {
        profile: "EMPLOYEE",
        reason: null,
      },
      select: {
        id: true,
      },
    });
    expect(tx.memberProfilePeriod.create).not.toHaveBeenCalled();
    expect(tx.member.update).toHaveBeenCalled();
  });

  it("rejects past transitions and duplicate future transitions", async () => {
    const { db } = createProfileTransitionDb();

    await expect(
      scheduleMemberProfileTransition(
        {
          memberId: "member-1",
          actorMemberId: "admin-1",
          profile: "EMPLOYEE",
          validFrom: new Date("2026-07-05T00:00:00.000Z"),
        },
        {
          db,
          now: () => new Date("2026-07-06T12:00:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(MemberProfileTransitionError);

    const { db: futureDb } = createProfileTransitionDb({
      periods: [
        {
          ...basePeriod,
          validTo: new Date("2026-08-01T00:00:00.000Z"),
        },
        {
          id: "period-2",
          profile: "EMPLOYEE",
          validFrom: new Date("2026-08-01T00:00:00.000Z"),
          validTo: null,
        },
      ],
    });

    await expect(
      scheduleMemberProfileTransition(
        {
          memberId: "member-1",
          actorMemberId: "admin-1",
          profile: "EMPLOYEE",
          validFrom: new Date("2026-09-01T00:00:00.000Z"),
        },
        {
          db: futureDb,
          now: () => new Date("2026-07-06T12:00:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(MemberProfileTransitionError);
  });
});
