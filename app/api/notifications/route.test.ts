import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthenticationError, AuthorizationError } from "@/src/server/auth/session";

const requireActiveAppMemberForAction = vi.fn();
const getMemberNotificationSummary = vi.fn();
const markAllNotificationsRead = vi.fn();
const markNotificationRead = vi.fn();

// The handlers reach Postgres through these two modules. Mocking them keeps the test on the status
// mapping — the part that was wrong — instead of standing up a database.
vi.mock("@/src/server/auth/app-access", () => ({
  requireActiveAppMemberForAction: () => requireActiveAppMemberForAction(),
}));

vi.mock("@/src/server/notifications", () => ({
  getMemberNotificationSummary: (input: unknown) => getMemberNotificationSummary(input),
  markAllNotificationsRead: (memberId: string) => markAllNotificationsRead(memberId),
  markNotificationRead: (memberId: string, notificationId: string) =>
    markNotificationRead(memberId, notificationId),
}));

const { GET, PATCH } = await import("./route");

function patchRequest(body: string) {
  return new Request("http://localhost/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("GET /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveAppMemberForAction.mockResolvedValue({ member: { id: "member-1" } });
    getMemberNotificationSummary.mockResolvedValue({ notifications: [], unreadCount: 0 });
  });

  it("returns the summary without caching it", async () => {
    const response = await GET(new Request("http://localhost/api/notifications?locale=en"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({ notifications: [], unreadCount: 0 });
    expect(getMemberNotificationSummary).toHaveBeenCalledWith({
      memberId: "member-1",
      locale: "en",
      limit: 5,
    });
  });

  it("falls back to Hungarian for an unsupported locale", async () => {
    await GET(new Request("http://localhost/api/notifications?locale=de"));

    expect(getMemberNotificationSummary).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "hu" }),
    );
  });

  it("returns 401 when there is no session", async () => {
    requireActiveAppMemberForAction.mockRejectedValue(new AuthenticationError());

    expect((await GET(new Request("http://localhost/api/notifications"))).status).toBe(401);
  });

  it("returns 403 when the session may not act", async () => {
    requireActiveAppMemberForAction.mockRejectedValue(
      new AuthorizationError("Your Sheet Happens account is not active."),
    );

    expect((await GET(new Request("http://localhost/api/notifications"))).status).toBe(403);
  });

  /**
   * The regression this route shipped with: every failure became a 401, so a database outage was
   * reported to the client as an auth problem and logged nowhere.
   */
  it("returns a logged 500 when the read fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("connect ECONNREFUSED");
    getMemberNotificationSummary.mockRejectedValue(failure);

    const response = await GET(new Request("http://localhost/api/notifications"));

    expect(response.status).toBe(500);
    expect(consoleError).toHaveBeenCalledWith("[notifications] summary read failed", failure);
    consoleError.mockRestore();
  });
});

describe("PATCH /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveAppMemberForAction.mockResolvedValue({ member: { id: "member-1" } });
  });

  it("marks every notification read", async () => {
    const response = await PATCH(patchRequest(JSON.stringify({ all: true })));

    expect(response.status).toBe(200);
    expect(markAllNotificationsRead).toHaveBeenCalledWith("member-1");
    expect(markNotificationRead).not.toHaveBeenCalled();
  });

  it("marks a single notification read", async () => {
    const response = await PATCH(patchRequest(JSON.stringify({ notificationId: "n-1" })));

    expect(response.status).toBe(200);
    expect(markNotificationRead).toHaveBeenCalledWith("member-1", "n-1");
    expect(markAllNotificationsRead).not.toHaveBeenCalled();
  });

  /**
   * A malformed body used to throw past the shape check into the shared catch, which answered 401
   * — telling the caller to re-authenticate over a request that was simply invalid.
   */
  it.each([
    ["malformed JSON", "{oops"],
    ["a JSON null", "null"],
    ["an unrecognised shape", JSON.stringify({ all: false })],
    ["a non-string notificationId", JSON.stringify({ notificationId: 7 })],
  ])("returns 400 for %s", async (_name, body) => {
    const response = await PATCH(patchRequest(body));

    expect(response.status).toBe(400);
    expect(markAllNotificationsRead).not.toHaveBeenCalled();
    expect(markNotificationRead).not.toHaveBeenCalled();
  });

  it("returns 403 when the session may not act", async () => {
    requireActiveAppMemberForAction.mockRejectedValue(
      new AuthorizationError("Second-factor verification required."),
    );

    expect((await PATCH(patchRequest(JSON.stringify({ all: true })))).status).toBe(403);
  });

  it("returns a logged 500 when the update fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    markAllNotificationsRead.mockRejectedValue(new Error("deadlock detected"));

    const response = await PATCH(patchRequest(JSON.stringify({ all: true })));

    expect(response.status).toBe(500);
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
