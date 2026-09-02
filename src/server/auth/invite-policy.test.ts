import { describe, expect, it, vi } from "vitest";

import { canCreateAuthUser, canCreateInvitationSession, canSendAuthLink } from "./invite-policy";

type TestMember = {
  authUserId: string | null;
  deletedAt: Date | null;
  status: string;
} | null;

type TestInvitation = {
  id: string;
} | null;

function createInvitePolicyDb(input: { member?: TestMember; invitation?: TestInvitation } = {}) {
  return {
    member: {
      findUnique: vi.fn().mockResolvedValue(input.member ?? null),
    },
    invitation: {
      findFirst: vi.fn().mockResolvedValue(input.invitation ?? null),
    },
  };
}

function createInvitationSessionPolicyDb(
  input: {
    authUser?: { email: string } | null;
    member?: TestMember;
    invitation?: TestInvitation;
  } = {},
) {
  return {
    ...createInvitePolicyDb(input),
    user: {
      findUnique: vi.fn().mockResolvedValue(input.authUser ?? null),
    },
  };
}

describe("invite auth policy", () => {
  it("allows auth links for active and invited members", async () => {
    const activeDb = createInvitePolicyDb({
      member: {
        authUserId: "auth-user-1",
        deletedAt: null,
        status: "ACTIVE",
      },
    });
    const invitedDb = createInvitePolicyDb({
      member: {
        authUserId: null,
        deletedAt: null,
        status: "INVITED",
      },
    });

    await expect(canSendAuthLink("ACTIVE@example.com", activeDb)).resolves.toBe(true);
    await expect(canSendAuthLink("INVITED@example.com", invitedDb)).resolves.toBe(true);
  });

  it("keeps magic-link responses neutral but sends no link for unknown emails", async () => {
    const db = createInvitePolicyDb();

    await expect(canSendAuthLink("unknown@example.com", db)).resolves.toBe(false);
  });

  it("allows auth user creation only for invited members with pending invitations", async () => {
    const db = createInvitePolicyDb({
      member: {
        authUserId: null,
        deletedAt: null,
        status: "INVITED",
      },
      invitation: {
        id: "invitation-1",
      },
    });

    await expect(canCreateAuthUser("invited@example.com", db)).resolves.toBe(true);
  });

  it("blocks auth user creation for active, linked, deleted, or uninvited emails", async () => {
    const pendingInvitation = { id: "invitation-1" };
    const cases = [
      {
        member: {
          authUserId: "auth-user-1",
          deletedAt: null,
          status: "INVITED",
        },
        invitation: pendingInvitation,
      },
      {
        member: {
          authUserId: null,
          deletedAt: null,
          status: "ACTIVE",
        },
        invitation: pendingInvitation,
      },
      {
        member: {
          authUserId: null,
          deletedAt: new Date("2026-07-01T00:00:00.000Z"),
          status: "INVITED",
        },
        invitation: pendingInvitation,
      },
      {
        member: {
          authUserId: null,
          deletedAt: null,
          status: "INVITED",
        },
        invitation: null,
      },
      {
        member: null,
        invitation: pendingInvitation,
      },
    ];

    for (const testCase of cases) {
      await expect(
        canCreateAuthUser("blocked@example.com", createInvitePolicyDb(testCase)),
      ).resolves.toBe(false);
    }
  });

  it("allows a newly created auth user to bootstrap invitation acceptance", async () => {
    const db = createInvitationSessionPolicyDb({
      authUser: { email: "INVITED@example.com" },
      member: {
        authUserId: null,
        deletedAt: null,
        status: "INVITED",
      },
      invitation: {
        id: "invitation-1",
      },
    });

    await expect(canCreateInvitationSession("auth-user-1", db)).resolves.toBe(true);
    expect(db.member.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "invited@example.com" } }),
    );
  });

  it("blocks invitation session bootstrap without an eligible pending invitation", async () => {
    const cases = [
      createInvitationSessionPolicyDb(),
      createInvitationSessionPolicyDb({
        authUser: { email: "unknown@example.com" },
      }),
      createInvitationSessionPolicyDb({
        authUser: { email: "inactive@example.com" },
        member: {
          authUserId: null,
          deletedAt: null,
          status: "INACTIVE",
        },
        invitation: { id: "invitation-1" },
      }),
      createInvitationSessionPolicyDb({
        authUser: { email: "expired@example.com" },
        member: {
          authUserId: null,
          deletedAt: null,
          status: "INVITED",
        },
      }),
    ];

    for (const db of cases) {
      await expect(canCreateInvitationSession("auth-user-1", db)).resolves.toBe(false);
    }
  });
});
