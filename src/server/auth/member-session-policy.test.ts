import { describe, expect, it } from "vitest";

import { canCreateMemberSession } from "./member-session-policy";

describe("member session policy", () => {
  it("allows active members and invited members completing activation", () => {
    expect(canCreateMemberSession({ status: "ACTIVE", deletedAt: null })).toBe(true);
    expect(canCreateMemberSession({ status: "INVITED", deletedAt: null })).toBe(true);
  });

  it("blocks inactive, deleted, and unlinked members before a session is created", () => {
    expect(canCreateMemberSession({ status: "INACTIVE", deletedAt: null })).toBe(false);
    expect(canCreateMemberSession({ status: "DELETED", deletedAt: null })).toBe(false);
    expect(canCreateMemberSession({ status: "ACTIVE", deletedAt: new Date() })).toBe(false);
    expect(canCreateMemberSession(null)).toBe(false);
  });
});
