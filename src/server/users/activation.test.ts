import { describe, expect, it, vi } from "vitest";

import {
  activateInvitation,
  getInvitationAcceptanceDetails,
  InvitationActivationError,
} from "./activation";
import { hashInvitationToken } from "./invitation-tokens";

function createInvitationAcceptanceDb(
  invitation: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    tokenHash: string;
    status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
    expiresAt: Date;
  } | null,
) {
  return {
    invitation: {
      findUnique: vi.fn().mockResolvedValue(invitation),
    },
  };
}

function createActivationDb(
  invitation: Awaited<ReturnType<typeof createInvitationRecord>> | null,
  overrides: {
    authUser?: { id: string; email: string } | null;
    linkedMember?: { id: string } | null;
  } = {},
) {
  const tx = {
    invitation: {
      findUnique: vi.fn().mockResolvedValue(invitation),
      update: vi.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue(overrides.authUser ?? { id: "auth-user-1", email: "user@example.com" }),
    },
    member: {
      findUnique: vi.fn().mockResolvedValue(overrides.linkedMember ?? null),
      update: vi.fn().mockResolvedValue({ id: "member-1" }),
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

function createInvitationRecord(token = "invite-token") {
  return {
    id: "invitation-1",
    email: "user@example.com",
    tokenHash: hashInvitationToken(token),
    status: "PENDING",
    expiresAt: new Date("2026-07-10T00:00:00.000Z"),
    memberId: "member-1",
    member: {
      id: "member-1",
      status: "INVITED",
      deletedAt: null,
      authUserId: null,
    },
  };
}

describe("activateInvitation", () => {
  it("links the auth user, activates the member, accepts the invitation, and audits", async () => {
    const { db, tx } = createActivationDb(createInvitationRecord());
    const now = new Date("2026-07-02T00:00:00.000Z");

    const result = await activateInvitation(
      {
        token: "invite-token",
        authUserId: "auth-user-1",
        actorIpAddress: "127.0.0.1",
        actorUserAgent: "vitest",
      },
      {
        db,
        now: () => now,
      },
    );

    expect(tx.member.update).toHaveBeenCalledWith({
      where: { id: "member-1" },
      data: {
        authUserId: "auth-user-1",
        status: "ACTIVE",
        activatedAt: now,
      },
      select: { id: true },
    });
    expect(tx.invitation.update).toHaveBeenCalledWith({
      where: { id: "invitation-1" },
      data: {
        status: "ACCEPTED",
        acceptedAt: now,
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "member.activated",
          actorMemberId: "member-1",
          targetId: "member-1",
        }),
      }),
    );
    expect(result).toEqual({
      invitationId: "invitation-1",
      memberId: "member-1",
    });
  });

  it("rejects expired invitations", async () => {
    const invitation = {
      ...createInvitationRecord(),
      expiresAt: new Date("2026-07-01T00:00:00.000Z"),
    };
    const { db } = createActivationDb(invitation);

    await expect(
      activateInvitation(
        {
          token: "invite-token",
          authUserId: "auth-user-1",
        },
        {
          db,
          now: () => new Date("2026-07-02T00:00:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(InvitationActivationError);
  });

  it("rejects auth users with an email mismatch", async () => {
    const { db } = createActivationDb(createInvitationRecord(), {
      authUser: { id: "auth-user-1", email: "other@example.com" },
    });

    await expect(
      activateInvitation(
        {
          token: "invite-token",
          authUserId: "auth-user-1",
        },
        {
          db,
          now: () => new Date("2026-07-02T00:00:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(InvitationActivationError);
  });

  it("rejects an auth user linked to a different member", async () => {
    const { db } = createActivationDb(createInvitationRecord(), {
      linkedMember: { id: "other-member" },
    });

    await expect(
      activateInvitation(
        {
          token: "invite-token",
          authUserId: "auth-user-1",
        },
        {
          db,
          now: () => new Date("2026-07-02T00:00:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(InvitationActivationError);
  });
});

describe("getInvitationAcceptanceDetails", () => {
  it("returns public invitation details for a valid pending token", async () => {
    const db = createInvitationAcceptanceDb({
      id: "invitation-1",
      email: "user@example.com",
      firstName: "User",
      lastName: "Example",
      tokenHash: hashInvitationToken("invite-token"),
      status: "PENDING",
      expiresAt: new Date("2026-07-10T00:00:00.000Z"),
    });

    await expect(
      getInvitationAcceptanceDetails("invite-token", {
        db,
        now: () => new Date("2026-07-02T00:00:00.000Z"),
      }),
    ).resolves.toEqual({
      id: "invitation-1",
      email: "user@example.com",
      name: "User Example",
      status: "PENDING",
      expiresAt: new Date("2026-07-10T00:00:00.000Z"),
      expired: false,
      available: true,
    });
  });

  it("returns null for an invalid token", async () => {
    const db = createInvitationAcceptanceDb(null);

    await expect(getInvitationAcceptanceDetails("bad-token", { db })).resolves.toBeNull();
  });

  it("marks expired invitations unavailable", async () => {
    const db = createInvitationAcceptanceDb({
      id: "invitation-1",
      email: "user@example.com",
      firstName: "User",
      lastName: "Example",
      tokenHash: hashInvitationToken("invite-token"),
      status: "PENDING",
      expiresAt: new Date("2026-07-01T00:00:00.000Z"),
    });

    await expect(
      getInvitationAcceptanceDetails("invite-token", {
        db,
        now: () => new Date("2026-07-02T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      expired: true,
      available: false,
    });
  });
});
