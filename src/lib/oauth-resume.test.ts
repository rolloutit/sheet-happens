import { describe, expect, it } from "vitest";

import { buildAuthorizeResumeUrl, OAUTH_AUTHORIZE_PATH } from "./oauth-resume";

/**
 * A real hand-off, captured from the provider: the whole authorization request plus `exp`, `ba_iat`,
 * one repeated `ba_param` per signed name, and `sig`.
 */
function handoff(overrides: Record<string, string | string[]> = {}) {
  return {
    response_type: "code",
    client_id: "https://claude.ai/oauth/claude-code-client-metadata",
    redirect_uri: "http://127.0.0.1:33418/callback",
    scope: "openid profile offline_access time:read time:write",
    state: "abc123",
    code_challenge: "0Ku4rKk1PDzTuKcO7YbF0dJvZk1eN6pRk4qLmQnZ8bs",
    code_challenge_method: "S256",
    resource: "https://sheet.example.com/api/mcp",
    exp: "1788788328",
    ba_iat: "1788787728684",
    ba_param: ["ba_iat", "client_id", "exp", "scope", "state"],
    sig: "klpFnMKbEJWUx4c0fQN28xwzRgVRfDDFx7IL5SSq/go=",
    ...overrides,
  };
}

describe("buildAuthorizeResumeUrl", () => {
  it("returns null when there is no pending authorization", () => {
    expect(buildAuthorizeResumeUrl({})).toBeNull();
    expect(buildAuthorizeResumeUrl({ callbackURL: "/time", email: "ada@example.com" })).toBeNull();
  });

  it("rebuilds the authorize URL with every request parameter", () => {
    const url = buildAuthorizeResumeUrl(handoff());

    expect(url).not.toBeNull();
    const parsed = new URL(url!, "https://sheet.example.com");

    expect(parsed.pathname).toBe(OAUTH_AUTHORIZE_PATH);
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("client_id")).toBe(
      "https://claude.ai/oauth/claude-code-client-metadata",
    );
    expect(parsed.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:33418/callback");
    expect(parsed.searchParams.get("scope")).toBe(
      "openid profile offline_access time:read time:write",
    );
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    expect(parsed.searchParams.get("resource")).toBe("https://sheet.example.com/api/mcp");
    expect(parsed.searchParams.get("state")).toBe("abc123");
  });

  /**
   * The signing parameters prove a *body* carries an untampered query. On a fresh `GET` they mean
   * nothing, and carrying them would bloat the URL that has to survive being embedded in a magic
   * link.
   */
  it("drops the provider's signing parameters", () => {
    const parsed = new URL(buildAuthorizeResumeUrl(handoff())!, "https://sheet.example.com");

    for (const param of ["sig", "exp", "ba_iat", "ba_pl", "ba_param"]) {
      expect(parsed.searchParams.has(param)).toBe(false);
    }
  });

  it("does not nest an existing callbackURL inside the resumed request", () => {
    const parsed = new URL(
      buildAuthorizeResumeUrl(handoff({ callbackURL: "/dashboard" }))!,
      "https://sheet.example.com",
    );

    expect(parsed.searchParams.has("callbackURL")).toBe(false);
  });

  /**
   * `prompt=login` is what sent the member to the login page. Forwarding it would send them
   * straight back after they signed in — an infinite bounce that looks like a broken connector.
   */
  it("strips the prompts that would loop back to login", () => {
    const login = new URL(
      buildAuthorizeResumeUrl(handoff({ prompt: "login" }))!,
      "https://sheet.example.com",
    );
    expect(login.searchParams.has("prompt")).toBe(false);

    const create = new URL(
      buildAuthorizeResumeUrl(handoff({ prompt: "create" }))!,
      "https://sheet.example.com",
    );
    expect(create.searchParams.has("prompt")).toBe(false);
  });

  it("keeps consent when it is combined with login", () => {
    const parsed = new URL(
      buildAuthorizeResumeUrl(handoff({ prompt: "login consent" }))!,
      "https://sheet.example.com",
    );

    expect(parsed.searchParams.get("prompt")).toBe("consent");
  });

  /** RFC 8707 allows several resource indicators, and dropping one would change the audience. */
  it("preserves a repeated resource parameter", () => {
    const parsed = new URL(
      buildAuthorizeResumeUrl(
        handoff({
          resource: ["https://sheet.example.com/api/mcp", "https://sheet.example.com/api/other"],
        }),
      )!,
      "https://sheet.example.com",
    );

    expect(parsed.searchParams.getAll("resource")).toEqual([
      "https://sheet.example.com/api/mcp",
      "https://sheet.example.com/api/other",
    ]);
  });

  /**
   * The resumed URL is handed to `sanitizeCallbackURL`, which rewrites anything that is not a plain
   * same-origin path — so if this ever stopped being one, the whole hand-off would silently become
   * a trip to `/dashboard`.
   */
  it("stays an app-relative path that survives callback sanitizing", () => {
    const url = buildAuthorizeResumeUrl(handoff())!;

    expect(url.startsWith("/")).toBe(true);
    expect(url.startsWith("//")).toBe(false);
    expect(url.startsWith("/login")).toBe(false);
    expect(url.startsWith("/two-factor")).toBe(false);
  });
});
