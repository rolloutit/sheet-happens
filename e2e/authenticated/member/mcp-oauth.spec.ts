/**
 * The whole MCP connection, driven end to end against the running server as an ordinary member.
 *
 * Every other MCP test stubs something: the unit tests hand a fake actor to a tool, the route test
 * injects claims instead of verifying a token. This one proves the part nothing else covers — client
 * registration, PKCE, the session the member already has, the consent page, the code exchange, and
 * a JSON-RPC call carrying the token that came out of it. If it passes, an agent can connect.
 *
 * Member-only, and for the second of the two reasons `playwright.config.ts` gives: an access token
 * is minted for whoever consented, so `time_get_context` answering with *this* member's id and
 * timezone is what proves the actor is the token's subject rather than whoever the server happens to
 * think is signed in. Running it as the admin too would prove nothing extra and would spend a second
 * registration against the budget below.
 *
 * Three constraints shape the file, and each of them is a property of the OAuth provider rather
 * than of this app:
 *
 *  - `/api/auth/oauth2/register` allows **5 requests per minute per IP** (the provider's own
 *    default, on top of the global Better Auth `rateLimit` block in `auth.ts`). So a client is
 *    registered once per *test*, never once per step, and only two tests register one at all.
 *  - Consent is remembered per client, user and scope set: a second authorization whose scopes are
 *    already covered skips `/consent` and comes straight back with a code. A test that needs to
 *    *see* the consent screen therefore needs a client that has never been allowed — which is why
 *    the axe scan registers its own instead of reusing the chain's.
 *  - A registered client is the root of the OAuth cascade, so `afterAll` deleting it takes the
 *    grant and the issued tokens with it and a re-run starts clean.
 *
 * DCR is on without anything in `playwright.config.ts` switching it on: `isDynamicClientRegistration
 * Enabled()` (src/server/mcp/config.ts) reads `NODE_ENV !== "production"`, and both servers this
 * suite runs against are `next dev`. `MCP_ALLOW_DYNAMIC_CLIENT_REGISTRATION=false` in a developer's
 * `.env.local` would switch it off, and the registration failure message says so.
 */
import { createHash, randomBytes } from "node:crypto";

import { request as apiRequest, type APIRequestContext, type Page } from "@playwright/test";
import { Client } from "pg";

import { e2eDatabaseUrl } from "../../database";
import { expect, test as authenticated, visit } from "../../fixtures";

/**
 * A loopback redirect URI, which is what Claude Code and the MCP Inspector use — and the reason the
 * client below has to register as `native`. A dynamically registered client defaults to
 * `application_type: "web"`, and the provider refuses a web client any `http://` redirect ("web
 * clients require https redirect URIs on non-loopback hosts").
 *
 * Nothing ever listens on the port. The browser's navigation to it is intercepted, because what
 * matters is the query string the provider appends, not the page that would have parsed it.
 */
const CALLBACK_URL = "http://127.0.0.1:33418/callback";

/**
 * The client's registered name, which the consent page shows as the thing being trusted (a
 * registered client has no `client_id` host to name the way a CIMD one does — see
 * `loadConsentClient`). Every assertion about the consent screen, the committed aria baseline
 * included, depends on this string.
 */
const CLIENT_NAME = "Sheet Happens E2E Agent";

/** Everything the v1 connector asks for: the two time scopes plus the standard identity set. */
const REQUESTED_SCOPE = "openid profile offline_access time:read time:write";

/** The stateless revision. Sent as a header *and* claimed in `_meta`; the SDK cross-checks them. */
const MCP_PROTOCOL_VERSION = "2026-07-28";

/** The seeded member this project signs in as (`e2e/auth.setup.ts`), and its seeded timezone. */
const MEMBER_EMAIL = "contractor@example.com";
const MEMBER_TIMEZONE = "Europe/Budapest";

/**
 * The ten `time` tools, in the order `src/server/mcp/toolsets/time/index.ts` registers them.
 *
 * Written out rather than imported from `TIME_TOOL_NAMES`: this is the list an agent reads off the
 * wire, and a spec that imported the source of truth could not fail when a tool is renamed. The
 * order is part of the contract too — `tools/list` is part of a client's prompt cache, so a list
 * that reorders itself invalidates that cache on every call.
 */
const TIME_TOOLS = [
  "time_get_context",
  "time_list_entries",
  "time_summary",
  "time_create_entry",
  "time_update_entry",
  "time_delete_entry",
  "time_restore_entry",
  "timer_start",
  "timer_stop",
  "timer_status",
];

/**
 * The 2026-07-28 per-request `_meta` envelope. The keys are the reserved ones
 * `@modelcontextprotocol/server` declares as `PROTOCOL_VERSION_META_KEY`, `CLIENT_INFO_META_KEY`
 * and `CLIENT_CAPABILITIES_META_KEY`.
 *
 * `clientCapabilities` is required even though nothing here declares a capability: the SDK's
 * required envelope keys are the protocol version and the capabilities, and omitting the latter is
 * answered `-32602 … io.modelcontextprotocol/clientCapabilities: missing` before a tool is reached.
 * `clientInfo` is the one spec PR #3002 demoted to SHOULD; it is sent because a real client sends
 * it, so the envelope this spec proves is the envelope Claude will use.
 */
const REQUEST_META = {
  "io.modelcontextprotocol/protocolVersion": MCP_PROTOCOL_VERSION,
  "io.modelcontextprotocol/clientInfo": { name: "sheet-happens-e2e", version: "1.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

/**
 * The clients this worker registered, removed once the file's tests are done.
 *
 * Per worker rather than a sweep by client name: `fullyParallel` may spread this file across
 * several workers, and a name-wide delete would take a sibling worker's client out mid-test.
 */
const registeredClientIds: string[] = [];

const test = authenticated.extend<{ agent: APIRequestContext }>({
  /**
   * An HTTP client with no browser session, which is what an agent actually is.
   *
   * Playwright's built-in `request` fixture inherits the project's `storageState`, so it would
   * carry the member's session cookie into every call — and a 401 asserted with a live session
   * cookie in the jar proves nothing about bearer authentication. It also changes registration: the
   * provider records the signed-in user as the client's owner when it sees a session, which no
   * agent registering itself ever would.
   */
  agent: async ({ baseURL }, run) => {
    /*
     * `storageState: undefined` is load-bearing, not tidiness. `newContext({ baseURL })` inside a
     * test still inherits the PROJECT's `storageState`, so without it this context carries
     * `better-auth.session_token` — and Better Auth applies its CSRF origin check to any
     * state-changing request that arrives with a session cookie, answering
     * `403 MISSING_OR_NULL_ORIGIN`. A cookie-less context is both what an agent actually is and the
     * only way the assertions below mean anything.
     */
    const agent = await apiRequest.newContext({ baseURL, storageState: undefined });

    await run(agent);

    await agent.dispose();
  },
});

test.afterAll(async () => {
  if (registeredClientIds.length === 0) return;

  await withE2eDatabase(async (database) => {
    // `oauthClient` is the root of the cascade: `oauthClientResource`, `oauthAccessToken`,
    // `oauthRefreshToken` and `oauthConsent` all reference it `ON DELETE CASCADE`
    // (`prisma/oauth.prisma`), so one delete per client takes the grant, the issued tokens and the
    // resource link with it. The authorization code needs no cleanup — it is a `verification` row
    // that the exchange spends and that expires on its own.
    await database.query(`delete from "oauthClient" where "clientId" = any($1::text[])`, [
      registeredClientIds,
    ]);
  });

  registeredClientIds.length = 0;
});

test("connects an agent: registration, consent, PKCE exchange and two MCP calls", async ({
  agent,
  page,
  baseURL,
}) => {
  /**
   * Generous, because this is the run's first visit to two routes that both compile on demand:
   * `/consent` is `force-dynamic`, and `/api/mcp` builds its protected handler on the first request
   * and fetches the JWKS over HTTP from this same app to verify the token. On a cold Turbopack dev
   * server with several workers compiling at once, that is well past the default 30s.
   */
  test.setTimeout(120_000);

  const origin = originOf(baseURL);
  const mcpResource = `${origin}/api/mcp`;
  const issuer = `${origin}/api/auth`;

  // The member id the tool must answer with. It is a generated uuid, so it can only come from the
  // database — and reading it here is also what proves the token was minted for the row this
  // project signs in as rather than for whichever member happens to be first.
  const memberId = await withE2eDatabase(async (database) => {
    const { rows } = await database.query<{ id: string }>(
      `select id from members where email = $1`,
      [MEMBER_EMAIL],
    );

    return rows.at(0)?.id;
  });

  expect(
    memberId,
    `${MEMBER_EMAIL} is not in the e2e database — is it seeded? \`pnpm db:test\``,
  ).toBeTruthy();

  const clientId = await registerAgentClient(agent);
  const { verifier, challenge } = createPkcePair();
  const state = randomBytes(16).toString("base64url");

  await visit(page, authorizeRequestPath({ clientId, challenge, state, resource: mcpResource }));

  // The member is already signed in, so the provider skips `/login` and its whole signed hand-off
  // (src/lib/oauth-resume.ts) and lands straight on consent.
  await expect(page).toHaveURL(/\/consent\?/);

  // Exactly one `h1`, and it belongs to the AuthShell — the page's own title is the `h2` under it.
  // That is the same shape as every other auth screen, which is what makes the consent screen read
  // as a page rather than as a dialog dropped into the middle of a flow.
  const shellHeading = page.getByRole("heading", { level: 1 });
  await expect(shellHeading).toHaveCount(1);
  await expect(shellHeading).toHaveText("One step more — for safety.");

  await expect(page.getByRole("heading", { level: 2 })).toHaveText(
    `${CLIENT_NAME} wants to access your Sheet Happens account`,
  );

  // The three groups the requested scopes collapse into (`CONSENT_SCOPE_GROUPS`), asserted by their
  // titles because those are the sentences a member actually decides on. Their presence is the
  // whole point of the screen: a scope the page declined to name must never be granted silently.
  for (const scopeLine of [
    "Read your time",
    "Log and correct your time",
    "Know who you are and stay connected",
  ]) {
    await expect(page.getByText(scopeLine, { exact: true })).toBeVisible();
  }

  await expect(page.getByRole("main")).toMatchAriaSnapshot({ name: "mcp-consent.aria.yml" });

  const callback = await allowAndCaptureCallback(page);

  expect(callback.searchParams.get("state"), "the state parameter did not round-trip").toBe(state);
  // RFC 9207. The issuer carries a path because Better Auth's `basePath` does, and a client compares
  // this against the issuer it discovered — a bare origin here would fail every real connection.
  expect(
    callback.searchParams.get("iss"),
    "iss is not the issuer this origin advertises — does BETTER_AUTH_URL match the port the suite runs on?",
  ).toBe(issuer);

  const code = callback.searchParams.get("code");
  expect(code, `the provider redirected without a code: ${callback.search}`).toBeTruthy();

  const exchange = await agent.post("/api/auth/oauth2/token", {
    // Form-encoded, as RFC 6749 requires and as Claude sends it. `resource` is repeated here as
    // well as on the authorization request: RFC 8707 binds the audience at both ends.
    form: {
      grant_type: "authorization_code",
      code: code ?? "",
      redirect_uri: CALLBACK_URL,
      client_id: clientId,
      code_verifier: verifier,
      resource: mcpResource,
    },
  });

  expect(
    exchange.ok(),
    `the token exchange failed with ${exchange.status()}: ${await exchange.text()}`,
  ).toBeTruthy();

  const tokens = (await exchange.json()) as {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
  };

  expect(tokens.token_type?.toLowerCase()).toBe("bearer");
  // Without a refresh token the connection silently stops working an hour later, so its absence is
  // a bug that would never show up in a manual smoke test.
  expect(
    tokens.refresh_token,
    "no refresh token was issued — was `offline_access` granted, and does the client allow the refresh_token grant?",
  ).toBeTruthy();
  expect(tokens.access_token, "no access token was issued").toBeTruthy();

  const [header, claims] = decodeAccessToken(tokens.access_token ?? "");

  // RFC 9068's media type. A resource server that checks it — and `verifyAccessTokenRequest` in the
  // route does — refuses an id token presented as an access token, so this is not decoration.
  expect(header.typ).toBe("at+jwt");
  expect(claims.iss).toBe(issuer);
  // The audience is what makes the token useless anywhere but `/api/mcp`. An audience-less token
  // would have been opaque rather than a JWT, and nothing in the route could have verified it.
  expect(audienceList(claims.aud)).toContain(mcpResource);

  const accessToken = tokens.access_token ?? "";

  const listed = await mcpCall(agent, accessToken, "tools/list");
  expect(listed.result?.tools?.map((tool) => tool.name)).toEqual(TIME_TOOLS);

  const context = await mcpCall(agent, accessToken, "tools/call", {
    name: "time_get_context",
    arguments: {},
  });

  const structured = context.result?.structuredContent as TrackingContext | undefined;

  // The actor, read back through the token rather than through a session. Anything else here would
  // mean the tool acted for the wrong member, which is the one failure this whole layer must not
  // have.
  expect(structured?.member?.id).toBe(memberId);
  expect(structured?.member?.timezone).toBe(MEMBER_TIMEZONE);
  // Both time scopes reached the tool, so the consent that was given is the access that exists.
  expect(structured?.scopes).toEqual(expect.arrayContaining(["time:read", "time:write"]));
});

test(
  "has no WCAG 2.2 AA violations on the consent screen",
  { tag: "@a11y" },
  async ({ agent, page, baseURL, makeAxeBuilder }, testInfo) => {
    test.setTimeout(90_000);

    // Its own client, never allowed: consent is remembered per client and user, so reusing the
    // chain's would show the screen or skip it depending on which test ran first. This one also has
    // to work under `pnpm e2e:a11y`, where the chain test does not run at all.
    const clientId = await registerAgentClient(agent);
    const { challenge } = createPkcePair();

    await visit(
      page,
      authorizeRequestPath({
        clientId,
        challenge,
        state: randomBytes(16).toString("base64url"),
        resource: `${originOf(baseURL)}/api/mcp`,
      }),
    );

    await expect(page.getByRole("heading", { level: 2 })).toHaveText(
      `${CLIENT_NAME} wants to access your Sheet Happens account`,
    );

    const results = await makeAxeBuilder().analyze();

    // Attached so a failure is diagnosable from the report without re-running the suite.
    await testInfo.attach("axe-results.json", {
      body: JSON.stringify(results.violations, null, 2),
      contentType: "application/json",
    });

    expect(results.violations).toEqual([]);
  },
);

test("refuses an unauthenticated call with the pointer a client follows", async ({
  agent,
  baseURL,
}) => {
  const origin = originOf(baseURL);

  const refused = await agent.post("/api/mcp", {
    headers: {
      "Content-Type": "application/json",
      "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
      "Mcp-Method": "tools/list",
    },
    data: { jsonrpc: "2.0", id: 1, method: "tools/list", params: { _meta: REQUEST_META } },
  });

  expect(
    refused.status(),
    `an unauthenticated call answered ${refused.status()}: ${await refused.text()}`,
  ).toBe(401);

  const challenge = refused.headers()["www-authenticate"] ?? "";

  // This header is the entire discovery entry point: an unauthenticated 401 is how Claude learns
  // where the authorization server is, so a 401 without it is a connector that can never connect.
  expect(
    challenge,
    "the 401 carried no WWW-Authenticate header, so a client has nothing to follow",
  ).toContain("resource_metadata=");
  // `MCP_CHALLENGE_SCOPES`, so a step-up asks for exactly the v1 pair rather than everything in
  // `scopes_supported`.
  expect(challenge).toContain('scope="time:read time:write"');

  const metadataUrl = /resource_metadata="([^"]+)"/.exec(challenge)?.[1] ?? "";

  // Present is not enough: the plugin derives this URL from the resource identifier, while what
  // serves it is a route file of ours (`app/.well-known/oauth-protected-resource/api/mcp`). The two
  // agreeing is exactly the thing that can drift, so the pointer is followed rather than matched.
  const served = await agent.get(metadataUrl);
  expect(
    served.ok(),
    `${metadataUrl} answered ${served.status()} — the 401 points at a document nothing serves`,
  ).toBeTruthy();

  const metadata = (await served.json()) as {
    resource?: string;
    authorization_servers?: string[];
    bearer_methods_supported?: string[];
  };

  // Character for character the URL a member pastes into Claude, with no trailing slash: it is also
  // the audience every access token is bound to, so a mismatch here fails every verified call.
  expect(metadata.resource).toBe(`${origin}/api/mcp`);
  expect(metadata.authorization_servers).toEqual([`${origin}/api/auth`]);
  expect(metadata.bearer_methods_supported).toEqual(["header"]);
});

test("advertises S256 and client metadata documents at the RFC 8414 alias", async ({
  agent,
  baseURL,
}) => {
  const origin = originOf(baseURL);

  // The path-inserted form. The issuer has a path, so RFC 8414 allows a client to look here while
  // OpenID Connect discovery appends instead — and this is the one Claude tries.
  const response = await agent.get("/.well-known/oauth-authorization-server/api/auth");

  expect(
    response.ok(),
    `the RFC 8414 alias answered ${response.status()}: ${await response.text()}`,
  ).toBeTruthy();

  const metadata = (await response.json()) as {
    issuer?: string;
    code_challenge_methods_supported?: string[];
    client_id_metadata_document_supported?: boolean;
    token_endpoint_auth_methods_supported?: string[];
  };

  expect(metadata.issuer).toBe(`${origin}/api/auth`);
  expect(metadata.code_challenge_methods_supported).toEqual(["S256"]);
  // Claude only identifies itself with Anthropic's hosted client metadata document — rather than
  // registering a client per connection — when it sees this flag *and* `none` among the token
  // endpoint auth methods. They are a pair, so both are asserted.
  expect(metadata.client_id_metadata_document_supported).toBe(true);
  expect(metadata.token_endpoint_auth_methods_supported).toContain("none");
});

/**
 * One short-lived connection to the suite's own database.
 *
 * `pg` directly rather than the generated Prisma client: that client reads `import.meta` at module
 * scope, and Playwright transpiles specs to CommonJS, so importing it here fails at load with
 * "Cannot use 'import.meta' outside a module". `scripts/dev-seed.mjs` talks to the same database
 * the same way.
 *
 * `DATABASE_URL` in this process is a developer's own database or nothing at all —
 * `playwright.config.ts` hands the e2e one to the *server* it starts, not to the test runner — so
 * the URL comes from `e2eDatabaseUrl()`, for the same reason the config uses it.
 */
async function withE2eDatabase<T>(run: (database: Client) => Promise<T>) {
  const database = new Client({ connectionString: e2eDatabaseUrl() });
  await database.connect();

  try {
    return await run(database);
  } finally {
    await database.end();
  }
}

/** `baseURL` is optional in Playwright's types; `playwright.config.ts` always sets it. */
function originOf(baseURL: string | undefined) {
  return new URL(baseURL ?? "http://localhost:3000").origin;
}

/**
 * Registers a public native client the way Claude Code and the MCP Inspector do, and remembers it
 * for cleanup.
 *
 * `token_endpoint_auth_method: "none"` makes it a public client: no secret is minted, so PKCE is
 * the only thing standing between a stolen code and a token — which is the shape this spec should
 * be proving, since it is the shape every Claude surface uses.
 */
async function registerAgentClient(agent: APIRequestContext) {
  const response = await agent.post("/api/auth/oauth2/register", {
    data: {
      client_name: CLIENT_NAME,
      redirect_uris: [CALLBACK_URL],
      application_type: "native",
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: REQUESTED_SCOPE,
    },
  });

  expect(
    response.status(),
    `registration answered ${response.status()}: ${await response.text()} — a 403 means dynamic ` +
      "client registration is off (NODE_ENV, or MCP_ALLOW_DYNAMIC_CLIENT_REGISTRATION in " +
      "`.env.local`), a 429 that this IP has spent the 5-per-minute registration budget",
  ).toBe(201);

  const registered = (await response.json()) as { client_id?: string };

  expect(registered.client_id, "registration returned no client_id").toBeTruthy();

  const clientId = registered.client_id ?? "";
  registeredClientIds.push(clientId);

  return clientId;
}

/** A PKCE pair. `S256` only — the provider advertises nothing else, and `plain` is not allowed. */
function createPkcePair() {
  const verifier = randomBytes(32).toString("base64url");

  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

function authorizeRequestPath({
  clientId,
  challenge,
  state,
  resource,
}: {
  clientId: string;
  challenge: string;
  state: string;
  resource: string;
}) {
  const query = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: CALLBACK_URL,
    scope: REQUESTED_SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource,
  });

  return `/api/auth/oauth2/authorize?${query.toString()}`;
}

/**
 * Clicks Allow and returns the loopback URL the provider sent the browser to.
 *
 * The redirect target is the client's own `redirect_uri`, which in a native flow is a port on the
 * agent's machine — so `ConsentForm` performs a real navigation rather than a `router.push`, and
 * nothing is listening at the other end. The route handler answers it with a stub page so the
 * navigation commits and `page.url()` holds the whole query; the alternative, letting it fail with
 * ERR_CONNECTION_REFUSED, leaves the parameters only in a request that never completed.
 *
 * The click is retried because the buttons are in the DOM before React hydrates, so an early click
 * lands on markup with no handler and silently does nothing. The URL is checked *before* clicking
 * so a slow navigation is waited out rather than clicked again — consent is not idempotent, and a
 * second submit would mint a second authorization code.
 */
async function allowAndCaptureCallback(page: Page) {
  const isCallback = (url: URL) => url.href.startsWith(CALLBACK_URL);

  await page.route(isCallback, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<title>Agent callback</title>",
    }),
  );

  const allow = page.getByRole("button", { name: "Allow" });

  await expect(async () => {
    if (!page.url().startsWith(CALLBACK_URL)) {
      await allow.click();
    }

    /*
     * `domcontentloaded`, not the default `load`, for the same reason `visit` in `e2e/fixtures.ts`
     * does: under several parallel workers the Turbopack dev server leaves chunk and HMR requests
     * hanging, so `load` never fires and the wait times out against a page that has already
     * navigated. The stub page fulfilled above has no subresources at all, which makes the
     * distinction pure luck rather than something to rely on.
     */
    await page.waitForURL(isCallback, { timeout: 10_000, waitUntil: "domcontentloaded" });
  }).toPass({ timeout: 60_000 });

  return new URL(page.url());
}

/** Only the fields asserted below; `time_get_context` returns a great deal more. */
type TrackingContext = {
  member?: { id?: string; timezone?: string };
  scopes?: string[];
};

type JwtHeader = { typ?: string };
type AccessTokenClaims = { iss?: string; aud?: unknown };

function decodeAccessToken(token: string): [JwtHeader, AccessTokenClaims] {
  const segments = token.split(".");

  expect(
    segments,
    "the access token is not a JWT — an audience-less token would have been issued opaque",
  ).toHaveLength(3);

  return [decodeSegment(segments[0]) as JwtHeader, decodeSegment(segments[1]) as AccessTokenClaims];
}

function decodeSegment(segment: string): unknown {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}

/** `aud` is a string for one audience and an array for several; RFC 9068 allows both. */
function audienceList(aud: unknown) {
  if (typeof aud === "string") return [aud];

  return Array.isArray(aud) ? aud : [];
}

type JsonRpcResponse = {
  result?: { tools?: { name?: string }[]; structuredContent?: unknown };
  error?: { code?: number; message?: string };
};

/**
 * One JSON-RPC request in the 2026-07-28 envelope.
 *
 * `Mcp-Method` is required on every modern request and `Mcp-Name` on a `tools/call`, where it must
 * mirror `params.name`; the SDK answers a disagreement with `-32020` before the tool is reached.
 * Setting them from the same arguments that build the body is deliberate — a spec that spelled them
 * out twice could pass while a client that derives them fails.
 */
async function mcpCall(
  agent: APIRequestContext,
  accessToken: string,
  method: string,
  params: Record<string, unknown> = {},
) {
  const name = typeof params.name === "string" ? params.name : undefined;

  const response = await agent.post("/api/mcp", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
      "Mcp-Method": method,
      ...(name === undefined ? {} : { "Mcp-Name": name }),
    },
    data: {
      jsonrpc: "2.0",
      id: 1,
      method,
      params: { ...params, _meta: REQUEST_META },
    },
  });

  expect(
    response.ok(),
    `${name ?? method} answered ${response.status()}: ${await response.text()}`,
  ).toBeTruthy();

  const body = (await response.json()) as JsonRpcResponse;

  // A JSON-RPC error arrives with HTTP 200, so `ok()` above says nothing about it. Reported here
  // rather than left to a confusing `undefined` in the caller's assertion.
  expect(
    body.error,
    `${name ?? method} answered a JSON-RPC error: ${JSON.stringify(body.error)}`,
  ).toBeUndefined();

  return body;
}
