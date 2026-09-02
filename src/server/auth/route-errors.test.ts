import { describe, expect, it } from "vitest";

import { authErrorStatus } from "./route-errors";
import { AuthenticationError, AuthorizationError } from "./session";

describe("authErrorStatus", () => {
  it("maps a missing session to 401", () => {
    expect(authErrorStatus(new AuthenticationError())).toBe(401);
  });

  it.each([
    "Second-factor verification required.",
    "Complete security setup before using Sheet Happens.",
    "Your Sheet Happens account is not active.",
    "Admin access required.",
  ])("maps a session that may not act to 403: %s", (message) => {
    expect(authErrorStatus(new AuthorizationError(message))).toBe(403);
  });

  /**
   * The routes fall back to a logged 500 on `null`. Classifying an unexpected DB or storage
   * failure here would surface it as an auth error with nothing in the logs, which is the bug this
   * helper exists to prevent.
   */
  it.each([
    ["an unexpected failure", new Error("connect ECONNREFUSED")],
    ["a thrown non-error", "nope"],
    ["nothing", undefined],
  ])("leaves %s to the caller", (_name, error) => {
    expect(authErrorStatus(error)).toBeNull();
  });
});
