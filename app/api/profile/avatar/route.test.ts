import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthenticationError, AuthorizationError } from "@/src/server/auth/session";
import { MemberPreferenceError } from "@/src/server/settings";

const requireActiveAppMemberForAction = vi.fn();
const createMemberAvatarReadUrl = vi.fn();

vi.mock("@/src/server/auth/app-access", () => ({
  requireActiveAppMemberForAction: () => requireActiveAppMemberForAction(),
}));

// Only the signed-URL call is replaced: the handler narrows on the real `MemberPreferenceError`,
// so the class identity has to stay the one the module actually exports.
vi.mock("@/src/server/settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/server/settings")>()),
  createMemberAvatarReadUrl: (memberId: string) => createMemberAvatarReadUrl(memberId),
}));

const { GET } = await import("./route");

describe("GET /api/profile/avatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveAppMemberForAction.mockResolvedValue({ member: { id: "member-1" } });
    createMemberAvatarReadUrl.mockResolvedValue("https://storage.example.com/avatar.png?sig=abc");
  });

  it("redirects to the signed URL without caching or leaking the referrer", async () => {
    const response = await GET();

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://storage.example.com/avatar.png?sig=abc");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(createMemberAvatarReadUrl).toHaveBeenCalledWith("member-1");
  });

  it("returns 404 when the member has no avatar", async () => {
    createMemberAvatarReadUrl.mockRejectedValue(new MemberPreferenceError("Avatar not found."));

    expect((await GET()).status).toBe(404);
  });

  it("returns 401 when there is no session", async () => {
    requireActiveAppMemberForAction.mockRejectedValue(new AuthenticationError());

    expect((await GET()).status).toBe(401);
  });

  it("returns 403 when the session may not act", async () => {
    requireActiveAppMemberForAction.mockRejectedValue(
      new AuthorizationError("Complete security setup before using Sheet Happens."),
    );

    expect((await GET()).status).toBe(403);
  });

  /**
   * A signing or storage outage used to answer 401, which reads as "log in again" for a fault the
   * viewer cannot do anything about — and left no log line behind.
   */
  it("returns a logged 500 when signing fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("S3 unreachable");
    createMemberAvatarReadUrl.mockRejectedValue(failure);

    const response = await GET();

    expect(response.status).toBe(500);
    expect(consoleError).toHaveBeenCalledWith("[profile] avatar access failed", failure);
    consoleError.mockRestore();
  });
});
