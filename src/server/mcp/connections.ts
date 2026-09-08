import { prisma } from "@/src/server/db/client";

import { clientIdHost } from "./consent";

/**
 * The member-facing view of "which apps can act as me", and the two ways that access ends.
 *
 * A grant here is three things at once: an `oauthConsent` row recording what was allowed, and any
 * number of live access and refresh tokens issued under it. Removing only the consent would stop the
 * *next* authorization while leaving a token that keeps working until it expires — up to an hour for
 * an access token and thirty days for a refresh token. So "Disconnect" has to delete all three, and
 * that is the whole reason this module exists rather than the settings page calling the provider's
 * `delete-consent` endpoint directly.
 */
export type McpConnection = {
  consentId: string;
  clientId: string;
  /** The CIMD host, or the registered client's name, or the raw id — see `clientIdHost`. */
  displayName: string;
  host: string | null;
  scopes: string[];
  connectedAt: Date;
  updatedAt: Date;
  /** Live, unrevoked, unexpired access tokens. Zero means the app has to refresh before acting. */
  activeAccessTokens: number;
  /** Live refresh tokens: as long as one exists, the app can keep minting access tokens. */
  activeRefreshTokens: number;
};

type ConnectionsClient = {
  oauthConsent: {
    findMany: (args: unknown) => Promise<unknown[]>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  };
  oauthAccessToken: {
    findMany: (args: unknown) => Promise<unknown[]>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  };
  oauthRefreshToken: {
    findMany: (args: unknown) => Promise<unknown[]>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  };
};

/**
 * The write half, on its own.
 *
 * Revocation runs inside the member-lifecycle transaction, whose `tx` is a narrow structural type
 * that has no reason to declare `findMany`. Splitting the writer out is what lets that transaction
 * call `revokeAllMcpAccessForUser` without widening itself to the read surface too.
 */
type GrantScope = { where: { userId: string; clientId?: string } };

export type McpGrantWriter = {
  oauthConsent: { deleteMany: (args: GrantScope) => Promise<{ count: number }> };
  oauthAccessToken: { deleteMany: (args: GrantScope) => Promise<{ count: number }> };
  oauthRefreshToken: { deleteMany: (args: GrantScope) => Promise<{ count: number }> };
};

type ConsentRecord = {
  id: string;
  clientId: string;
  scopes: string[];
  createdAt: Date;
  updatedAt: Date;
  client: { name: string | null; clientDiscoveryId: string | null } | null;
};

type TokenRecord = { clientId: string };

export async function listMcpConnections(
  input: { authUserId: string; now?: Date },
  deps: { db?: ConnectionsClient } = {},
): Promise<McpConnection[]> {
  const db = deps.db ?? (prisma as unknown as ConnectionsClient);
  const now = input.now ?? new Date();

  const liveTokenWhere = {
    userId: input.authUserId,
    revoked: null,
    expiresAt: { gt: now },
  };

  const [consents, accessTokens, refreshTokens] = await Promise.all([
    db.oauthConsent.findMany({
      where: { userId: input.authUserId },
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        clientId: true,
        scopes: true,
        createdAt: true,
        updatedAt: true,
        client: { select: { name: true, clientDiscoveryId: true } },
      },
    }) as Promise<ConsentRecord[]>,
    db.oauthAccessToken.findMany({
      where: liveTokenWhere,
      select: { clientId: true },
    }) as Promise<TokenRecord[]>,
    db.oauthRefreshToken.findMany({
      where: liveTokenWhere,
      select: { clientId: true },
    }) as Promise<TokenRecord[]>,
  ]);

  const accessByClient = countByClient(accessTokens);
  const refreshByClient = countByClient(refreshTokens);

  return consents.map((consent) => {
    const host = clientIdHost(consent.clientId);

    return {
      consentId: consent.id,
      clientId: consent.clientId,
      displayName: host ?? consent.client?.name?.trim() ?? consent.clientId,
      host,
      scopes: consent.scopes,
      connectedAt: consent.createdAt,
      updatedAt: consent.updatedAt,
      activeAccessTokens: accessByClient.get(consent.clientId) ?? 0,
      activeRefreshTokens: refreshByClient.get(consent.clientId) ?? 0,
    };
  });
}

/**
 * Ends one app's access.
 *
 * Tokens first, then the consent. If the process dies between the two, an orphaned consent grants
 * nothing on its own — the next authorization would still have to pass through `/consent` only if
 * the row were gone, so the worst case is one extra silent re-grant rather than a live token nobody
 * can see. The other order would leave exactly that.
 */
export async function disconnectMcpConnection(
  input: { authUserId: string; clientId: string },
  deps: { db?: McpGrantWriter } = {},
): Promise<{ revokedAccessTokens: number; revokedRefreshTokens: number; removedConsents: number }> {
  const db = deps.db ?? (prisma as unknown as McpGrantWriter);
  const scope = { userId: input.authUserId, clientId: input.clientId };

  const revokedAccessTokens = await db.oauthAccessToken.deleteMany({ where: scope });
  const revokedRefreshTokens = await db.oauthRefreshToken.deleteMany({ where: scope });
  const removedConsents = await db.oauthConsent.deleteMany({ where: scope });

  return {
    revokedAccessTokens: revokedAccessTokens.count,
    revokedRefreshTokens: revokedRefreshTokens.count,
    removedConsents: removedConsents.count,
  };
}

/**
 * Ends every app's access for one auth user.
 *
 * Called when a member is deactivated or deleted. `resolveMcpActor` already refuses a token whose
 * member is no longer `ACTIVE` on every single call, so this is not what makes deactivation safe —
 * it is what makes it *tidy*: no stale grant sitting in the tables waiting for a reactivation to
 * silently revive it, and nothing for a member to find in "Connected apps" after their account is
 * closed.
 *
 * Deleting rather than marking revoked: a `revoked` timestamp is how the provider detects refresh
 * replay within its reuse interval, and there is nothing to detect once the account is gone.
 */
export async function revokeAllMcpAccessForUser(
  input: { authUserId: string },
  deps: { db?: McpGrantWriter } = {},
): Promise<{ revokedAccessTokens: number; revokedRefreshTokens: number; removedConsents: number }> {
  const db = deps.db ?? (prisma as unknown as McpGrantWriter);
  const scope = { userId: input.authUserId };

  const revokedAccessTokens = await db.oauthAccessToken.deleteMany({ where: scope });
  const revokedRefreshTokens = await db.oauthRefreshToken.deleteMany({ where: scope });
  const removedConsents = await db.oauthConsent.deleteMany({ where: scope });

  return {
    revokedAccessTokens: revokedAccessTokens.count,
    revokedRefreshTokens: revokedRefreshTokens.count,
    removedConsents: removedConsents.count,
  };
}

function countByClient(tokens: readonly TokenRecord[]) {
  const counts = new Map<string, number>();

  for (const token of tokens) {
    counts.set(token.clientId, (counts.get(token.clientId) ?? 0) + 1);
  }

  return counts;
}
