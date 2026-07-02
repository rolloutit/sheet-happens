import { describe, expect, it } from "vitest";

import {
  createInvitationToken,
  hashInvitationToken,
  verifyInvitationToken,
} from "./invitation-tokens";

describe("invitation tokens", () => {
  it("creates random URL-safe tokens", () => {
    const token = createInvitationToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThan(32);
  });

  it("verifies the matching token hash", () => {
    const token = "invite-token";
    const tokenHash = hashInvitationToken(token);

    expect(verifyInvitationToken(token, tokenHash)).toBe(true);
    expect(verifyInvitationToken("wrong-token", tokenHash)).toBe(false);
  });
});
