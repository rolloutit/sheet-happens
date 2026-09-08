import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The route composes real third-party pieces and needs a database, so the mocks sit at those
 * boundaries and nowhere further in:
 *
 * - `@better-auth/mcp` is replaced, because verifying a signed token is the one thing this test
 *   cannot do for itself. The stand-in hands the route whatever claims a test sets, which is also
 *   what makes the options the route constructs it with assertable.
 * - `better-auth/oauth2` is replaced for the same reason: the DPoP replay store wants a real Better
 *   Auth adapter, and the `insufficient_scope` error only means anything to the wrapper above.
 * - `@/src/server/db/client` is replaced, but `resolveMcpActor` is NOT: the ACTIVE / `deletedAt`
 *   re-check on every call is the reason a deactivated member's token stops working, and it is
 *   worth testing through rather than around.
 * - `buildMcpHandler` is the only export of `@/src/server/mcp` that is stubbed. Everything else —
 *   the scope map, the rate limiter, the actor resolver, `authInfoFor` — runs for real, and so does
 *   the SDK's own `originValidationResponse`.
 */

/**
 * The app's own origin for this file. Deliberately not localhost: `authUrls` builds the issuer,
 * audience and JWKS URL from it, and a route that let Better Auth default them instead would still
 * look right against a localhost expectation.
 */
const APP_ORIGIN = "https://sheet.example.test";

vi.stubEnv("BETTER_AUTH_URL", APP_ORIGIN);

type Claims = Record<string, unknown>;

/** The claims the stand-in verifier hands the route. Set per test. */
let claims: Claims = {};

type ProtectedRouteHandler = (request: Request, claims: Claims) => Promise<Response> | Response;

let handlerOptions: Record<string, unknown> | null = null;

/**
 * Stands in for the `insufficient_scope` failure `createInsufficientScopeError` builds. The real one
 * is a Better Auth `APIError` that `@better-auth/mcp` recognises and renders as an RFC 6750
 * challenge — so the fake wrapper below does the same, and the route's decision to *throw* rather
 * than return stays covered.
 */
class FakeInsufficientScopeError extends Error {
  constructor(readonly scopes: readonly string[]) {
    super(`insufficient_scope: ${scopes.join(" ")}`);
    this.name = "FakeInsufficientScopeError";
  }
}

const createInsufficientScopeError = vi.fn(
  (scopes: readonly string[]) => new FakeInsufficientScopeError(scopes),
);

/*
 * Typed rather than implemented with an unused parameter, so the arity the route calls it with stays
 * part of the stand-in's contract.
 */
const createDpopReplayStore = vi.fn<(adapter: unknown) => { replay: string }>(() => ({
  replay: "store",
}));
const createMcpProtectedRequestHandler = vi.fn(
  (options: Record<string, unknown>, handler: ProtectedRouteHandler) => {
    handlerOptions = options;

    return async (request: Request) => {
      try {
        return await handler(request, claims);
      } catch (error) {
        if (error instanceof FakeInsufficientScopeError) {
          return Response.json(
            { jsonrpc: "2.0", error: { code: -32000, message: error.message }, id: null },
            {
              status: 403,
              headers: {
                "WWW-Authenticate": `Bearer error="insufficient_scope", scope="${error.scopes.join(" ")}"`,
              },
            },
          );
        }

        // Anything else is the route's to answer — `McpInvalidTokenError` reaches the `POST` catch
        // by escaping this wrapper, which is the only reason a 401 is possible at all.
        throw error;
      }
    };
  },
);

const findUnique = vi.fn();
const internalAdapter = { id: "internal-adapter" };
const sdkFetch = vi.fn<(request: Request, options: unknown) => Promise<Response>>(async () =>
  Response.json({ jsonrpc: "2.0", id: 1, result: { tools: [] } }),
);

vi.mock("@better-auth/mcp", () => ({
  createMcpProtectedRequestHandler: (
    options: Record<string, unknown>,
    handler: ProtectedRouteHandler,
  ) => createMcpProtectedRequestHandler(options, handler),
}));

vi.mock("better-auth/oauth2", () => ({
  createDpopReplayStore: (adapter: unknown) => createDpopReplayStore(adapter),
  createInsufficientScopeError: (scopes: readonly string[]) => createInsufficientScopeError(scopes),
}));

vi.mock("@/src/server/auth/auth", () => ({
  auth: { $context: Promise.resolve({ internalAdapter }) },
}));

vi.mock("@/src/server/db/client", () => ({
  prisma: { member: { findUnique: (args: unknown) => findUnique(args) } },
}));

vi.mock("@/src/server/mcp", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  buildMcpHandler: () => ({
    fetch: (request: Request, options: unknown) => sdkFetch(request, options),
  }),
}));

const ACTIVE_MEMBER = {
  id: "member-1",
  displayName: "Ada",
  role: "MEMBER",
  currentProfile: "CONTRACTOR",
  timezone: "Europe/Budapest",
  locale: "en",
  durationDisplayFormat: "DECIMAL_HOURS",
  defaultTrackingMode: "TRACKED",
  status: "ACTIVE",
  deletedAt: null,
};

/**
 * A fresh route module per test.
 *
 * The route memoises its protected handler in a module-scope promise, so a shared import would let
 * the first `POST` decide what every later test sees — and would make "a `GET` never constructs the
 * handler factory" pass or fail on describe order.
 *
 * The rate limiter is emptied by hand rather than by the module reset: `mcpRateLimit` lives in the
 * *original* `@/src/server/mcp`, reached through `importOriginal`, and that instance outlives
 * `resetModules`. Without the reset, the 120 hits the rate-limit test spends would still be inside
 * the sliding window when the next test runs.
 */
async function loadRoute() {
  vi.resetModules();

  const route = await import("./route");
  const mcp = await import("@/src/server/mcp");

  mcp.mcpRateLimit.reset();

  return { ...route, mcpRateLimit: mcp.mcpRateLimit, rateLimit: mcp.MCP_RATE_LIMIT };
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${APP_ORIGIN}/api/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** A `tools/call` with no `Mcp-Name` header — the shape a pre-2026 client still sends. */
function legacyToolCall(name: string) {
  return { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: {} } };
}

afterAll(() => {
  // `stubEnv` is process-wide: left in place it would follow `auth-urls` into whatever test file
  // this worker picks up next.
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.clearAllMocks();
  handlerOptions = null;
  claims = {
    sub: "auth-user-1",
    scope: "openid time:read time:write",
    client_id: "https://claude.ai/mcp",
    jti: "token-1",
  };
  findUnique.mockResolvedValue(ACTIVE_MEMBER);
});

describe("GET and DELETE /api/mcp", () => {
  /**
   * The transport is POST-only. Answering here rather than letting the SDK do it keeps a browser
   * visit from collecting a 401 challenge for a URL that would never have worked as a GET — and it
   * must not cost a token verification, a JWKS fetch or a database read.
   */
  it.each([
    ["GET", (route: Awaited<ReturnType<typeof loadRoute>>) => route.GET()],
    ["DELETE", (route: Awaited<ReturnType<typeof loadRoute>>) => route.DELETE()],
  ])("answers %s with 405 without touching auth", async (_verb, call) => {
    const route = await loadRoute();
    const response = call(route);

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
    await expect(response.json()).resolves.toEqual({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    });

    expect(createMcpProtectedRequestHandler).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe("origin validation", () => {
  /** A present, foreign `Origin` is a DNS-rebinding attempt, and refusing it is a spec MUST. */
  it("refuses a foreign Origin with 403 before any auth work", async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      post({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { Origin: "https://evil.example" }),
    );

    expect(response.status).toBe(403);
    expect(createMcpProtectedRequestHandler).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
    expect(sdkFetch).not.toHaveBeenCalled();
  });

  /**
   * Anthropic's servers and Claude Code send no `Origin` at all, so refusing that would refuse
   * every real client.
   */
  it("passes an absent Origin through", async () => {
    const { POST } = await loadRoute();

    const response = await POST(post({ jsonrpc: "2.0", id: 1, method: "tools/list" }));

    expect(response.status).toBe(200);
    expect(sdkFetch).toHaveBeenCalledOnce();
  });

  it("passes the app's own Origin through", async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      post({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { Origin: APP_ORIGIN }),
    );

    expect(response.status).toBe(200);
    expect(sdkFetch).toHaveBeenCalledOnce();
  });
});

describe("token verification options", () => {
  /**
   * The regression this route exists to avoid. `requireMcpAuth` derives all three of these from
   * `(await auth.$context).baseURL`, which Better Auth leaves empty whenever `baseURL` is a dynamic
   * config — which is every non-production environment here. Defaulted, no token would ever verify.
   */
  it("verifies against the issuer, audience and JWKS URL from authUrls", async () => {
    const { POST } = await loadRoute();

    await POST(post({ jsonrpc: "2.0", id: 1, method: "tools/list" }));

    expect(createMcpProtectedRequestHandler).toHaveBeenCalledOnce();
    expect(handlerOptions).toMatchObject({
      issuer: `${APP_ORIGIN}/api/auth`,
      audience: `${APP_ORIGIN}/api/mcp`,
      jwksUrl: `${APP_ORIGIN}/api/auth/jwks`,
    });
  });

  /**
   * `time:read` is the floor for reaching a tool at all. The challenge advertises both v1 scopes
   * rather than only the missing one, because Claude does not reliably carry earlier grants into a
   * step-up consent — asked for `time:write` alone it can come back having lost its reads.
   */
  it("requires time:read and challenges for both v1 scopes", async () => {
    const { POST } = await loadRoute();

    await POST(post({ jsonrpc: "2.0", id: 1, method: "tools/list" }));

    expect(handlerOptions?.requiredScopes).toEqual(["time:read"]);
    expect(handlerOptions?.challengeScopes).toEqual(
      expect.arrayContaining(["time:read", "time:write"]),
    );
  });

  /** An in-memory replay store would forget spent `jti`s across instances and restarts. */
  it("backs DPoP replay detection with the auth context's adapter", async () => {
    const { POST } = await loadRoute();

    await POST(post({ jsonrpc: "2.0", id: 1, method: "tools/list" }));

    expect(createDpopReplayStore).toHaveBeenCalledWith(internalAdapter);
    expect(handlerOptions?.dpop).toEqual({ replayStore: { replay: "store" } });
  });
});

describe("scope gating", () => {
  beforeEach(() => {
    claims = { ...claims, scope: "openid time:read" };
  });

  /**
   * Both protocol eras, because the tool name arrives by different routes: a 2026-07-28 client must
   * send `Mcp-Name` mirroring `params.name` and the SDK rejects a mismatch, while a legacy client
   * sends no such header and the parsed body is the only source.
   */
  it.each([
    [
      "the modern Mcp-Name header",
      () => post({ jsonrpc: "2.0", id: 1 }, { "Mcp-Name": "time_create_entry" }),
    ],
    ["a legacy tools/call body", () => post(legacyToolCall("time_create_entry"))],
  ])("refuses a write tool on a read-only token via %s", async (_era, request) => {
    const { POST } = await loadRoute();

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(createInsufficientScopeError).toHaveBeenCalledWith(["time:write"]);
    expect(sdkFetch).not.toHaveBeenCalled();
  });

  it("lets a read tool through to the SDK handler", async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      post(legacyToolCall("time_get_context"), { "Mcp-Name": "time_get_context" }),
    );

    expect(response.status).toBe(200);
    expect(createInsufficientScopeError).not.toHaveBeenCalled();
    expect(sdkFetch).toHaveBeenCalledOnce();
  });
});

describe("actor resolution", () => {
  /**
   * A bearer token is not a session: it survives a deactivation until it expires. The 401 makes the
   * client discard it and re-run the OAuth flow, where it fails at login — the correct end state. A
   * 200 with `isError` would leave it retrying with a token that can never work.
   */
  it.each([
    ["an inactive member", { ...ACTIVE_MEMBER, status: "INACTIVE" }],
    ["a soft-deleted member", { ...ACTIVE_MEMBER, deletedAt: new Date("2026-01-01T00:00:00Z") }],
    ["no member row at all", null],
  ])("answers 401 invalid_token for %s", async (_case, member) => {
    findUnique.mockResolvedValue(member);
    const { POST } = await loadRoute();

    const response = await POST(post({ jsonrpc: "2.0", id: 1, method: "tools/list" }));

    expect(response.status).toBe(401);

    const challenge = response.headers.get("WWW-Authenticate") ?? "";
    expect(challenge).toContain('error="invalid_token"');
    expect(challenge).toContain(
      `resource_metadata="${APP_ORIGIN}/.well-known/oauth-protected-resource/api/mcp"`,
    );
    expect(sdkFetch).not.toHaveBeenCalled();
  });
});

describe("rate limiting", () => {
  /**
   * The real limiter, with its budget spent directly rather than through 120 requests: the key is
   * the member id, so `check` on the instance the route holds is the same spend a request would
   * make, and it leaves this test asserting the route's 429 instead of the limiter's arithmetic
   * (which `rate-limit.test.ts` already owns).
   */
  it("answers 429 with Retry-After once the member's budget is spent", async () => {
    const { POST, mcpRateLimit, rateLimit } = await loadRoute();

    for (let spent = 0; spent < rateLimit.max; spent += 1) {
      mcpRateLimit.check(ACTIVE_MEMBER.id);
    }

    const response = await POST(post({ jsonrpc: "2.0", id: 1, method: "tools/list" }));

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(sdkFetch).not.toHaveBeenCalled();
  });
});

describe("body forwarding", () => {
  /** Parsed once here and handed over, rather than cloned and parsed again inside the SDK. */
  it("forwards parsedBody when the body is JSON", async () => {
    const { POST } = await loadRoute();
    const body = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };

    await POST(post(body));

    expect(sdkFetch).toHaveBeenCalledOnce();
    const options = sdkFetch.mock.calls[0]?.[1] as { parsedBody?: unknown; authInfo?: unknown };
    expect(options.parsedBody).toEqual(body);
    expect(options.authInfo).toMatchObject({
      clientId: "https://claude.ai/mcp",
      extra: { memberId: ACTIVE_MEMBER.id, tokenId: "token-1" },
    });
  });

  /**
   * Omitted rather than forwarded as `undefined`: a body that is not JSON belongs to the SDK, which
   * answers with the correct JSON-RPC parse error. Handing it a `parsedBody` key at all would put
   * the route in the business of deciding what an unparseable request means.
   */
  it("omits parsedBody when the body is not JSON", async () => {
    const { POST } = await loadRoute();

    await POST(post("not json at all"));

    expect(sdkFetch).toHaveBeenCalledOnce();
    expect(sdkFetch.mock.calls[0]?.[1]).not.toHaveProperty("parsedBody");
  });
});
