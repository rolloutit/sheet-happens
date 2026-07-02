import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createInvitationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export function verifyInvitationToken(token: string, tokenHash: string) {
  const expected = Buffer.from(hashInvitationToken(token));
  const actual = Buffer.from(tokenHash);

  if (expected.byteLength !== actual.byteLength) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}
