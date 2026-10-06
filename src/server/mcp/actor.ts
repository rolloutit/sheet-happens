import type { AuthInfo } from "@modelcontextprotocol/server";

import { prisma } from "@/src/server/db/client";
import type { TimeTrackingRequestMetadata } from "@/src/server/time-tracking";

import { parseGrantedScopes, type McpScope } from "./scopes";

/**
 * Who an MCP call acts for.
 *
 * There is no session here. A bearer token is not a session — it survives a deactivation until it
 * expires — so the `ACTIVE` / `deletedAt` re-check in `resolveMcpActor` runs on EVERY call. That is
 * the only place a deactivation takes effect between token refreshes, which is why it is a database
 * read per request rather than something cached.
 */
export type McpActor = {
  member: McpActorMember;
  /** The access token's `sub`, i.e. the Better Auth user id. */
  authUserId: string;
  scopes: ReadonlySet<McpScope>;
  /** CIMD URL or registered client id. Recorded on every write. */
  clientId: string;
  /** The token's `jti` — the rate-limit key and the audit correlation handle. */
  tokenId: string;
  requestMetadata: TimeTrackingRequestMetadata;
  /** Raw token, needed only to hand the SDK a well-formed `AuthInfo`. */
  token: string;
  expiresAt?: number;
};

/**
 * The member fields the toolsets read. A narrow hand-written shape rather than the Prisma model, so
 * the `select` below and the type cannot drift, and so a fake actor in a unit test is three lines.
 */
export type McpActorMember = {
  id: string;
  displayName: string;
  role: "ADMIN" | "MEMBER";
  currentProfile: "CONTRACTOR" | "EMPLOYEE";
  timezone: string;
  locale: string;
  durationDisplayFormat: "DECIMAL_HOURS" | "HOURS_MINUTES";
  defaultTrackingMode: "TRACKED" | "DECLARED";
};

const actorMemberSelect = {
  id: true,
  displayName: true,
  role: true,
  currentProfile: true,
  timezone: true,
  locale: true,
  durationDisplayFormat: true,
  defaultTrackingMode: true,
  status: true,
  deletedAt: true,
} as const;

/**
 * Thrown when a structurally valid token no longer maps to a member who may act.
 *
 * The route turns this into a 401 `invalid_token` rather than a tool error, so the client drops the
 * token and re-runs the OAuth flow — where it fails at login, which is the correct end state for a
 * deactivated member. A 200 with `isError` would leave the client retrying forever.
 */
export class McpInvalidTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpInvalidTokenError";
  }
}

type AccessTokenClaims = {
  sub?: unknown;
  scope?: unknown;
  client_id?: unknown;
  azp?: unknown;
  jti?: unknown;
  exp?: unknown;
};

export async function resolveMcpActor(
  claims: AccessTokenClaims,
  request: Request,
  deps: { db?: { member: { findUnique: (args: unknown) => Promise<unknown> } } } = {},
): Promise<McpActor> {
  const authUserId = typeof claims.sub === "string" ? claims.sub : null;

  if (!authUserId) {
    throw new McpInvalidTokenError("Access token carries no subject.");
  }

  const db = deps.db ?? prisma;

  const member = (await db.member.findUnique({
    where: { authUserId },
    select: actorMemberSelect,
  })) as (McpActorMember & { status: string; deletedAt: Date | null }) | null;

  // Mirrors `getCurrentMember` + the ACTIVE gate, not `requireActiveAppMember`: the security-setup
  // and second-factor gates belong to the *browser* session, and they were already enforced at
  // `/consent`, which runs behind `requireActiveAppMember`. Re-checking them here would fail every
  // call for a member who legitimately consented, since a token carries no 2FA cookie.
  if (!member || member.deletedAt || member.status !== "ACTIVE") {
    throw new McpInvalidTokenError("The member this token was issued for is no longer active.");
  }

  const clientId =
    (typeof claims.client_id === "string" && claims.client_id) ||
    (typeof claims.azp === "string" && claims.azp) ||
    "unknown";

  return {
    member: {
      id: member.id,
      displayName: member.displayName,
      role: member.role,
      currentProfile: member.currentProfile,
      timezone: member.timezone,
      locale: member.locale,
      durationDisplayFormat: member.durationDisplayFormat,
      defaultTrackingMode: member.defaultTrackingMode,
    },
    authUserId,
    scopes: parseGrantedScopes(claims.scope),
    clientId,
    tokenId: typeof claims.jti === "string" ? claims.jti : "unknown",
    requestMetadata: {
      ipAddress: request.headers.get("x-forwarded-for"),
      // The client identity, not a browser UA: `user-agent` on an MCP call is Anthropic's fetcher,
      // which says nothing about who acted. The client id does.
      userAgent: request.headers.get("user-agent"),
      channel: "MCP",
      clientId,
    },
    token: readBearerToken(request) ?? "",
    ...(typeof claims.exp === "number" ? { expiresAt: claims.exp } : {}),
  };
}

function readBearerToken(request: Request) {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const [scheme, ...rest] = header.split(" ");
  if (!scheme || !/^(bearer|dpop)$/i.test(scheme)) return null;

  return rest.join(" ").trim() || null;
}

/**
 * The SDK's `AuthInfo`. `token`, `clientId` and `scopes` are required there even though our tools
 * read the actor from the closure instead — the SDK surfaces this on `ctx.http.authInfo`, and a
 * malformed one would make that unreadable for anything added later.
 */
export function toAuthInfo(actor: McpActor): AuthInfo {
  return {
    token: actor.token,
    clientId: actor.clientId,
    scopes: [...actor.scopes],
    ...(actor.expiresAt === undefined ? {} : { expiresAt: actor.expiresAt }),
    extra: {
      memberId: actor.member.id,
      tokenId: actor.tokenId,
    },
  };
}
