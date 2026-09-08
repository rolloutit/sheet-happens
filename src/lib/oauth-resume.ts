/**
 * Getting an interrupted OAuth authorization back on its feet after login.
 *
 * When Better Auth's OAuth provider finds no session it redirects to the login page with the ENTIRE
 * authorization request in the query string. Its own way of resuming is a global `after` hook that
 * fires when a sign-in response sets the session cookie and the request body carried an
 * `oauth_query` — which works for a password POST and not at all for this app: a magic link is
 * verified by a `GET` with no body, so the hook can never see it, and that is the primary way people
 * sign in here.
 *
 * So the request is resumed the other way round: the login page turns the pending authorization into
 * an ordinary `callbackURL`, and every sign-in method — magic link, passkey, password, and the
 * second-factor hop after any of them — lands back on `/oauth2/authorize` with the same parameters
 * and now a session. The provider then continues to `/consent` exactly as if the member had been
 * signed in all along.
 *
 * Nothing is trusted here. These parameters are re-validated by the authorize endpoint (client id,
 * redirect URI match, PKCE, resource) before anything is issued.
 */

export const OAUTH_AUTHORIZE_PATH = "/api/auth/oauth2/authorize";

/**
 * The provider's own signing parameters. They exist so a *body* can prove it carries the untampered
 * query, and they mean nothing on a fresh `GET /oauth2/authorize` — so they are dropped rather than
 * forwarded, which also keeps the resumed URL short enough to survive being embedded in a magic
 * link.
 */
const SIGNING_PARAMS = new Set(["sig", "exp", "ba_iat", "ba_pl", "ba_param"]);

/**
 * Prompt values that would send the provider straight back to the login page it just came from.
 * `prompt` may hold several space-separated values (`"login consent"`), so the tokens are filtered
 * individually and `consent` is deliberately preserved — a client that asked to see the consent
 * screen every time still should.
 */
const LOOPING_PROMPTS = new Set(["login", "create"]);

/**
 * The URL to return to after signing in, or `null` when this is not an OAuth hand-off.
 *
 * `client_id` is the marker: the provider always sends it, and no other flow that lands on `/login`
 * carries one.
 */
export function buildAuthorizeResumeUrl(
  params: Record<string, string | string[] | undefined>,
): string | null {
  const clientId = firstValue(params.client_id);

  if (!clientId) {
    return null;
  }

  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || SIGNING_PARAMS.has(key)) continue;

    // `callbackURL` is ours, not the provider's; forwarding it would nest one hand-off inside
    // another.
    if (key === "callbackURL") continue;

    for (const entry of Array.isArray(value) ? value : [value]) {
      if (key === "prompt") {
        const kept = entry
          .split(/\s+/)
          .filter((token) => token && !LOOPING_PROMPTS.has(token))
          .join(" ");

        if (kept) query.append(key, kept);

        continue;
      }

      query.append(key, entry);
    }
  }

  const search = query.toString();

  return search ? `${OAUTH_AUTHORIZE_PATH}?${search}` : OAUTH_AUTHORIZE_PATH;
}

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.at(0) ?? "";

  return value ?? "";
}
