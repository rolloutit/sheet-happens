import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthenticationError } from "@/src/server/auth/session";
import { LeaveError } from "@/src/server/leave";

const requireActiveAppMember = vi.fn();
const requireActiveAppMemberForAction = vi.fn();
const createLeaveAttachmentReadUrl = vi.fn();

vi.mock("@/src/server/auth/app-access", () => ({
  requireActiveAppMember: (callbackURL: string) => requireActiveAppMember(callbackURL),
  requireActiveAppMemberForAction: () => requireActiveAppMemberForAction(),
}));

vi.mock("@/src/server/leave", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/server/leave")>()),
  createLeaveAttachmentReadUrl: (input: unknown) => createLeaveAttachmentReadUrl(input),
}));

const { GET } = await import("./route");

const params = Promise.resolve({ leaveId: "leave-1" });

function request(search = "", dest = "empty") {
  return new Request(`http://localhost/api/leave/leave-1/attachment${search}`, {
    headers: { "Sec-Fetch-Dest": dest },
  });
}

describe("GET /api/leave/[leaveId]/attachment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveAppMemberForAction.mockResolvedValue({
      member: { id: "member-1", role: "MEMBER" },
    });
    requireActiveAppMember.mockResolvedValue({ member: { id: "member-1", role: "MEMBER" } });
    createLeaveAttachmentReadUrl.mockResolvedValue("https://storage.example.com/note.pdf?sig=abc");
  });

  it("redirects to a signed URL without caching", async () => {
    const response = await GET(request(), { params });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://storage.example.com/note.pdf?sig=abc");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("asks for an attachment on download and passes the viewer through", async () => {
    requireActiveAppMember.mockResolvedValue({ member: { id: "admin-1", role: "ADMIN" } });

    await GET(request("?download=1", "document"), { params });

    expect(requireActiveAppMember).toHaveBeenCalledWith("/leave");
    expect(createLeaveAttachmentReadUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        leaveId: "leave-1",
        disposition: "attachment",
        viewer: { memberId: "admin-1", isAdmin: true },
      }),
    );
  });

  it("answers 404 when the viewer may not read the note", async () => {
    createLeaveAttachmentReadUrl.mockRejectedValue(new LeaveError("Leave not found.", "NOT_FOUND"));

    expect((await GET(request(), { params })).status).toBe(404);
  });

  it("answers 401 to a non-navigation without a session", async () => {
    requireActiveAppMemberForAction.mockRejectedValue(new AuthenticationError());

    expect((await GET(request(), { params })).status).toBe(401);
    expect(createLeaveAttachmentReadUrl).not.toHaveBeenCalled();
  });
});
