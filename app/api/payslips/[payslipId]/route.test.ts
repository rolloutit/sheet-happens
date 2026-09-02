import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthenticationError, AuthorizationError } from "@/src/server/auth/session";
import { PayslipError } from "@/src/server/payslips";

const requireActiveAppMember = vi.fn();
const requireActiveAppMemberForAction = vi.fn();
const createPayslipReadUrl = vi.fn();

vi.mock("@/src/server/auth/app-access", () => ({
  requireActiveAppMember: (callbackURL: string) => requireActiveAppMember(callbackURL),
  requireActiveAppMemberForAction: () => requireActiveAppMemberForAction(),
}));

// Only the signed-URL call is replaced; the handler narrows on the real `PayslipError`.
vi.mock("@/src/server/payslips", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/server/payslips")>()),
  createPayslipReadUrl: (input: unknown) => createPayslipReadUrl(input),
}));

const { GET } = await import("./route");

const params = Promise.resolve({ payslipId: "payslip-1" });

/** `Sec-Fetch-Dest: iframe` is what the preview dialog's frame sends; `document` is a link click. */
function documentRequest(search = "") {
  return new Request(`http://localhost/api/payslips/payslip-1${search}`, {
    headers: { "Sec-Fetch-Dest": "document" },
  });
}

function iframeRequest(search = "") {
  return new Request(`http://localhost/api/payslips/payslip-1${search}`, {
    headers: { "Sec-Fetch-Dest": "iframe" },
  });
}

describe("GET /api/payslips/[payslipId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveAppMemberForAction.mockResolvedValue({
      member: { id: "member-1", role: "MEMBER" },
    });
    requireActiveAppMember.mockResolvedValue({ member: { id: "member-1", role: "MEMBER" } });
    createPayslipReadUrl.mockResolvedValue("https://storage.example.com/payslip.pdf?sig=abc");
  });

  it("redirects to the signed URL without caching or leaking the referrer", async () => {
    const response = await GET(iframeRequest(), { params });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://storage.example.com/payslip.pdf?sig=abc",
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it.each([
    ["inline for the preview frame", "", "inline"],
    ["an attachment for the download link", "?download=1", "attachment"],
  ])("requests %s", async (_name, search, expected) => {
    await GET(iframeRequest(search), { params });

    expect(createPayslipReadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ payslipId: "payslip-1", disposition: expected }),
    );
  });

  it("passes the admin flag and request metadata through for the audit trail", async () => {
    requireActiveAppMemberForAction.mockResolvedValue({
      member: { id: "admin-1", role: "ADMIN" },
    });
    const request = new Request("http://localhost/api/payslips/payslip-1", {
      headers: {
        "Sec-Fetch-Dest": "iframe",
        "x-forwarded-for": "203.0.113.7",
        "user-agent": "test-agent",
      },
    });

    await GET(request, { params });

    expect(createPayslipReadUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        actorMemberId: "admin-1",
        isAdmin: true,
        requestMetadata: { ipAddress: "203.0.113.7", userAgent: "test-agent" },
      }),
    );
  });

  it("returns 404 when the payslip is not readable", async () => {
    createPayslipReadUrl.mockRejectedValue(new PayslipError("Payslip not found."));

    expect((await GET(iframeRequest(), { params })).status).toBe(404);
  });

  it("returns a logged 500 when signing fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    createPayslipReadUrl.mockRejectedValue(new Error("S3 unreachable"));

    expect((await GET(iframeRequest(), { params })).status).toBe(500);
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  describe("a preview frame", () => {
    /**
     * The bug this split exists for: the redirecting guard would answer the frame with the login
     * page, rendering the whole form inside the preview dialog.
     */
    it.each([
      ["401 when there is no session", new AuthenticationError(), 401],
      ["403 when the session may not act", new AuthorizationError("Not active."), 403],
    ])("gets %s", async (_name, thrown, status) => {
      requireActiveAppMemberForAction.mockRejectedValue(thrown);

      const response = await GET(iframeRequest(), { params });

      expect(response.status).toBe(status);
      expect(requireActiveAppMember).not.toHaveBeenCalled();
      expect(createPayslipReadUrl).not.toHaveBeenCalled();
    });

    it.each([["iframe"], ["embed"], ["empty"]])(
      "uses the non-redirecting guard for Sec-Fetch-Dest: %s",
      async (dest) => {
        const request = new Request("http://localhost/api/payslips/payslip-1", {
          headers: { "Sec-Fetch-Dest": dest },
        });

        await GET(request, { params });

        expect(requireActiveAppMemberForAction).toHaveBeenCalledOnce();
        expect(requireActiveAppMember).not.toHaveBeenCalled();
      },
    );

    it("treats a caller that sends no Sec-Fetch-Dest as a subresource", async () => {
      await GET(new Request("http://localhost/api/payslips/payslip-1"), { params });

      expect(requireActiveAppMemberForAction).toHaveBeenCalledOnce();
      expect(requireActiveAppMember).not.toHaveBeenCalled();
    });
  });

  describe("a top-level navigation", () => {
    it("keeps the redirecting guard so the download link still reaches the login page", async () => {
      await GET(documentRequest("?download=1"), { params });

      expect(requireActiveAppMember).toHaveBeenCalledWith("/payslips");
      expect(requireActiveAppMemberForAction).not.toHaveBeenCalled();
    });

    /**
     * `redirect()` signals itself by throwing NEXT_REDIRECT. Resolving auth inside the
     * document-serving try — as a reviewer suggested — would let that catch log it as a 500 and
     * swallow the redirect, so this pins that it escapes the handler untouched.
     */
    it("lets NEXT_REDIRECT escape instead of logging it as a 500", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const redirectSignal = Object.assign(new Error("NEXT_REDIRECT"), {
        digest: "NEXT_REDIRECT;replace;/login?callbackURL=%2Fpayslips;307;",
      });
      requireActiveAppMember.mockRejectedValue(redirectSignal);

      await expect(GET(documentRequest(), { params })).rejects.toBe(redirectSignal);
      expect(consoleError).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });
});
