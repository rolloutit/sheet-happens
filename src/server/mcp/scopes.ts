/**
 * MCP OAuth scopes. Kept free of imports so `auth.ts`, the route handler and the unit tests can all
 * read it without dragging Prisma or Better Auth in.
 */

/**
 * Everything the authorization server may grant. `openid`/`profile`/`offline_access` are Better
 * Auth's own; the `time:*` pair is what the toolsets gate on.
 *
 * The order matters twice: it is the order the consent page lists them in, and the protected
 * resource metadata's `scopes_supported` is derived from it (with the OIDC ones filtered out by
 * `@better-auth/mcp`).
 */
export const MCP_SCOPES = [
  "openid",
  "profile",
  "offline_access",
  "time:read",
  "time:write",
] as const;

export type McpScope = (typeof MCP_SCOPES)[number];

/** The scopes a toolset can require. The OIDC ones are never checked by a tool. */
export const MCP_TOOL_SCOPES = ["time:read", "time:write"] as const;

export type McpToolScope = (typeof MCP_TOOL_SCOPES)[number];

/**
 * Advertised in the 401 challenge so a client asks for exactly the v1 set instead of everything in
 * `scopes_supported`.
 */
export const MCP_CHALLENGE_SCOPES = MCP_TOOL_SCOPES;

/**
 * Reserved for later toolsets (`docs/mcp-server.md` §15). Listed here so a future scope name cannot
 * be introduced twice, and so `MCP_SCOPES` stays the single grantable set in v1.
 */
export const MCP_RESERVED_SCOPES = [
  "reports:read",
  "timesheets:read",
  "admin:read",
  "admin:write",
] as const;

export function isMcpToolScope(value: string): value is McpToolScope {
  return (MCP_TOOL_SCOPES as readonly string[]).includes(value);
}

/**
 * Parses an OAuth `scope` claim. RFC 6749 says space-delimited; tolerate arbitrary whitespace and
 * ignore anything outside the granted set so an unknown scope can never widen access.
 */
export function parseGrantedScopes(scopeClaim: unknown): ReadonlySet<McpScope> {
  if (typeof scopeClaim !== "string") {
    return new Set();
  }

  const granted = new Set<McpScope>();

  for (const candidate of scopeClaim.split(/\s+/)) {
    if ((MCP_SCOPES as readonly string[]).includes(candidate)) {
      granted.add(candidate as McpScope);
    }
  }

  return granted;
}
