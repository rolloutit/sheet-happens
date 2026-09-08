import { prisma } from "@/src/server/db/client";

import { MCP_SCOPES, type McpScope } from "./scopes";

/**
 * What the `/consent` page needs to render, read out of the query the OAuth provider redirected
 * with. Nothing here is trusted for authorization — the provider re-verifies the signature when the
 * form posts back — it is only what the member is shown before deciding.
 */
export type ConsentRequestView = {
  clientId: string;
  /** Requested scopes we recognise, in the order `MCP_SCOPES` declares them. */
  scopes: McpScope[];
  /**
   * Requested scopes we do not. Shown verbatim rather than hidden: a member should never grant
   * something the page declined to name, and this is also how a scope added to the provider but not
   * to the page surfaces during review instead of silently.
   */
  unknownScopes: string[];
  /** Unix seconds. The provider ties this to `codeExpiresIn` (10 minutes by default). */
  expiresAt: number | null;
  /** True when the signed request has aged out and the member has to start again from Claude. */
  isExpired: boolean;
};

export type ConsentClientView = {
  clientId: string;
  /**
   * What the member is asked to trust. For a Client ID Metadata Document client this is the HOST of
   * the `client_id` URL — the CIMD draft requires naming the origin that vouches for the document,
   * and a self-declared `client_name` is not evidence of anything. A registered client has no such
   * origin, so its stored name is used, falling back to the opaque id.
   */
  displayName: string;
  /** Present only for a CIMD client; `null` means "there is no verifiable origin to show". */
  host: string | null;
  clientUri: string | null;
  isMetadataDocument: boolean;
};

/**
 * The scope groups the consent page lists.
 *
 * The ids are camelCase rather than the scope strings themselves because they are used as i18n key
 * segments, and a `:` inside a message key is asking for trouble with a dotted-path lookup.
 *
 * `openid`, `profile` and `offline_access` collapse into one line: individually they are OAuth
 * plumbing a member cannot act on, and listing three of them next to the two that actually grant
 * data access would bury the decision that matters.
 */
export const CONSENT_SCOPE_GROUPS = [
  { id: "timeRead", scopes: ["time:read"] },
  { id: "timeWrite", scopes: ["time:write"] },
  { id: "identity", scopes: ["openid", "profile", "offline_access"] },
] as const satisfies ReadonlyArray<{ id: string; scopes: readonly McpScope[] }>;

export type ConsentScopeGroupId = (typeof CONSENT_SCOPE_GROUPS)[number]["id"];

export function parseConsentRequest(
  params: Record<string, string | string[] | undefined>,
  now: Date = new Date(),
): ConsentRequestView | null {
  const clientId = readSingle(params.client_id);

  if (!clientId) {
    return null;
  }

  const requested = readSingle(params.scope)?.split(/\s+/).filter(Boolean) ?? [];
  const known = new Set<string>(MCP_SCOPES);
  const expiresAtRaw = Number.parseInt(readSingle(params.exp) ?? "", 10);
  const expiresAt = Number.isFinite(expiresAtRaw) ? expiresAtRaw : null;

  return {
    clientId,
    // Ordered by `MCP_SCOPES` rather than by the request, so the page reads the same way every time
    // regardless of how a client happened to order its `scope` parameter.
    scopes: MCP_SCOPES.filter((scope) => requested.includes(scope)),
    unknownScopes: requested.filter((scope) => !known.has(scope)),
    expiresAt,
    isExpired: expiresAt !== null && expiresAt * 1000 <= now.getTime(),
  };
}

/** Which groups to render, and which of their scopes were actually asked for. */
export function groupConsentScopes(scopes: readonly McpScope[]) {
  return CONSENT_SCOPE_GROUPS.filter((group) =>
    group.scopes.some((scope) => scopes.includes(scope)),
  ).map((group) => ({
    id: group.id,
    scopes: group.scopes.filter((scope) => scopes.includes(scope)),
  }));
}

export async function loadConsentClient(
  clientId: string,
  deps: { db?: { oauthClient: { findUnique: (args: unknown) => Promise<unknown> } } } = {},
): Promise<ConsentClientView> {
  const host = clientIdHost(clientId);

  const db = deps.db ?? prisma;
  const client = (await db.oauthClient.findUnique({
    where: { clientId },
    select: { clientId: true, name: true, uri: true, clientDiscoveryId: true, disabled: true },
  })) as {
    clientId: string;
    name: string | null;
    uri: string | null;
    clientDiscoveryId: string | null;
    disabled: boolean | null;
  } | null;

  const isMetadataDocument = Boolean(host) || client?.clientDiscoveryId === "cimd";

  return {
    clientId,
    displayName: host ?? client?.name?.trim() ?? clientId,
    host,
    clientUri: client?.uri ?? null,
    isMetadataDocument,
  };
}

/**
 * The host of a `client_id` that is an HTTPS URL, i.e. a Client ID Metadata Document.
 *
 * A registered client's id is an opaque random string, so `URL` parsing fails and this returns
 * `null`. HTTPS is required rather than assumed: an `http:` client id would not have passed CIMD
 * validation, and treating one as a verified origin here would be the whole point of the check
 * thrown away.
 */
export function clientIdHost(clientId: string): string | null {
  try {
    const url = new URL(clientId);

    return url.protocol === "https:" ? url.host : null;
  } catch {
    return null;
  }
}

/** A repeated query parameter arrives as an array; only the first value is meaningful here. */
function readSingle(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value.at(0);

  return value;
}
