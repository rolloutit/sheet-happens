import { describe, expect, it, vi } from "vitest";

import { inviteMember, InvitationConflictError } from "./invitations";

function createInviteDb(
  overrides: {
    existingMember?: {
      id: string;
      status: string;
      deletedAt: Date | null;
      authUserId: string | null;
    } | null;
    pendingInvitation?: { id: string } | null;
  } = {},
) {
  const tx = {
    member: {
      findUnique: vi.fn().mockResolvedValue(overrides.existingMember ?? null),
      create: vi.fn().mockResolvedValue({ id: "member-1" }),
      update: vi.fn().mockResolvedValue({ id: "member-existing" }),
    },
    memberProfilePeriod: {
      create: vi.fn().mockResolvedValue({ id: "profile-period-1" }),
    },
    invitation: {
      findFirst: vi.fn().mockResolvedValue(overrides.pendingInvitation ?? null),
      create: vi.fn().mockResolvedValue({ id: "invitation-1" }),
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

describe("inviteMember", () => {
  it("creates an invited member, profile period, invitation, audit log, and email", async () => {
    const { db, tx } = createInviteDb();
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    const now = new Date("2026-07-02T00:00:00.000Z");

    const result = await inviteMember(
      {
        email: " Contractor@Example.COM ",
        firstName: "Zoe",
        lastName: "Contractor",
        profile: "CONTRACTOR",
        timezone: "Europe/Budapest",
        locale: "en",
        invitedByMemberId: "admin-1",
        appUrl: "https://sheet.example.com",
      },
      {
        db,
        sendEmail,
        createToken: () => "token-1",
        now: () => now,
      },
    );

    expect(tx.member.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "contractor@example.com",
          status: "INVITED",
          currentProfile: "CONTRACTOR",
        }),
      }),
    );
    expect(tx.memberProfilePeriod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          memberId: "member-1",
          profile: "CONTRACTOR",
        }),
      }),
    );
    expect(tx.invitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "contractor@example.com",
          memberId: "member-1",
          expiresAt: new Date("2026-07-05T00:00:00.000Z"),
          status: "PENDING",
        }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "member.invited",
          actorMemberId: "admin-1",
          targetId: "member-1",
        }),
      }),
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "contractor@example.com",
        name: "Zoe Contractor",
        acceptUrl: "https://sheet.example.com/accept-invite?token=token-1",
      }),
    );
    expect(result).toMatchObject({
      invitationId: "invitation-1",
      memberId: "member-1",
      email: "contractor@example.com",
      expiresAt: new Date("2026-07-05T00:00:00.000Z"),
    });
  });

  it("does not create a new member when re-inviting an invited member after an expired invite", async () => {
    const { db, tx } = createInviteDb({
      existingMember: {
        id: "member-existing",
        status: "INVITED",
        deletedAt: null,
        authUserId: null,
      },
    });

    await inviteMember(
      {
        email: "invited@example.com",
        firstName: "Existing",
        lastName: "Invite",
        profile: "EMPLOYEE",
        timezone: "Europe/Budapest",
        locale: "en",
        invitedByMemberId: "admin-1",
      },
      {
        db,
        sendEmail: vi.fn().mockResolvedValue(undefined),
        createToken: () => "token-2",
        now: () => new Date("2026-07-02T00:00:00.000Z"),
      },
    );

    expect(tx.member.create).not.toHaveBeenCalled();
    expect(tx.member.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "member-existing",
        },
        data: expect.objectContaining({
          status: "INVITED",
        }),
      }),
    );
    expect(tx.memberProfilePeriod.create).not.toHaveBeenCalled();
    expect(tx.invitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          memberId: "member-existing",
        }),
      }),
    );
  });

  it("rejects invitations for existing non-invited members", async () => {
    const { db } = createInviteDb({
      existingMember: {
        id: "member-active",
        status: "ACTIVE",
        deletedAt: null,
        authUserId: "auth-user-1",
      },
    });

    await expect(
      inviteMember(
        {
          email: "active@example.com",
          firstName: "Active",
          lastName: "Member",
          profile: "EMPLOYEE",
          timezone: "Europe/Budapest",
          locale: "en",
          invitedByMemberId: "admin-1",
        },
        {
          db,
          sendEmail: vi.fn().mockResolvedValue(undefined),
        },
      ),
    ).rejects.toBeInstanceOf(InvitationConflictError);
  });

  it("rejects duplicate pending invitations", async () => {
    const { db } = createInviteDb({
      pendingInvitation: { id: "pending-invitation" },
    });

    await expect(
      inviteMember(
        {
          email: "pending@example.com",
          firstName: "Pending",
          lastName: "Invite",
          profile: "EMPLOYEE",
          timezone: "Europe/Budapest",
          locale: "en",
          invitedByMemberId: "admin-1",
        },
        {
          db,
          sendEmail: vi.fn().mockResolvedValue(undefined),
        },
      ),
    ).rejects.toBeInstanceOf(InvitationConflictError);
  });

  it("rejects unsupported member preference values", async () => {
    const { db } = createInviteDb();
    const sendEmail = vi.fn().mockResolvedValue(undefined);

    await expect(
      inviteMember(
        {
          email: "contractor@example.com",
          firstName: "Invalid",
          lastName: "Preferences",
          profile: "CONTRACTOR",
          defaultCurrencyCode: "ZZZ",
          timezone: "Europe/Budapest",
          locale: "en",
          invitedByMemberId: "admin-1",
        },
        {
          db,
          sendEmail,
        },
      ),
    ).rejects.toBeInstanceOf(InvitationConflictError);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
