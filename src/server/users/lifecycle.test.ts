import { describe, expect, it, vi } from "vitest";

import {
  changeMemberRole,
  deactivateMember,
  MemberLifecycleError,
  reactivateMember,
  resendMemberInvitation,
  revokeMemberInvitation,
} from "./lifecycle";

type TestMember = {
  id: string;
  authUserId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  role: "ADMIN" | "MEMBER";
  status: string;
  deletedAt: Date | null;
};

const baseMember: TestMember = {
  id: "member-1",
  authUserId: "auth-user-1",
  email: "member@example.com",
  firstName: "Member",
  lastName: "Example",
  displayName: "Member Example",
  role: "MEMBER" as const,
  status: "ACTIVE",
  deletedAt: null,
};

function createLifecycleDb(
  overrides: {
    member?: TestMember | null;
    invitation?: { id: string } | null;
  } = {},
) {
  const tx = {
    member: {
      findUnique: vi.fn().mockResolvedValue(overrides.member ?? baseMember),
      update: vi.fn().mockResolvedValue({ id: "member-1" }),
    },
    invitation: {
      findFirst: vi.fn().mockResolvedValue(overrides.invitation ?? { id: "invitation-1" }),
      update: vi.fn().mockResolvedValue({ id: "invitation-1" }),
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

describe("member lifecycle services", () => {
  it("resends a pending invitation with a rotated token", async () => {
    const invitedMember = {
      ...baseMember,
      authUserId: null,
      status: "INVITED",
    };
    const { db, tx } = createLifecycleDb({ member: invitedMember });
    const sendEmail = vi.fn().mockResolvedValue(undefined);

    await resendMemberInvitation(
      {
        memberId: "member-1",
        actorMemberId: "admin-1",
      },
      {
        db,
        sendEmail,
        createToken: () => "new-token",
        now: () => new Date("2026-07-05T00:00:00.000Z"),
      },
    );

    expect(tx.invitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "invitation-1" },
        data: expect.objectContaining({
          tokenHash: expect.any(String),
        }),
      }),
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "member@example.com",
        acceptUrl: "http://localhost:3000/accept-invite?token=new-token",
      }),
    );
  });

  it("revokes a pending invitation and inactivates the unaccepted member", async () => {
    const { db, tx } = createLifecycleDb({
      member: {
        ...baseMember,
        authUserId: null,
        status: "INVITED",
      },
    });
    const now = new Date("2026-07-05T00:00:00.000Z");

    await revokeMemberInvitation(
      {
        memberId: "member-1",
        actorMemberId: "admin-1",
      },
      {
        db,
        now: () => now,
      },
    );

    expect(tx.invitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: "REVOKED",
          revokedAt: now,
        },
      }),
    );
    expect(tx.member.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: "INACTIVE",
          inactivatedAt: now,
        },
      }),
    );
  });

  it("deactivates active members but rejects self-deactivation", async () => {
    const { db, tx } = createLifecycleDb();

    await deactivateMember(
      {
        memberId: "member-1",
        actorMemberId: "admin-1",
      },
      { db },
    );

    expect(tx.member.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "INACTIVE",
        }),
      }),
    );

    await expect(
      deactivateMember(
        {
          memberId: "member-1",
          actorMemberId: "member-1",
        },
        { db },
      ),
    ).rejects.toBeInstanceOf(MemberLifecycleError);
  });

  it("reactivates inactive members with linked auth users", async () => {
    const { db, tx } = createLifecycleDb({
      member: {
        ...baseMember,
        status: "INACTIVE",
      },
    });

    await reactivateMember(
      {
        memberId: "member-1",
        actorMemberId: "admin-1",
      },
      { db },
    );

    expect(tx.member.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: "ACTIVE",
          inactivatedAt: null,
        },
      }),
    );
  });

  it("changes roles but rejects self role changes", async () => {
    const { db, tx } = createLifecycleDb();

    await changeMemberRole(
      {
        memberId: "member-1",
        actorMemberId: "admin-1",
        role: "ADMIN",
      },
      { db },
    );

    expect(tx.member.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          role: "ADMIN",
        },
      }),
    );

    await expect(
      changeMemberRole(
        {
          memberId: "member-1",
          actorMemberId: "member-1",
          role: "ADMIN",
        },
        { db },
      ),
    ).rejects.toBeInstanceOf(MemberLifecycleError);
  });
});
