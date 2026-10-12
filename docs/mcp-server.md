# MCP Server Layer — Time Tracking for AI Agents

**Status:** implemented 2026-09-07 (P0–P3). This is the design record _and_ the record of what the
implementation had to change: §16 marks every decision as settled, and **§18 lists every place
reality diverged from the design below, with the evidence**. Where a section here and §18 disagree,
§18 is right — it was written against a running server.
**Surface:** `app/api/mcp/route.ts` (the MCP endpoint), `src/server/mcp/**` (toolsets, actor
context, error mapping), Better Auth as OAuth 2.1 authorization server (`src/server/auth/auth.ts`),
a new `/consent` page, `.well-known` discovery documents, a "Connected apps" section in `/settings`
**Relationship to other docs:** builds on `docs/domain-model.md` (editable-period rule,
authorization invariants), `docs/auth-user-management.md` (Better Auth vs. domain ownership
boundary) and `docs/railway-projects.md` (one web service per environment). It reuses
`src/server/time-tracking` as-is except for the small additions in §9. The comment in
`src/server/reports/reports.ts` about "the read-only MCP endpoint when it is built" is honoured in
§15 (future toolsets). Everything below was checked against the MCP specification, Anthropic's
connector documentation and the installed packages on 2026-09-07; §17 lists the sources.

---

## 0. In one paragraph

Sheet Happens gets a remote MCP server at `https://sheet.example.com/api/mcp`, served by the same
Next.js process as the web app, protected by OAuth 2.1 with Sheet Happens itself as the
authorization server (Better Auth's OAuth provider), and speaking both the current stateless MCP
revision (2026-07-28) and the older handshake-based revisions that Claude.ai still uses today. A
user connects it from Claude.ai, Claude Desktop, Cowork or Claude Code by pasting one URL; Claude
discovers the authorization server, the user signs in with the existing login (magic link, passkey
or password plus 2FA), sees a Hungarian or English consent page, and from then on the agent acts as
that member with exactly that member's rights — never more. The first release ships one **toolset**,
`time`, with ten tools: read context, list entries, summarise a day/week/month, create, update,
delete and restore entries, and start, stop and inspect the timer. Every tool is a thin adapter over
the existing `src/server/time-tracking` functions, so period locks, the 24-hour daily cap, tracking
modes and audit logging apply unchanged. Toolsets are the extension unit: a future `admin` or
`timesheets` toolset is a folder, a scope and one registry line.

## 1. Goals and non-goals

Goals for the first release:

- Any active member can let an AI agent manage **their own** time tracking: add, update, delete
  (and undo) entries, start and stop the timer, and pull day/week/month figures for insight.
- Connecting is a paste-the-URL experience on every Claude surface (Claude.ai web, Desktop, mobile,
  Cowork, Claude Code) with no client id or secret to copy around.
- The server is a first-class MCP citizen: current spec revision, correct OAuth discovery, tool
  annotations, structured output, machine-readable errors, and a deterministic tool list.
- The architecture is a registry of toolsets so that admin and cross-member features can be added
  later without touching the transport or auth layers.

Non-goals for the first release (explicitly deferred, see §15):

- Admin tools, cross-member reads or writes, timesheet or invoice workflows, report export.
- Monthly hour declarations (`DECLARED` tracking mode): declared projects are visible in the context
  tool but cannot be written through MCP.
- MCP resources and prompts (the spec allows them; Claude surfaces expose them unevenly; §15 keeps
  the hooks).
- A separate MCP process or domain: one Next.js service is the deployment unit
  (`docs/railway-projects.md`).

## 2. The landscape this design is built on (2026-09-07)

These facts change the design and are easy to get wrong from memory.

### 2.1 The protocol went stateless on 2026-07-28

The MCP specification revision `2026-07-28` removed protocol-level sessions and the `initialize`
handshake. Every request carries its protocol version and client identity in `_meta`, the HTTP
transport is **POST-only** (a legacy `GET` or `DELETE` is answered with `405`), the `Mcp-Method` and
`Mcp-Name` headers are required and must match the body, list results carry `ttlMs` and
`cacheScope`, every result carries `resultType`, and a server **must** implement
`server/discover`. Sampling, elicitation and roots became "multi round-trip" results instead of
server-initiated requests, and SSE resumability (`Last-Event-ID`) is gone. Roots, Sampling and
Logging are deprecated. Dynamic Client Registration (RFC 7591) is deprecated in favour of Client
ID Metadata Documents (CIMD), with at least a twelve-month window.

Revisions `2025-03-26` through `2025-11-25` ("legacy") still use `initialize`, may mint an
`Mcp-Session-Id`, and may open a standalone `GET` SSE stream. The spec defines a **dual-era
server** that serves both from one endpoint: a request carrying modern `_meta` is served
statelessly, an `initialize` request selects legacy semantics.

### 2.2 Where Claude's clients are

- Claude Code (v2.1.232+) runs an "MCP v2 runtime" that asks HTTP servers whether they speak
  `2026-07-28` and falls back to the legacy handshake if not. Older Claude Code builds and the v1
  runtime are legacy-only.
- Claude.ai, Desktop, mobile and Cowork share one connector broker. Anthropic's announcement says
  `2026-07-28` support "is being rolled out across Claude products soon" and gives no sunset for
  legacy revisions.

Conclusion: **the server must be dual-era.** A modern-only server would break Claude.ai today; a
legacy-only server would work but would be on the deprecation track from day one.

### 2.3 The TypeScript SDK split in two

- `@modelcontextprotocol/sdk` **1.30.0** (2026-07-27) is the classic line. It speaks legacy
  revisions only (up to `2025-11-25`), receives fixes for at least six months, and its
  `WebStandardStreamableHTTPServerTransport` works with Web `Request`/`Response`.
- `@modelcontextprotocol/server` **2.0.0** (stable 2026-07-29, with `@modelcontextprotocol/client`
  and framework middlewares) implements `2026-07-28` and answers the legacy `initialize` handshake as
  well. Its HTTP entry point is `createMcpHandler(factory, { legacy })` returning `{ fetch }`; the
  `legacy` option defaults to `"stateless"` (each legacy request served from a fresh server
  instance, no sessions, legacy `GET`/`DELETE` answered `405`) and can be set to `"reject"`. The
  factory runs once per request, so a fresh `McpServer` serves every call; auth information is
  passed as the second argument of `fetch` and read in tool handlers as `ctx.http.authInfo`.
  `inputSchema` must be a `z.object(...)`; `structuredContent` is validated against `outputSchema`
  before the result leaves the server.

Vercel's `mcp-handler` 2.x is a thin wrapper over the same package (no Redis, no SSE transport). It
adds nothing this app needs, so the design uses `@modelcontextprotocol/server` directly — which is
also exactly what Better Auth's own MCP documentation shows.

### 2.4 What Claude requires from the authorization server

From Anthropic's connector documentation (authentication, lazy authentication, custom connectors):

- Supported client registration: **DCR and CIMD out of the box**, pre-registered client id (secret
  optional) per organisation, or Anthropic-held credentials for directory partners. Claude chooses
  CIMD **only** when the authorization server metadata advertises both
  `"client_id_metadata_document_supported": true` and `"none"` in
  `token_endpoint_auth_methods_supported`; otherwise it falls back to DCR. Anthropic recommends CIMD
  over DCR because DCR registers a new client on every fresh connection.
- PKCE `S256` on every authorization request; metadata must list
  `"code_challenge_methods_supported": ["S256"]`.
- Redirect URI for hosted surfaces (Claude.ai web, Desktop, mobile, Cowork):
  `https://claude.ai/api/mcp/auth_callback`. Claude Code is a native client with an RFC 8252
  loopback redirect on an ephemeral port; its CIMD (`https://claude.ai/oauth/claude-code-client-metadata`)
  declares `http://localhost/callback` and `http://127.0.0.1/callback`, so the port must be
  ignored when matching.
- The refusal of an unauthenticated request must be an HTTP **401** with
  `WWW-Authenticate: Bearer resource_metadata="…", scope="…"`; a `200` with `isError: true` never
  triggers sign-in. A `403` with `error="insufficient_scope"` triggers scope step-up.
- The protected resource metadata's `resource` must equal the URL the user typed, character for
  character; `authorization_servers[0]` is the only entry Claude uses; the authorization server must
  serve RFC 8414 or OpenID Connect discovery at its well-known paths.
- Token endpoint must accept `application/x-www-form-urlencoded`; refresh tokens should rotate;
  a dead refresh token must answer `invalid_grant`. Claude appends `offline_access` when the server
  advertises it, refreshes reactively on 401 and proactively five minutes before expiry.
- Discovery, registration and token endpoints must answer within **10 seconds**; refresh within 30.
- Requests come from `160.79.104.0/21`; the server must be reachable from the public internet
  (localhost needs a tunnel for Claude.ai; Claude Code can talk to `http://localhost:3000` directly).
- Discovery documents are cached globally by URL for about five minutes.

### 2.5 Better Auth: installed vs. current

- Was installed: `better-auth@1.6.23` with `magicLink`, `passkey`, `twoFactor`, `nextCookies`. Its
  bundled `mcp` plugin (`better-auth/plugins`) wraps the old `oidc-provider`: DCR only, no CIMD, no
  revocation endpoint, consent shown only when the client sends `prompt=consent`, client secrets
  stored in plain text by default, and `withMcpAuth` hands the handler a database token row.
- **Now installed: `better-auth@1.7.3`** (with `@better-auth/passkey` and
  `@better-auth/prisma-adapter` moved in step), plus `@better-auth/mcp@1.7.3`,
  `@better-auth/cimd@1.7.3` and `@modelcontextprotocol/server@2.0.0`. 1.7.3 removed `oidcProvider`
  and split the OAuth server into
  `@better-auth/oauth-provider` (OAuth 2.1: PKCE required, RFC 9207 `iss`, refresh-token rotation
  with replay detection, RFC 7009 revocation, RFC 7662 introspection, RFC 8707 resources, JWT access
  tokens with `aud` = resource via the `jwt` plugin) plus `@better-auth/mcp` (the `mcp()` plugin
  taking `loginPage`, `consentPage`, `resource`, `scopes` and `allowDynamicClientRegistration`;
  `requireMcpAuth` with `resource`, `requiredScopes` and `challengeScopes` returning 401/403
  challenges; and `createInsufficientScopeError` for step-up) and `@better-auth/cimd` (CIMD with the
  `"mcp-2026-07-28"` profile, SSRF-hardened fetching, native-client loopback matching "with any
  port"). The caret range `^1.6.23` already permits 1.7.x; nothing in this repo uses `oidcProvider`,
  so the removal does not affect us.

Decision 1 in §16 recommended building on 1.7.x, and that is what shipped. The bump was **not** the
clean minor the phasing assumed — it broke three files in this repo. See §18.1.

## 3. Architecture

One process, one endpoint, one authorization server, a registry of toolsets. Nothing runs outside
the existing Railway web service.

```
Claude.ai · Desktop · Cowork · Claude Code                 Sheet Happens (Next.js 16, one Railway service)
──────────────────────────────────────────                 ──────────────────────────────────────────────────
① POST /api/mcp (no token) ─────────────────────────────▶  app/api/mcp/route.ts
                                                            ├─ originValidationResponse()          403 if Origin present and foreign
                                                            └─ requireMcpAuth() ───────────────▶  401  WWW-Authenticate: Bearer
                                                                                                    resource_metadata="…/.well-known/oauth-protected-resource/api/mcp",
                                                                                                    scope="time:read time:write"
② GET /.well-known/oauth-protected-resource/api/mcp ────▶  { resource: "https://sheet.example.com/api/mcp",
                                                              authorization_servers: ["https://sheet.example.com/api/auth"] }
③ GET /api/auth/.well-known/oauth-authorization-server ─▶  { authorization_endpoint, token_endpoint, code_challenge_methods_supported:["S256"],
                                                              client_id_metadata_document_supported: true, token_endpoint_auth_methods_supported:["none",…] }
④ browser → /api/auth/oauth2/authorize?client_id=https://claude.ai/…&code_challenge=…&resource=…&scope=…
      ├─ no session ──▶ /login (existing: magic link · passkey · password + 2FA) ──▶ back to authorize
      └─ session ─────▶ /consent (new, HU/EN, same active-member gate as /time) ──▶ redirect_uri?code=…&iss=…
⑤ POST /api/auth/oauth2/token (code + PKCE verifier + resource) ─▶ JWT access token (aud = /api/mcp, 1 h) + rotating refresh token (30 d)
⑥ POST /api/mcp  Authorization: Bearer <jwt> ────────────▶  requireMcpAuth ✓ (signature, iss, aud, exp, required scope)
   MCP-Protocol-Version · Mcp-Method · Mcp-Name             ├─ resolveMcpActor()  claims.sub → Member (ACTIVE, not deleted, linked)
                                                            ├─ toolScopeGate()    tool → scope; 403 insufficient_scope if missing
                                                            ├─ rateLimit()        429 + Retry-After
                                                            └─ createMcpHandler(factory, { legacy: "stateless" }).fetch(req, { authInfo })
                                                                 └─ McpServer built per request from the toolsets the actor may use
                                                                      └─ time toolset ──▶ src/server/time-tracking/* ──▶ Prisma ──▶ Postgres
```

Layering rule, same as the rest of the app: the route handler authenticates and authorises, the
MCP layer validates arguments with Zod and adapts shapes, and all business rules stay in
`src/server/time-tracking`. No tool talks to Prisma directly.

## 4. Authorization

### 4.1 Plugin wiring

`src/server/auth/auth.ts` gains three plugins next to the existing ones — as shipped:

```ts
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { mcp } from "@better-auth/mcp";
import { jwt, magicLink, twoFactor } from "better-auth/plugins";

import { authUrls } from "@/src/server/auth/auth-urls";
import { isDynamicClientRegistrationEnabled } from "@/src/server/mcp/config";
import { MCP_SCOPES } from "@/src/server/mcp/scopes";

plugins: [
  magicLink(/* unchanged */), passkey(/* unchanged */), twoFactor(/* unchanged */),
  jwt({
    // The session JWT header on /get-session is noise beside an OAuth provider.
    disableSettingJwtHeader: true,
    // Pinned, NOT defaulted: `getIssuer` falls back to `ctx.baseURL`, which is EMPTY outside
    // production because this app uses a dynamic `baseURL` there. See §18.2.
    jwt: { issuer: authUrls.issuer },
  }),
  mcp({
    loginPage: "/login",
    consentPage: "/consent",
    resource: authUrls.mcpResource,          // `${authOrigin}/api/mcp`
    scopes: [...MCP_SCOPES],
    allowDynamicClientRegistration: isDynamicClientRegistrationEnabled(),
    // Also required, or DCR is useless: a tool registering itself has no session and no
    // initial access token. See §18.6.
    allowUnauthenticatedClientRegistration: isDynamicClientRegistrationEnabled(),
  }),
  cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" }),
  nextCookies(),                             // stays last
],
```

`mcp()` **is** the OAuth provider; `oauthProvider()` must not be registered alongside it. The
provider's own per-endpoint rate limits (token, authorize, register, revoke) apply on top of the
global Better Auth `rateLimit` block that already exists.

`authOrigin` was module-private in `auth.ts`. It now lives in **`src/server/auth/auth-urls.ts`**,
which exports `authOrigin`, `authHost`, `authHostname`, `getAuthOrigin()` and an `authUrls` object
(`origin`, `issuer`, `jwks`, `mcpResource`). It is a separate module rather than another export from
`auth.ts` so that `src/server/mcp` and its unit tests can read a URL without importing the whole
Better Auth instance — which, since the OAuth provider seeds its resource row during plugin init,
would mean a database write at module load.

### 4.2 Endpoints and discovery documents

With production origin `https://sheet.example.com` (development:
`https://<service>-<environment>.up.railway.app`, local: `http://localhost:3000`):

| Purpose                                                                            | URL                                                                              | Served by                                                                                                                         |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| MCP endpoint = protected resource identifier                                       | `/api/mcp`                                                                       | `app/api/mcp/route.ts` (POST; GET/DELETE answer 405 via the SDK)                                                                  |
| Protected resource metadata, path-suffixed (Claude probes this first)              | `/.well-known/oauth-protected-resource/api/mcp`                                  | `app/.well-known/oauth-protected-resource/api/mcp/route.ts` → `auth.handler(request)`. **A rewrite cannot work here** — see §18.3 |
| Protected resource metadata, root                                                  | `/.well-known/oauth-protected-resource`                                          | `app/.well-known/oauth-protected-resource/route.ts` → `auth.handler(request)`                                                     |
| Issuer                                                                             | `https://sheet.example.com/api/auth`                                            | Better Auth `baseURL` + `basePath` (the plugin's default)                                                                         |
| AS metadata, issuer-appended                                                       | `/api/auth/.well-known/oauth-authorization-server`                               | Better Auth                                                                                                                       |
| AS metadata, RFC 8414 path-inserted alias                                          | `/.well-known/oauth-authorization-server/api/auth`                               | `app/.well-known/oauth-authorization-server/api/auth/route.ts` → `auth.handler(request)`                                          |
| OpenID Connect discovery                                                           | `/api/auth/.well-known/openid-configuration`                                     | Better Auth (works with no extra routing because the issuer has a path)                                                           |
| JWKS                                                                               | `/api/auth/jwks`                                                                 | `jwt` plugin                                                                                                                      |
| Authorize · token · consent · revoke · introspect · userinfo · register (dev only) | `/api/auth/oauth2/{authorize,token,consent,revoke,introspect,userinfo,register}` | Better Auth via the existing `app/api/auth/[...all]/route.ts`                                                                     |

All three are **thin route handlers that hand the untouched request to `auth.handler`**, not
rewrites, and `next.config.ts` is unchanged. The plugin renders the documents, so nothing about
them can drift from the plugin's configuration; the route exists only to get the request to it.
`.well-known` works as a literal nested folder in Next 16 — only `_`-prefixed path parts are
excluded from routing. §18.3 explains why a rewrite is not an option for the PRM.

Both confirmations the design asked for came back good, verified against a running server:

- The `resource_metadata` URL in the 401 challenge is
  `<origin>/.well-known/oauth-protected-resource/api/mcp` — exactly the path served above.
- The PRM document carries `bearer_methods_supported: ["header"]` and
  `scopes_supported: ["time:read", "time:write"]` (the plugin filters the OIDC scopes out of it),
  with `resource` equal to the URL a user types.

The **resource identifier is the exact URL users type**. The doc, the connector setup text (§12) and
the `resource` option must all say `https://sheet.example.com/api/mcp` with no trailing slash.

### 4.3 Client registration: CIMD first

- Production advertises CIMD and `none` as token endpoint auth method, so every Claude surface
  identifies itself with Anthropic's hosted client metadata document; no client is stored per
  connection, and the consent page shows the client as the **host of the `client_id` URL**
  (`claude.ai`), as the CIMD draft requires.
- DCR stays **off in production** (deprecated by the spec, registers a client per fresh connection,
  not usable with Enterprise Managed Auth). It is **on in development and the e2e database** so the
  MCP Inspector and the e2e OAuth spec can register themselves (§14).
- An organisation admin may still paste a pre-registered client id in Claude's "Use your own OAuth
  client" field; nothing in this design prevents that, but nothing needs it either.
- Redirect URI matching follows the metadata document: exact match for `https://claude.ai/api/mcp/auth_callback`,
  port-agnostic loopback match for Claude Code's `http://localhost/callback` and
  `http://127.0.0.1/callback` (Better Auth: "a `native` client may use … an `http` loopback URI on
  exactly `localhost`, `127.0.0.1`, or `[::1]` with any port").

### 4.4 Scopes

```ts
export const MCP_SCOPES = [
  "openid",
  "profile",
  "offline_access",
  "time:read",
  "time:write",
] as const;
```

| Scope                           | Grants                                                         | Used by                                                                 |
| ------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `time:read`                     | read the actor's own context, entries, timer, summaries        | `time_get_context`, `time_list_entries`, `time_summary`, `timer_status` |
| `time:write`                    | create/update/delete/restore own entries; start/stop own timer | the six mutating tools                                                  |
| `openid profile offline_access` | standard: identity claims and a refresh token                  | Better Auth                                                             |

Reserved names for later toolsets, never granted in v1: `reports:read`, `timesheets:read`,
`admin:read`, `admin:write`. The 401 challenge advertises `scope="time:read time:write"`
(`challengeScopes`) so Claude asks for exactly the v1 set instead of everything in
`scopes_supported`. `requireMcpAuth` enforces `time:read` for every request; the per-tool gate (§5)
enforces `time:write` with a `403 insufficient_scope` challenge that lists **both** scopes, because
Claude does not reliably carry earlier scopes into a step-up consent.

### 4.5 Login and consent

1. Claude opens `/api/auth/oauth2/authorize?client_id=…&redirect_uri=…&code_challenge=…&code_challenge_method=S256&resource=https://sheet.example.com/api/mcp&scope=…&state=…`.
2. No Better Auth session: the provider redirects to `/login` with **the entire authorization
   request signed into the query string**. There is no continuation endpoint for this —
   `/oauth2/continue` handles only `select_account`/`create`/`postLogin`. See §18.4 for what the
   hand-off actually is and why this app cannot use the provider's own mechanism.
3. Session exists: the provider redirects to **`/consent`** (new page, Server Component +
   one client form). The page calls `requireActiveAppMember("/consent?…")` first, so an invited,
   inactive, deleted or not-yet-2FA member is bounced exactly as on `/time`; MCP never becomes a
   side door around the account status machine or the security-setup requirement. The page shows
   the client host, the requested scopes in plain HU/EN wording, and Allow/Deny. Allow posts to
   `/api/auth/oauth2/consent`; the provider stores the grant in `oauthConsent` and answers with the
   client redirect carrying `code` and `iss`. That answer is `{ redirect: true, url }`, **not**
   `{ redirect_uri }` as the plugin's own JSDoc claims (§18.5), and the POST must carry the signed
   query as `oauth_query` plus an `Origin` header.
4. Claude exchanges the code with the PKCE verifier and the `resource` parameter and receives a JWT
   access token (`aud` = `https://sheet.example.com/api/mcp`, 1 h) and a refresh token (30 d,
   rotated on every use, replay-detected).

Consent is remembered per client, user and scope set: verified live, a second authorization whose
scopes are already covered skips the page entirely and comes straight back with a code. No
auto-accept workaround was needed.

### 4.6 Verifying a call

`requireMcpAuth` verifies the bearer JWT against the JWKS (signature, `iss`, `aud` = resource,
`exp`) and the required scope, then calls our handler with the verified claims. The route then
resolves the **actor**:

```ts
export type McpActor = {
  member: AppMember; // Member row: id, role, currentProfile, timezone, locale, durationDisplayFormat, defaultTrackingMode
  authUserId: string; // claims.sub
  scopes: ReadonlySet<McpScope>; // parsed from claims.scope
  clientId: string; // CIMD URL or DCR id — audit + logging
  tokenId: string; // claims.jti — rate-limit key + audit correlation
  requestMetadata: TimeTrackingRequestMetadata; // { ipAddress, userAgent: clientInfo, channel: "MCP", clientId }
};
```

`resolveMcpActor` mirrors `getCurrentMember` (`prisma.member.findUnique({ where: { authUserId } })`)
and requires `status === "ACTIVE"` and `deletedAt === null`. A token whose member is no longer
active gets a **401 `invalid_token`** so the client drops it; the re-authentication then fails at
login, which is the correct end state. Tokens are not sessions, so this per-call check is the only
place where deactivation takes effect between refreshes; §15 adds proactive revocation on
deactivation.

The actor is passed to the SDK as `authInfo` (`{ token, clientId, scopes, expiresAt, resource,
extra: { actor } }`) **and** closed over by the per-request server factory, so toolsets receive a
typed actor and never re-read headers.

### 4.7 Lifetimes, refresh, revocation, "Connected apps"

- Access token 1 h, refresh token 30 d with rotation (`refreshTokenReuseInterval` 30 s default for
  MCP clients), authorization code 10 min. These are the provider defaults; decision 10 in §16.
- Refresh failures answer `invalid_grant`, which Claude expects; token endpoint accepts form
  encoding (Better Auth does).
- `/api/auth/oauth2/revoke` (RFC 7009) is available; the settings UI in §15 uses the provider's
  consent-management endpoints to list and disconnect clients so a member can see "Claude — connected
  2026-09-07 — time:read time:write — Disconnect".

### 4.8 Enterprise Managed Auth (future)

If the company connects Claude Team/Enterprise seats through SSO, the connector can be made
consent-free per user: the authorization server must accept
`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`, advertise it in `grant_types_supported`,
and keep a per-tenant allowlist of trusted identity-provider issuers. It requires CIMD or
Anthropic-held credentials (not DCR), which this design already satisfies. Not in scope; noted so
that no v1 decision blocks it.

## 5. Transport and the route handler

`app/api/mcp/route.ts` contains no tool logic. The shipped shape, with the two corrections §18
explains:

```ts
// `createMcpProtectedRequestHandler`, NOT `requireMcpAuth` — §18.2.
const protectedHandler = createMcpProtectedRequestHandler(
  {
    issuer: authUrls.issuer,
    audience: authUrls.mcpResource,
    jwksUrl: authUrls.jwks,
    requiredScopes: ["time:read"],
    challengeScopes: ["time:read", "time:write"],
    dpop: { replayStore: createDpopReplayStore(internalAdapter) },
  },
  async (request, claims) => {
    const actor = await resolveMcpActor(claims, request);   // 401 invalid_token if not ACTIVE
    const body = await request.clone().json().catch(() => undefined);
    const needed = requiredScopeForRequest(request, body);  // Mcp-Name, or params.name for legacy

    if (needed && !actor.scopes.has(needed)) throw createInsufficientScopeError([needed]);

    const limited = mcpRateLimit.check(actor.member.id);
    if (!limited.allowed) return jsonRpcError(429, …, { "Retry-After": … });

    return buildMcpHandler(actor).fetch(request, { authInfo: authInfoFor(actor), parsedBody: body });
  },
);

export async function POST(request: Request) {
  // Positional hostname array, not `{ allowedOrigins }` — §18.7.
  return originValidationResponse(request, allowedOriginHostnames) ?? handle(request);
}

// Answered here rather than by the SDK, so an unauthenticated browser visit gets 405 not 401.
export const GET = () => methodNotAllowed();
export const DELETE = () => methodNotAllowed();
```

The handler is built lazily on the first request, not at module scope: the DPoP replay store needs
`await auth.$context`, and resolving that at module load would move Better Auth's plugin init — and
its resource-seeding database write — into module evaluation.

Transport facts the implementation relies on:

- `buildMcpHandler(actor)` calls `createMcpHandler(() => buildServer(actor), { legacy: "stateless" })`.
  Modern clients are served per the 2026-07-28 rules (`_meta`, `server/discover`, `Mcp-Method`
  validation, `ttlMs`/`cacheScope`); legacy clients get their `initialize` answered and every
  request served from a fresh instance with no session id. No session store, no Redis, no sticky
  routing — the single Railway instance and any future scale-out behave identically.
- Origin: Anthropic's servers and Claude Code send no `Origin`; browsers do. A present, foreign
  `Origin` is refused with 403 (spec MUST). `trustedOrigins` in Better Auth keeps protecting the
  OAuth endpoints; confirm the token endpoint accepts server-to-server posts without an `Origin`
  (OAuth clients never send one).
- Responses: the SDK returns `application/json` or a request-scoped SSE stream; it sets
  `X-Accel-Buffering: no` on streams. The Docker/Node runtime streams natively; `maxDuration` is not
  needed on Railway but is the lever if the deployment target ever changes.
- Tool calls are short (single Prisma transactions); nothing in v1 needs the Tasks extension or
  progress notifications.

## 6. Module layout and the extension model

```
src/server/mcp/
  index.ts                 public surface: buildMcpHandler, resolveMcpActor, requiredScopeForRequest, mcpRateLimit
  actor.ts                 McpActor type, resolveMcpActor(claims, request), toAuthInfo(actor)
  scopes.ts                MCP_SCOPES, McpScope, scopeForTool(name)
  registry.ts              TOOLSETS: readonly Toolset[]; buildServer(actor) registers every toolset the actor may use
  server.ts                buildMcpHandler(actor) → createMcpHandler(factory, { legacy: "stateless" })
  results.ts               ok(structured, text) / fail(code, message, details?) → CallToolResult
  errors.ts                mapDomainError(error) → { code, message } (§8)
  rate-limit.ts            per-member sliding window (§11)
  schemas/                 shared Zod pieces: isoDate, hhmm, entryView, projectRef, dayTotal
  toolsets/
    time/
      index.ts             export const timeToolset: Toolset
      get-context.ts       one file per tool: schema + handler + description
      list-entries.ts
      summary.ts
      create-entry.ts
      update-entry.ts
      delete-entry.ts
      restore-entry.ts
      timer-start.ts
      timer-stop.ts
      timer-status.ts
      *.test.ts            colocated unit tests with a fake actor and mocked domain functions
app/api/mcp/route.ts       §5
app/consent/page.tsx       §4.5 (+ ConsentForm.tsx client component)
```

The unit of extension is a **toolset**:

```ts
export type Toolset = {
  id: string; // "time", later "admin", "timesheets", "reports"
  requiredScope: McpScope; // registered only when the token holds it
  isAllowed?: (actor: McpActor) => boolean; // e.g. actor.member.role === "ADMIN" for admin toolsets
  register: (server: McpServer, actor: McpActor) => void;
};
```

`buildServer(actor)` iterates `TOOLSETS`, skips those the actor's scopes or role do not permit, and
lets each register its tools. Because the server is built per request, `tools/list` already reflects
the caller — a member never sees an admin tool — and the list is marked `cacheScope: "private"`.
Registration order is fixed and tool files export their definitions in a fixed order, so the list
is deterministic (the spec asks for that to keep client prompt caches warm).

Adding a toolset later is: a folder under `toolsets/`, a scope constant, one line in
`registry.ts`, the scope in `MCP_SCOPES` and the PRM, HU/EN wording for the scope on the consent page,
QA scenarios, and a `pnpm verify` run. The transport, auth, actor and error layers do not change.

## 7. The `time` toolset

### 7.1 Conventions shared by every tool

- **Names** are `snake_case` with a domain prefix (`time_`, `timer_`). Claude Code exposes them as
  `mcp__sheet-happens__time_create_entry`; Claude.ai groups them under the connector. Prefixing
  keeps them unambiguous when a user has several connectors, and doubles as the toolset grouping.
- **Dates** are `YYYY-MM-DD` in the member's own timezone (`Member.timezone`, the same authority the
  web app uses). The server never parses relative words; `time_get_context` returns `today`, the
  current week and month, so the model does the arithmetic. **Times** are `HH:mm`, 24-hour, local.
- **Durations** are integer minutes in inputs (`durationMinutes`). Outputs carry both
  `durationMinutes` and `durationText`, formatted with `src/lib/duration`'s `formatDurationForInput`
  in the member's `durationDisplayFormat`, so the agent can quote the number the user is used to.
- **Projects** are addressed by `projectId`; the context tool lists ids and names. Wrong or
  unavailable ids fail with `PROJECT_NOT_AVAILABLE` and the hint to call `time_get_context`.
- **Entry view** (one Zod schema in `schemas/entry.ts`, reused as `outputSchema` fragment) with the
  fields `id`, `date`, `projectId`, `projectName`, `durationMinutes`, `durationText`, `startTime`,
  `endTime`, `description`, `source`, `locked` and `updatedAt`. Declared-hours rows
  (`source: "DECLARED"`) appear only when explicitly requested and are always `locked: true` from
  MCP's point of view.
- **Every result** has `structuredContent` (validated against `outputSchema`) **and** a compact
  text block (one line per entry, one line per total), because legacy clients and some UIs show only
  text. Text never contains instructions, only data.
- **Every mutation** passes `memberId: actor.member.id` and `actorMemberId: actor.member.id` (the
  same structural guard the Server Actions use — a member cannot write against anyone else) plus
  `requestMetadata` with `channel: "MCP"` and the OAuth client id, so audit rows say who acted and
  through what.
- **Annotations** are set explicitly on every tool, because the spec's defaults assume the worst
  (`destructiveHint: true`, `openWorldHint: true`). All tools are `openWorldHint: false`.

### 7.2 Tool by tool

| Tool                 | Scope | Annotations (readOnly / destructive / idempotent)              | Domain call                                                       |
| -------------------- | ----- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| `time_get_context`   | read  | ✓ / – / ✓                                                      | `getMemberTrackingContext` (new, §9) + `getRunningTimerForMember` |
| `time_list_entries`  | read  | ✓ / – / ✓                                                      | `listMemberTimeEntries` (new, §9)                                 |
| `time_summary`       | read  | ✓ / – / ✓                                                      | `summarizeMemberTime` (new, §9) reusing `buildMonthOverview`      |
| `time_create_entry`  | write | – / – / –                                                      | `createTimeEntry({ source: "MCP" })`                              |
| `time_update_entry`  | write | – / ✓ / ✓                                                      | `updateTimeEntry`                                                 |
| `time_delete_entry`  | write | – / ✓ / ✓ · `_meta["anthropic/requiresUserInteraction"]: true` | `deleteTimeEntry` (soft delete)                                   |
| `time_restore_entry` | write | – / – / ✓                                                      | `restoreTimeEntry`                                                |
| `timer_start`        | write | – / – / –                                                      | `startRunningTimer`                                               |
| `timer_stop`         | write | – / – / –                                                      | `stopRunningTimer`                                                |
| `timer_status`       | read  | ✓ / – / ✓                                                      | `getRunningTimerForMember`                                        |

**`time_get_context`** — "Call this first." No arguments (`z.object({}).strict()`). Returns who the
agent is acting for and everything needed to make valid calls:

```jsonc
{
  "member": {
    "id": "…",
    "displayName": "…",
    "timezone": "Europe/Budapest",
    "locale": "hu",
    "durationDisplayFormat": "DECIMAL_HOURS",
    "profile": "CONTRACTOR",
  },
  "today": "2026-09-07",
  "week": { "start": "2026-09-07", "end": "2026-09-13" },
  "month": { "start": "2026-09-01", "end": "2026-09-30" },
  "limits": {
    "dailySoftWarningMinutes": 480,
    "dailyHardLimitMinutes": 1440,
    "descriptionMaxLength": 1000,
  },
  "projects": [
    {
      "id": "…",
      "name": "Sheet Happens",
      "color": "teal",
      "trackingMode": "TRACKED",
      "canLogTime": true,
      "validFrom": "2026-01-01",
      "validTo": null,
      "recentDescriptions": ["API endpoint implementation", "Sprint planning"],
    },
  ],
  "lockedMonths": ["2026-07"],
  "runningTimer": null,
  "scopes": ["time:read", "time:write"],
}
```

`projects` contains the member's active assignments with the **resolved** tracking mode
(`resolveTrackingMode(member, assignment)`); `canLogTime` is false for `DECLARED` projects and the
description says why. `lockedMonths` comes from `PeriodLock` rows, the same source
`getMemberWeeklyTimeGrid` uses for `lockedMonthStarts`.

`recentDescriptions` is up to five of the member's **own** past descriptions on that project, most
useful first, from `buildDescriptionSuggestions` — the same ranking and the same rules the composer
on `/time` shows the member (`docs/time-entry-suggestions.md` §10), capped tighter because this is a
prompt rather than a panel. It is there so an agent reuses the member's wording instead of
paraphrasing it: a line reading "worked on the API" among thirty saying "API endpoint
implementation" is the outlier a timesheet reviewer stops to ask about. Never another member's
phrasing — the read is member-scoped in the same way every other one here is — and empty for a
project with no history in the last ninety days. Adding it made `time_get_context` a fourth indexed
read (one `groupBy`), and changed the `tools/list` contract baseline, which was regenerated
deliberately.

**`time_list_entries`** — `{ from, to, projectId?, includeDeclared? = false, cursor?, limit? = 100 }`
with `to − from ≤ 92 days` and `limit ≤ 200`. Ordered by date, then start time, then creation.
Returns `{ range, entries, totals: { minutes, entryCount }, nextCursor? }`. Cursor is an opaque
base64 of `(localDate, id)`; the tool description tells the model to page rather than widen the
range. Soft-deleted rows are never returned.

**`time_summary`** — `{ period: "day" | "week" | "month" | "range", date? = today, from?, to?,
compareWithPrevious? = true }`; `range` requires `from`/`to` and is capped at 366 days. Returns
deterministic aggregates; the model narrates the insight:

```jsonc
{
  "period": { "kind": "week", "start": "2026-09-07", "end": "2026-09-13", "locked": false },
  "totals": {
    "trackedMinutes": 1860,
    "declaredMinutes": 0,
    "totalMinutes": 1860,
    "entryCount": 14,
    "daysWithEntries": 4,
    "averageMinutesPerActiveDay": 465,
  },
  "byProject": [
    { "projectId": "…", "name": "…", "minutes": 1200, "entryCount": 9, "share": 0.645 },
  ],
  "byDay": [{ "date": "2026-09-07", "minutes": 510, "entryCount": 4, "overSoftLimit": true }],
  "previous": {
    "start": "2026-08-31",
    "end": "2026-09-06",
    "totalMinutes": 2100,
    "deltaMinutes": -240,
  },
  "runningTimer": { "projectName": "…", "elapsedMinutes": 42 },
  "notes": ["Declared hours are reported separately and never mixed into tracked totals."],
}
```

Month summaries reuse `buildMonthOverview` so the figures match `/time`'s month view exactly.
Declared hours (`MonthlyHourDeclaration`) are included as `declaredMinutes` for months fully inside
the period and never summed into `trackedMinutes` — the same separation the web app draws.

**`time_create_entry`** — `{ date, projectId, description, durationMinutes? , startTime?, endTime? }`;
exactly one of `durationMinutes` or the `startTime`+`endTime` pair (Zod `superRefine`). Returns
`{ entry, day: { date, totalMinutes, overSoftLimit } , warnings: string[] }`. The soft 8-hour
warning is a warning, the 24-hour cap is an error — identical to the grid. The tool description
states the lock and tracking-mode rules in one sentence each so the model can pre-empt errors.

**`time_update_entry`** — `{ entryId, date?, projectId?, description?, durationMinutes?, startTime?,
endTime? }`, at least one field. Same return shape as create. Refuses `DECLARED` rows and locked
rows through the domain layer's existing checks.

**`time_delete_entry`** — `{ entryId }`. Soft delete; returns
`{ deleted: entryView, restorable: true }` and the description tells the model that
`time_restore_entry` undoes it. Decision 9 in §16 marks this tool as always requiring user
confirmation in Claude (`anthropic/requiresUserInteraction`), the only tool with that flag.

**`time_restore_entry`** — `{ entryId }`; re-validates as if created now (open period, still-tracked
assignment, daily limit), exactly as the web undo does.

**`timer_start`** — `{ projectId, description? }`. If a timer is already running, fails with
`TIMER_ALREADY_RUNNING` and the current timer in `details`, so the agent can decide to stop it.

**`timer_stop`** — no arguments. Returns `{ entry }`, or `{ discarded: true, reason: "DAILY_LIMIT",
elapsedMinutes }` when the domain layer discards the timer because the day would exceed 24 hours
(existing behaviour, surfaced honestly). Duration rounds **up** to the next whole minute, minimum
one, and a blank description becomes "Tracked with timer" — both are domain rules, not MCP ones.
To change the description afterwards the agent calls `time_update_entry` on the returned entry.

**`timer_status`** — no arguments. `{ timer: { id, projectId, projectName, description, startedAt,
elapsedMinutes } | null }`. Cheap on purpose: agents ask "what am I tracking?" often.

Deliberately **not** exposed in v1: `copyPreviousDayEntries`, `duplicatePreviousWeek` (composable
from list + create; cheap to add if agents keep re-implementing them), drafts, inactive-week
markers, declarations.

### 7.3 Description style

Descriptions follow Anthropic's "explain it to a new hire" guidance: what the tool does, the unit
and format of every argument, the two rules that most often cause errors (locked months, declared
projects), and which tool to call first. Example for `time_create_entry`:

> Log time for the signed-in member on one calendar day. Give either `durationMinutes` (integer,
> 1–1440) or both `startTime` and `endTime` (`HH:mm`, 24-hour, in the member's timezone). `date` is
> `YYYY-MM-DD` in the member's timezone; call `time_get_context` for today's date and the valid
> `projectId` values. Fails if the month has a submitted timesheet (`PERIOD_LOCKED`), if the project
> declares hours monthly (`PROJECT_DECLARES_MONTHLY`), or if the day would exceed 24 hours
> (`DAILY_LIMIT_EXCEEDED`). Returns the created entry and the day's new total.

## 8. Result and error contract

Two channels, as the spec distinguishes them:

- **HTTP / JSON-RPC errors** for things the model cannot fix: missing or invalid token (401 with
  `WWW-Authenticate`), missing scope (403 `insufficient_scope`), rate limit (429 + `Retry-After`),
  header mismatch or unsupported protocol version (400, produced by the SDK), unknown tool (SDK).
- **Tool results with `isError: true`** for everything the model can react to. Shape:

```jsonc
{
  "isError": true,
  "content": [
    { "type": "text", "text": "PERIOD_LOCKED: This period is locked by a submitted timesheet." },
  ],
  "structuredContent": {
    "code": "PERIOD_LOCKED",
    "message": "This period is locked by a submitted timesheet.",
    "details": { "date": "2026-07-14", "lockedMonth": "2026-07" },
  },
}
```

Codes are a closed union (`McpErrorCode`) mapped from the domain's error messages, mirroring the
`knownMessageKeys` table in `app/time/actions.ts`:

| Code                                                                         | Domain trigger                                                                                                                 |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `VALIDATION`                                                                 | Zod argument failure (SDK returns `isError` before the handler runs); our `superRefine` messages                               |
| `PROJECT_REQUIRED` · `PROJECT_NOT_AVAILABLE` · `PROJECT_DECLARES_MONTHLY`    | "Choose a project." · "not active for the selected date" / "not assigned for the selected week" · "declares its hours monthly" |
| `INVALID_DATE` · `INVALID_TIME` · `END_BEFORE_START` · `START_END_REQUIRED`  | the date/time messages and `TimeTrackingDateError`                                                                             |
| `DURATION_INVALID` · `DAILY_LIMIT_EXCEEDED`                                  | "Duration must be greater than zero." / "too long" / "too large" · "Daily total cannot exceed 24 hours."                       |
| `DESCRIPTION_REQUIRED` · `DESCRIPTION_TOO_LONG`                              | the description messages                                                                                                       |
| `ENTRY_NOT_FOUND` · `ENTRY_LOCKED` · `PERIOD_LOCKED` · `ENTRY_IS_DECLARED`   | "Time entry not found." · "locked by a submitted timesheet" (entry) · (period) · "corrected on the month level"                |
| `DAY_ON_LEAVE`                                                               | "This day is covered by leave." (a full-day leave; a half day does not block)                                                  |
| `TIMER_ALREADY_RUNNING` · `NO_TIMER_RUNNING` · `TIMER_DISCARDED_DAILY_LIMIT` | "Stop the running timer…" · "No timer is running." · `{ discarded: true }`                                                     |
| `INTERNAL`                                                                   | anything unmapped; logged with a correlation id, message is generic                                                            |

Messages are English and machine-oriented; the agent speaks the user's language itself (decision 8).
Decision 16 recommends giving `TimeTrackingError` a `code` field so both the Server Actions'
i18n lookup and this table key on codes instead of English strings.

Result size: entries are compact and paginated; a full 92-day listing at 200 entries is well under
Claude Code's 25 000-token default cap. No tool returns free-text longer than a description.

## 9. Changes to existing domain code

Small, additive, all in `src/server/time-tracking` unless noted:

1. **`EntrySource.MCP`** (`prisma/enums.prisma`) and `createTimeEntry`'s `source` type widened to
   `"GRID" | "FORM" | "MCP"`. Lets the grid, reports and audit tell agent-written entries apart; the
   grid keeps excluding only `DECLARED`. Decision 6.
2. **`TimeTrackingRequestMetadata`** gains `channel?: "WEB" | "MCP"` and `clientId?: string`;
   the inline `auditLog.create` calls copy them into two new nullable `AuditLog` columns
   (`channel`, `clientId`). Decision 7. `audit-localization.test.ts` needs no new action names —
   MCP reuses `time_entry.created` etc.
3. **`context.ts`** — `getMemberTrackingContext({ memberId, now })`: extracts the project resolution
   and `lockedMonthStarts` logic from `getMemberWeeklyTimeGrid` into a shared helper both call, so
   the MCP context and the grid can never disagree.
4. **`queries.ts`** — `listMemberTimeEntries` taking `memberId`, `from`, `to`, an optional
   `projectId`, `includeDeclared`, an optional `cursor` and `limit`: `findMany` with
   `deletedAt: null`, keyset pagination.
5. **`summary.ts`** — `summarizeMemberTime({ memberId, from, to, compareWithPrevious })`: two
   `groupBy` calls (project, day) plus declarations, delegating whole months to `buildMonthOverview`.
   This is member-scoped; admin reports keep using `buildReportTimeEntryWhere`.
6. Optional but recommended: `TimeTrackingError(message, code)` (§8).

Nothing changes in `createTimeEntry`, `updateTimeEntry`, `deleteTimeEntry`, `restoreTimeEntry`,
`startRunningTimer`, `stopRunningTimer` beyond item 1. Period locks, tracking-mode checks, the daily
cap and soft deletes stay where they are and therefore apply to MCP automatically.

## 10. Data model and migration

One Prisma migration, one new schema file `prisma/oauth.prisma` following the repo's split-schema
convention and the `PascalCase model + @@map("camelCase")` pattern used in `prisma/auth.prisma`:

- Better Auth OAuth provider tables: `OauthClient`, `OauthAccessToken`, `OauthRefreshToken`,
  `OauthConsent`, `OauthClientAssertion`, `OauthClientResource` (columns per the 1.7.x
  documentation; generate with the Better Auth CLI, then move into the split file and add `@@map`).
- `jwt` plugin table: `Jwks`.
- `EntrySource` enum: add `MCP`.
- `AuditLog`: add `channel String?` and `clientId String?`.

Deploy runs `pnpm db:migrate:deploy` before start (`railway.json`), so no manual step. The e2e
database is rebuilt by `pnpm db:test`.

## 11. Security review

- **Audience binding, no passthrough.** Access tokens are JWTs with `aud` = the MCP resource; the
  route accepts nothing else and never forwards the token anywhere. Spec MUSTs satisfied.
- **Identity, not impersonation.** Every mutation is `memberId === actorMemberId`; admins get no
  extra power in v1. Token → `Member` resolution re-checks `ACTIVE` on every call.
- **Same gates as the web.** Consent runs behind `requireActiveAppMember`, so invitation state,
  inactivity, deletion, 2FA and security setup apply. Admin toolsets later should additionally
  require TOTP-enabled admins at consent, matching `requireAdminAppMemberForAction`.
- **Origin validation** (DNS rebinding) with 403; HTTPS everywhere except `localhost` development.
- **Client registration.** CIMD only in production (no unbounded client table growth, no
  attacker-registered clients); consent screen names the client host; redirect URIs come from the
  signed-by-TLS metadata document, loopback ports ignored only for `native` clients.
- **Rate limits.** OAuth endpoints: provider defaults (token 20/min, authorize 30/min, register
  5/min per IP). MCP endpoint: 120 requests per minute per member, counted in `rate-limit.ts`
  (in-memory sliding window; one instance per environment today, interface allows a table-backed
  implementation later). 429 carries `Retry-After`.
- **Input bounds.** Zod on every argument; description ≤ 1000 (domain), ranges ≤ 92/366 days,
  page size ≤ 200, `strict()` objects so stray arguments fail fast.
- **Destructive actions.** Delete is a soft delete with a restore tool and requires a user click
  in Claude on every call; timer stop and update are reversible through update/restore.
- **Prompt injection.** Tool results are data, never instructions; user-authored descriptions are
  returned verbatim inside structured fields and never concatenated into guidance text. That is the
  server's share of the mitigation; the client's is out of our hands.
- **Logging.** One line per call: tool, member id, client host, latency, outcome code. Never
  arguments, descriptions or tokens. `redactAuditPayload` already strips token-like keys from audit
  views.
- **Secrets.** Client secrets are hashed by default in 1.7.x (`storeClientSecret: "hash"`), tokens
  hashed at rest; JWKS private keys live in the `jwks` table, encrypted by Better Auth with
  `BETTER_AUTH_SECRET` — which is already documented as load-bearing across database copies.

## 12. Connecting — what the user does

The text below belongs on the Help page (HU/EN) and in the connector's own description once built.

**Claude.ai, Claude Desktop, Cowork, mobile** (one setup, shared by all four):
Team/Enterprise: an Owner opens _Organization settings → Connectors → Add → Custom_, name
"Sheet Happens", URL `https://sheet.example.com/api/mcp`, authentication _Always required_, OAuth
client _Use Anthropic's hosted client metadata_; members then open _Customize → Connectors_ and
click _Connect_. Pro/Max/Free: _Customize → Connectors → Add custom connector_ with the same URL.
Claude detects the auth settings from the 401 handshake and pre-fills them. Signing in uses the
normal Sheet Happens login; the consent page lists what the agent may do. Tools are enabled per
conversation with the "+" menu; individual tools can be set to _Blocked_ under the connector.

**Claude Code:**

```bash
claude mcp add --transport http sheet-happens https://sheet.example.com/api/mcp
claude mcp login sheet-happens            # or /mcp inside a session; --no-browser for SSH
```

For the team, a project-scoped `.mcp.json` committed to any repo that benefits from it:

```json
{
  "mcpServers": { "sheet-happens": { "type": "http", "url": "https://sheet.example.com/api/mcp" } }
}
```

Tool permissions in `.claude/settings.json` use `mcp__sheet-happens__time_get_context` etc.; a
sensible default allow-list is the four read tools.

**Local development:** `claude mcp add --transport http sheet-happens-local http://localhost:3000/api/mcp`
works directly (loopback redirect). Claude.ai cannot reach localhost; test the hosted flow against
the development environment `https://<service>-<environment>.up.railway.app/api/mcp` rather than a
tunnel.

**Manual inspection:** `pnpm dlx @modelcontextprotocol/inspector` (UI, OAuth via DCR in
non-production) or the CLI with a bearer token:
`pnpm dlx @modelcontextprotocol/inspector --cli http://localhost:3000/api/mcp --transport http --method tools/list --header "Authorization: Bearer …"`.

## 13. i18n scope

User-facing and therefore in **both** `messages/hu.json` and `messages/en.json`:

- `Consent` namespace: title, client line ("{host} wants to access your Sheet Happens account"),
  scope descriptions (`time:read`, `time:write`, `openid`/`profile`/`offline_access` collapsed into
  one "know who you are and stay connected" line), Allow/Deny, error and expired-request states.
- `Settings.connectedApps` (Phase 3): list, connected date, scopes, Disconnect, empty state,
  confirm dialog, toasts.
- `Help.mcp` (Phase 3): the connection recipe from §12.
- Audit labels: none new (existing actions reused); the audit UI may show the `channel` as a
  badge — that label needs both locales.

Model-facing and therefore **English only** (decision 8): tool names, descriptions, argument
descriptions, error codes and messages. The consent page and settings are where the user reads;
tool text is what the model reads and it answers the user in their language.

## 14. Testing and verification

- **Unit** (`src/server/mcp/toolsets/time/*.test.ts`): each handler with a fake actor and mocked
  `@/src/server/time-tracking` functions — happy path, each error code, annotation and schema
  snapshots. `src/server/mcp/errors.test.ts` covers the full message→code table so a renamed domain
  message fails loudly.
- **Route** (`app/api/mcp/route.test.ts`, same style as `app/api/notifications/route.test.ts`):
  mock `requireMcpAuth` to inject claims; assert 401 shape with `WWW-Authenticate` when unauthenticated,
  403 `insufficient_scope` for a write tool with a read-only token, 429 when over the limit, 405 on
  GET; then real JSON-RPC round trips against the exported `POST` with a hand-built `Request`: a
  modern `tools/list` (with `MCP-Protocol-Version: 2026-07-28`, `Mcp-Method`, `_meta`) and a legacy
  `initialize` → `tools/list` sequence, proving dual-era behaviour.
- **Contract baseline**: a checked-in JSON of `tools/list` (names, schemas, annotations, order)
  compared in a test — like the aria baselines, changed only deliberately and read in the diff.
- **e2e** (`e2e/authenticated/member/mcp-oauth.spec.ts`, Phase 3): with DCR enabled in the e2e
  database, register a test client, drive `/oauth2/authorize` → existing login → `/consent` (aria
  snapshot, HU) → exchange the code with PKCE via `fetch` → call `tools/list` and
  `time_get_context` over HTTP. This is the only test that proves the whole chain, and it runs on the
  suite's own database.
- **Manual**: MCP Inspector against local; Claude Code against local; Claude.ai against the
  development environment; scenarios appended to `docs/manual-qa-test-plan.md` in a separate
  `docs(qa):` commit (connect, consent deny, consent allow, create/update/delete/restore, timer, locked
  month refusal, declared project refusal, disconnect from settings).
- **Gate**: `pnpm verify` before calling any phase done.

## 15. Phasing

- **P0 — decisions and spike (1–2 days).** Settle §16. On a branch: move `better-auth`,
  `@better-auth/passkey` and `@better-auth/prisma-adapter` to 1.7.x with `pnpm update`, add
  `@better-auth/mcp`, `@better-auth/cimd` and `@modelcontextprotocol/server`; run `pnpm verify` and
  `pnpm e2e` to confirm the minor bump is clean; generate the migration (§10).
- **P1 — connect (read-only).** Plugins wired, discovery documents, `/consent` page (HU/EN),
  `/api/mcp` with `time_get_context`, `time_list_entries`, `timer_status`. Exit criterion: connected
  from Claude Code (local) and Claude.ai (development environment), tool list visible, read tools
  answer.
- **P2 — write.** The six mutating tools, `time_summary`, `EntrySource.MCP`, audit channel, error
  codes, route and unit tests, contract baseline.
- **P3 — operate.** "Connected apps" in `/settings` (list, disconnect, revoke), revoke tokens when a
  member is inactivated or deleted, e2e OAuth spec, Help page recipe, QA scenarios, two prompts
  (`time_daily_review`, `time_weekly_review`) if Claude Code's prompt support is judged useful.
- **Later toolsets**, each a folder + scope + registry line: `reports` (read-only, routing every
  query through `buildReportTimeEntryWhere` as its comment asks), `timesheets` (read status, submit),
  `admin` (role-gated, TOTP-gated at consent, on-behalf-of writes with mandatory reason mirroring
  `correctDeclaredHoursAction`), Enterprise Managed Auth (§4.8), MCP resources for read-mostly
  context once Claude surfaces expose them consistently.

## 16. Decisions — all settled

Each item states the question, then the recommendation, then **what shipped**. Every recommendation
was taken; the notes record where taking it cost more than expected.

1. **Build on Better Auth 1.7.x (`@better-auth/mcp` + `@better-auth/oauth-provider` +
   `@better-auth/cimd`) or on the installed 1.6.23 `mcp` plugin?** _Recommend 1.7.x._ It gives
   CIMD (what Claude and the spec now prefer), JWT access tokens with audience binding, refresh
   rotation with replay detection, revocation, and scope step-up helpers. 1.6's plugin is DCR-only
   (deprecated), has no revocation and can skip consent silently. The bump is within the existing
   caret range and this repo does not use the removed `oidcProvider`. Cost: three new dependencies
   and a spike run of `pnpm verify` + e2e. This needs the developer's go-ahead because it adds
   dependencies. **Shipped on 1.7.3.** The bump cost three source fixes, not zero — §18.1.
2. **`@modelcontextprotocol/server` 2.0 (dual-era) or the classic `@modelcontextprotocol/sdk`
   1.30 (legacy-only)?** _Recommend 2.0 with `legacy: "stateless"`._ Works with every Claude
   client today and stays on the supported track; the classic line is in maintenance. **Shipped**, and the dual-era behaviour is covered by the route test.
3. **Use Vercel's `mcp-handler` or the SDK's own `createMcpHandler`?** _Recommend the SDK
   directly._ One fewer dependency; identical capability; matches Better Auth's documented pattern. **Shipped**; `mcp-handler` was never installed.
4. **Endpoint path `/api/mcp` or `/mcp`?** _Recommend `/api/mcp`._ Consistent with every other
   route handler in `app/api`; the resource identifier and PRM path simply include it. **Shipped.**
5. **Client registration: CIMD only in production, DCR in development and e2e?** _Recommend yes._
   Production stays closed to self-registration; tooling (Inspector, e2e client) keeps working
   where it is needed. Owners can still paste their own client id in Claude if ever wanted. **Shipped**, with the two corrections in §18.6: it needs a second flag, and a registering client must declare itself `native` to use a loopback redirect.
6. **Add `EntrySource.MCP`?** _Recommend yes._ Cheap enum addition bundled into the same
   migration; makes agent-written entries visible in the grid, reports and audit. **Shipped.** It also forced a `source.mcp` label in both locales — `formatEntrySource` is an exhaustive switch, so a fifth value rendered blank until it was added.
7. **Add `AuditLog.channel` and `AuditLog.clientId`?** _Recommend yes._ Without them an MCP write
   is indistinguishable from the member clicking in the browser. Same migration, small change to
   `TimeTrackingRequestMetadata`. **Shipped**, and it needed no per-site edit: all 13 `auditLog.create` calls in the module spread `...input.requestMetadata`, so naming the fields exactly `channel` and `clientId` was enough. The web builders now set `channel: "WEB"` so the column means something on both sides; rows written before the migration read `null`.
8. **Tool descriptions and error messages in English only?** _Recommend yes._ They are read by the
   model, which answers in the user's language; every human-facing surface (consent, settings,
   help) is fully HU/EN. Document the exception in `CLAUDE.md`'s i18n rule when implementing. **Shipped**, and `CLAUDE.md` now records the exception.
9. **Require a user click on every `time_delete_entry` call (`anthropic/requiresUserInteraction`)?**
   _Recommend yes, for delete only._ Deletion is the one action users regret; it is soft and
   restorable, but a confirmation costs one click. Updates and timer stops stay frictionless. **Shipped**: `time_delete_entry` is the only tool carrying `_meta["anthropic/requiresUserInteraction"]`, and the contract test asserts it is the only one.
10. **Token lifetimes.** _Recommend the provider defaults: 1 h access, 30 d rotating refresh,
    10 min code._ Claude refreshes automatically; a 30-day idle disconnect matches the web
    session feel. **Shipped as the defaults**, i.e. nothing is configured. Note `mcp()` also sets `refreshTokenReuseInterval` to 30s of its own accord.
11. **MCP endpoint rate limit.** _Recommend 120/min per member, in-memory, with the interface
    ready for a table-backed limiter._ An agent turn makes a handful of calls; abuse is bounded by
    OAuth anyway; one instance per environment today. **Shipped** as `createMcpRateLimiter`, keyed by member id rather than token or IP — one member with Claude on three devices holds three tokens and should still get one budget, and every Claude.ai request arrives from Anthropic's address range, so an IP bucket would be shared by the whole company.
12. **Include declared hours in `time_summary`?** _Recommend yes, as a separate `declaredMinutes`
    figure._ Mirrors the month view; never mixed into tracked totals. **Shipped**, and a month only counts when it lies _entirely_ inside the period — a declaration is a whole-month figure and prorating one would be an invention.
13. **Any admin power through MCP in v1?** _Recommend no._ Admin toolsets come later with their own
    scope, role gate and TOTP requirement at consent. **Shipped**: every mutation passes `memberId === actorMemberId`, and there is no tool that accepts another member.
14. **Expose copy-previous-day / duplicate-week?** _Recommend no in v1._ Composable; add if usage
    shows agents re-implementing them badly. **Not exposed.**
15. **Consent remembered per client and scope set?** _Recommend yes; verify the provider does it._
    Re-prompting on every refresh would make the connector feel broken. **Verified live** — it does, per client, user and scope set.
16. **Give `TimeTrackingError` a `code`?** _Recommend yes, in P2._ Both the Server Actions'
    i18n table and the MCP error map then key on codes; the English-string lookup goes away. **Shipped for the MCP side, half-shipped for the web side, deliberately.** Both error classes now carry a code and every throw site in `src/server/time-tracking` sets one, and the MCP map keys on it. The web layer still tries its message table _first_, because that table is finer-grained than the codes: `localIntervalToUtc` reports "Choose a valid start time." and "Choose a valid end time." separately and both arrive as `INVALID_TIME`, so keying only on the code would tell a member which rule they broke but no longer which field. The code table sits underneath as the fallback, which is a strict improvement — an unmapped domain sentence now localizes instead of leaking English. Two codes had no i18n key at all and got one (`fields.validTime`, `errors.inactiveWeekHasEntries`).

Implementation-time verification list — **all six checked against a running server**:

| Question                                                         | Answer                                                                                                                                  |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| The `resource_metadata` URL emitted in the 401                   | `<origin>/.well-known/oauth-protected-resource/api/mcp`, and that path is served. ✓                                                     |
| PRM fields                                                       | `bearer_methods_supported: ["header"]` always; `scopes_supported: ["time:read","time:write"]` because non-OIDC scopes are configured. ✓ |
| The login → `/oauth2/continue` hand-off                          | **Does not exist for this case.** §18.4.                                                                                                |
| Refresh tokens to a public (`none`) client with `offline_access` | Issued, and rotate on use. ✓                                                                                                            |
| Token endpoint accepting a POST with no `Origin`                 | **Yes** — verified deliberately, because no real OAuth client sends one. ✓                                                              |
| `createMcpHandler`'s `fetch(request, { authInfo })`              | Real, and it also takes `parsedBody`, which the route uses to avoid parsing the body twice. ✓                                           |

---

## 17. Sources

MCP specification `2026-07-28`: changelog, versioning and compatibility matrix, Streamable HTTP
transport (server validation, backward compatibility), authorization, security best practices,
tools — `https://modelcontextprotocol.io/specification/2026-07-28/…`. Anthropic connector docs:
authentication (`https://claude.com/docs/connectors/building/authentication`), lazy authentication
(`…/building/lazy-authentication`), enterprise managed auth (`…/building/enterprise-managed-auth`),
custom connectors (`https://claude.com/docs/connectors/custom/remote-mcp`), Claude Code MCP
(`https://code.claude.com/docs/en/mcp`), announcement
(`https://claude.com/blog/bringing-mcp-2026-07-28-to-claude`), "Writing effective tools for agents"
(`https://www.anthropic.com/engineering/writing-tools-for-agents`). SDK: TypeScript SDK 2.0 docs
(`https://ts.sdk.modelcontextprotocol.io/v2/` — web-standard, legacy-clients, authorization, tools),
SDK betas post (`https://blog.modelcontextprotocol.io/posts/sdk-betas-2026-07-28/`),
`@modelcontextprotocol/sdk` 1.30.0 source, `mcp-handler` README. Better Auth: MCP plugin
(`https://www.better-auth.com/docs/plugins/mcp`), OAuth provider
(`https://www.better-auth.com/docs/plugins/oauth-provider`), CIMD
(`https://www.better-auth.com/docs/plugins/cimd`), installed `better-auth@1.6.23` plugin source.
Next.js 16.3.3 docs in `node_modules/next/dist/docs` (route handlers, `.well-known` routes,
`proxy.ts`, streaming, `maxDuration`). Repo: `src/server/time-tracking/*`, `src/server/auth/*`,
`app/time/actions.ts`, `app/api/notifications/route.ts`, `prisma/*.prisma`, `docs/domain-model.md`,
`docs/auth-user-management.md`, `docs/railway-projects.md`.

---

## 18. What the implementation changed

Everything here was found by building it and running it. Where §0–§15 above and this section
disagree, this section is right.

### 18.1 The 1.7 bump was not clean — it broke three files

§15 P0 assumed `pnpm update` would be uneventful. It was not, and the failure mode was misleading:
`tsc` reported five errors in `app/`, of which **four were cascades**. `Auth.api` is
`InferAPI<ReturnType<typeof router<Options>>["endpoints"]>`, so when the object literal passed to
`betterAuth()` fails its constraint, `Options` degrades to bare `BetterAuthOptions`, every plugin
endpoint disappears from `auth.api`, and unrelated call sites start reporting missing methods.
`verifyTOTP` and `verifyBackupCode` had not been renamed at all.

Three real changes:

- `databaseHooks.passkey` is gone — 1.7 narrowed `databaseHooks` to user/session/account/
  verification, and `@better-auth/passkey` creates its row with the raw adapter anyway, so the hook
  was dead at runtime too. Replaced with an auth-level `hooks.after` guarded on
  `ctx.path === "/passkey/verify-registration"`, reading `ctx.context.returned` — the only place the
  created row's `id` is still reachable, which is what the audit entry records.
- `socialProviders.google.getUserInfo` must no longer return `user.id` (`OAuth2UserInfo.id` is now
  `id?: never`); provider identity comes from the provider's own `accountSubject`, which for Google
  is `profile.sub` — the same value this repo was passing as `id`, so `account.accountId` is
  unchanged and no rows need migrating. `data` is also now typed as the declared raw profile.
- `/two-factor/enable` returns a union discriminated on `method` now that the endpoint can also
  enable email/SMS OTP. Runtime behaviour is unchanged (`method` defaults to `"totp"`); the call
  site pins `method: "totp"` and narrows.

### 18.2 `requireMcpAuth` is unusable in this app

`requireMcpAuth` defaults its `resource`, `issuer` and `jwksUrl` from `(await auth.$context).baseURL`.
This app passes a **dynamic** `baseURL` (`{ allowedHosts, fallback }`) whenever
`NODE_ENV !== "production"`, and Better Auth leaves `$context.baseURL` as the empty string for a
dynamic config — so it throws on every request in local dev and e2e while working in production.
Worse, even in production its default audience is the auth base URL rather than the MCP resource, so
no token would ever verify.

The route uses `createMcpProtectedRequestHandler` with `issuer`, `audience` and `jwksUrl` passed
explicitly from `authUrls`. The plugin's own docstring points at exactly this escape hatch for "a
server using a dynamic `baseURL`". The same reasoning is why `jwt({ jwt: { issuer } })` is pinned.

### 18.3 The protected-resource metadata cannot be reached by a rewrite

`mcp()` serves the RFC 9728 document from an `onRequest` hook that matches the **full request
pathname** against exactly two values: `/.well-known/oauth-protected-resource` and
`/.well-known/oauth-protected-resource<resource pathname>`. It knows nothing about `basePath`, and
`/api/auth/.well-known/oauth-protected-resource/api/mcp` returns 404. A Next rewrite changes the
path the handler sees, so rewriting the well-known URL into the auth catch-all makes the hook stop
matching. Hence the thin route handlers that pass the request through untouched.

(The AS metadata is different: the provider accepts both the path-inserted and the issuer-appended
shape, so that one _could_ have been a rewrite. It is a route handler too, for symmetry.)

### 18.4 The login hand-off had to be built

Better Auth resumes an interrupted authorization with a global `after` hook that fires when a
sign-in response sets the session cookie **and the request body carried `oauth_query`**. That works
for a password POST and not at all for this app: a magic link is verified by a `GET` with no body, so
the hook can never see it — and magic links are the primary way people sign in here.

Instead, `/login` turns the pending authorization into an ordinary `callbackURL`
(`src/lib/oauth-resume.ts`) and redirects once so the parameter is in the address bar. Every sign-in
method then lands back on `/oauth2/authorize` with the same parameters and a session, and the
provider continues to `/consent` as if the member had been signed in all along. Putting it in the URL
rather than only in a prop matters: the auth client rebuilds `callbackURL` for the second-factor hop
from `pathname + search`, which on `/login?client_id=…` sanitizes to `/dashboard` and would silently
lose the request. `prompt=login`/`prompt=create` are stripped, or the provider bounces straight back
to login forever.

### 18.5 The consent contract differs from the plugin's own documentation

The `consentPage` JSDoc promises `client_id`, `scope`, `claims` and `code` query parameters and says
to post the `code` back. There is no `code`: the page receives the **whole authorization query**
plus `exp`, `ba_iat`, repeated `ba_param` and an HMAC `sig`, and `/oauth2/consent` takes
`{ accept, scope?, claims?, oauth_query }`. Three consequences:

- `oauth_query` has to be **byte-identical** to the signed set. The client component reads
  `window.location.search` rather than reconstructing from Next's parsed `searchParams`, because
  re-encoding one value (`+` versus `%20`) is an `invalid_signature`.
- It also has to be **filtered** to the signed parameters, or an extra query parameter picked up
  along the way breaks verification. `@better-auth/oauth-provider/client` ships
  `buildSignedOAuthQuery` for this, but that package is not resolvable from app code, so
  `src/lib/oauth-signed-query.ts` re-implements the same filter.
- The success answer is `{ redirect: true, url }`, not `{ redirect_uri }`. The action accepts both.

Also: the consent POST needs an `Origin` header — Better Auth refuses a state-changing request
without one (`MISSING_OR_NULL_ORIGIN`). A browser always sends it, and the Server Action forwards the
browser's headers, so the real path is fine; anything scripting the endpoint has to add it.

### 18.6 Registration needs two flags, and native clients

`allowDynamicClientRegistration` alone is not enough: a tool registering itself has no session and no
initial access token, so `/oauth2/register` answers 401 without
`allowUnauthenticatedClientRegistration`. Both move together via
`isDynamicClientRegistrationEnabled()`, which is off in production and overridable with
`MCP_ALLOW_DYNAMIC_CLIENT_REGISTRATION` — needed because the Dockerfile hardcodes
`NODE_ENV=production` for every deploy, PR previews included.

A DCR client also defaults to `application_type: "web"`, and a web client is **refused** a loopback
redirect URI. Anything registering with `http://127.0.0.1:…` — the MCP Inspector, the e2e client —
must send `application_type: "native"`. A CIMD client with no `application_type` is validated as
native, which is why Claude Code's loopback redirect works without this.

`/oauth2/register` is rate limited to **5 per minute**, far tighter than every other endpoint. Two
or three tooling retries exhaust it, and the 429 looks like a broken configuration.

### 18.7 Smaller API corrections

- `originValidationResponse(request, allowedOriginHostnames)` takes a **positional array of
  hostnames** — no scheme, no port — not an `{ allowedOrigins }` options object. It returns
  `Response | undefined`, and a request with **no** `Origin` passes (non-browser MCP clients never
  send one), which is what makes it safe to apply to this endpoint at all.
- `createInsufficientScopeError` is not exported from `@better-auth/mcp`; it comes from
  `better-auth/oauth2`. Its identity is tracked in a module-local `WeakSet`, so a hand-built
  equivalent is **not** recognised and would surface as a 500 instead of a 403.
- `McpServer.registerTool(name, config, handler)` takes Zod 4 `z.object(...)` schemas, and the SDK
  applies **no annotation defaults** — an omitted hint is read pessimistically by clients, so all
  four are set explicitly on all ten tools.
- `CallToolResult.content` is required at the type level; a structured-only result does not compile.
- `codeExpiresIn`, not `authorizationCodeExpiresIn`. There is no top-level `requirePKCE`.
- `mcp()` silently sets `refreshTokenReuseInterval` to 30s (the provider's default is 0).
- `aud` is an **array** when `openid` is granted alongside a resource (`[<resource>,
<baseURL>/oauth2/userinfo]`). `jose` matches on any member, so verification passes, but code that
  reads `claims.aud` as a string is wrong.

### 18.8 A Prisma incompatibility the design could not have predicted

`oauthResource.allowedScopes` is declared `string[]` by the plugin, but `buildSeedRow` writes an
explicit `null` for an unrestricted resource — which a Postgres array column cannot hold, so plugin
init failed outright. It also _reads_ `null` as "no restriction" while an empty array would mean "no
scope is allowed", so a scalar list would have been wrong even if the insert had succeeded. The
column is `Json?`. Every other `string[]` field is written with a `?? []` fallback and is a real
array. §10 also omitted `OauthResource` from its table list; there are **seven** provider tables plus
`Jwks`.

### 18.9 Better Auth's CSRF origin check applies only to cookie-bearing requests

Better Auth answers `403 MISSING_OR_NULL_ORIGIN` to a state-changing request that arrives **with a
session cookie and no `Origin`**. A request with no cookie is not checked at all. That is the rule
that makes the whole flow work, and it is worth stating because both halves matter:

- **`/oauth2/token` needs no `Origin`**, which is essential — Claude's servers and Claude Code are
  not browsers and never send one. Verified directly: no `Origin`, a `null` `Origin` and a foreign
  `Origin` all reach the OAuth error handling rather than the CSRF gate.
- **The consent POST does need one**, because it is a session-authenticated request. A browser always
  sends it on a same-origin POST, and the Server Action forwards the browser's own headers, so the
  real path is fine. Anything scripting that endpoint has to add it.
- It also cost an afternoon in the e2e spec: `apiRequest.newContext({ baseURL })` inside a test
  **inherits the project's `storageState`**, so the "agent" context carried the member's session
  cookie and every OAuth call it made was refused. `storageState: undefined` is required to get a
  genuinely cookie-less client — which is also the only way an assertion about bearer
  authentication means anything.

### 18.10 Operational notes

- **`jwks` rows are encrypted with `BETTER_AUTH_SECRET`.** Change the secret, or copy a database
  between environments with a different one, and every token mint fails with
  `Failed to decrypt private key` — a 500 from `/oauth2/token` with an empty body. The fix is to
  `DELETE FROM jwks`; the plugin mints a new key on next use. This bit during implementation.
- The 2026-07-28 request envelope lives in **`params._meta`**, not at the message top level, and the
  SDK requires all three of `io.modelcontextprotocol/protocolVersion`,
  `io.modelcontextprotocol/clientInfo` and `io.modelcontextprotocol/clientCapabilities`. Omitting
  any one is a `-32602`; putting `_meta` at the top level is a `-32600`.
- Importing `src/server/time-tracking` no longer pulls in the auth layer. It used to, through
  `shell-timer.ts` → `app-access.ts` → `auth.ts`, which after this change meant a _database write_
  (the resource seed) at module load — and an unhandled rejection in every test that mocks Prisma
  partially. `getShellRunningTimer` is imported from `@/src/server/time-tracking/shell-timer`
  directly now; `app/layout.tsx` is its only caller.
- **Pruning that one import chain was not enough, because the seed is unconditional.**
  `betterAuth()` resolves its context eagerly — `createBetterAuth` calls `init(options).then(...)`
  at module load and keeps a bare promise — so every plugin `init` runs on import, and
  `oauth-provider`'s does `oauthResource.findFirst`. With no database reachable that promise
  rejects with nothing awaiting it yet, which Node reports as an unhandled rejection and Vitest
  turns into a failed run: the CI `unit` job has no Postgres, so six test files that merely reach
  `auth/session` transitively took the whole suite down while all 939 tests passed. Chasing the
  chains is whack-a-mole; `auth.ts` now attaches a handler to `auth.$context` instead. It only
  suppresses the _unhandled_ report — `handler` and `api` still await the same promise per request
  — and mirrors what better-auth already does with its own `checkSchema`. Note the promise is
  built once, so a database outage at boot poisons it for the process's lifetime; that is upstream
  behaviour, not something the handler introduces.

### 18.11 Verified end to end

Against a running dev server, with a real DCR client, a real PKCE exchange and a real JWT:
discovery at all five URLs; the 401 challenge naming a `resource_metadata` URL that resolves;
`tools/list` returning the ten tools in the documented order with `cacheScope: "private"`;
`time_get_context` reporting the right member and _their_ timezone's today; a read-only token seeing
exactly the four read tools and getting **403 `insufficient_scope`** on a write; a full
create → list → update → summary → delete → restore round trip with durations in the member's own
display format; the audit row carrying `channel: "MCP"` and the client id; a bad argument coming back
as `isError` at HTTP 200; `GET` → 405; a foreign `Origin` → 403; and the token endpoint accepting a
POST with no `Origin`.
