"use server";

import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { requireActiveAppMemberForAction } from "@/src/server/auth/app-access";
import { auth } from "@/src/server/auth/auth";
import { authUrls } from "@/src/server/auth/auth-urls";
import { authErrorStatus } from "@/src/server/auth/route-errors";

export type ConsentDecisionState =
  { status: "idle" } | { status: "redirect"; url: string } | { status: "error"; message: string };

/**
 * Records the member's decision and hands back where to send the browser.
 *
 * The provider answers with a URL rather than an HTTP redirect, so navigation is the caller's job —
 * and it has to be a real navigation, not a `router.push`: the target is the OAuth client's
 * `redirect_uri`, which is off-origin (`https://claude.ai/api/mcp/auth_callback`) for every hosted
 * Claude surface.
 *
 * `signedQuery` is the provider's own signed copy of the authorization request. It is passed through
 * untouched and untrusted: the endpoint re-verifies the HMAC and the expiry before acting, so a
 * tampered or stale one is refused there rather than here.
 */
export async function submitConsentDecision(input: {
  accept: boolean;
  signedQuery: string;
}): Promise<ConsentDecisionState> {
  const t = await getTranslations("ConsentActions");

  try {
    // The same gate the page ran. A page render and a form post are separate requests, and a
    // membership can be revoked between them — this is the one that decides.
    await requireActiveAppMemberForAction();

    if (!input.signedQuery) {
      return { status: "error", message: t("errors.expired") };
    }

    const requestHeaders = await headers();

    /*
     * Dispatched through `auth.handler` with a hand-built request, NOT through
     * `auth.api.oauth2Consent(...)`.
     *
     * The provider restores the pending authorization from a request-scoped store that a global
     * `before` hook fills when it sees `oauth_query` in the body. That hook runs in the HTTP
     * dispatch pipeline; calling the endpoint directly through `auth.api` skips it, so the handler
     * finds no pending request and refuses every decision with `invalid_request` — which reaches
     * the member as "this request is no longer valid" on a request that is perfectly valid.
     *
     * There is no HTTP hop here: `auth.handler` is the same in-process function the catch-all route
     * calls. The headers it needs are the browser's own — the session cookie to authenticate, and an
     * `Origin` because Better Auth refuses a state-changing request without one.
     */
    const response = await auth.handler(
      new Request(`${authUrls.issuer}/oauth2/consent`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: requestHeaders.get("cookie") ?? "",
          origin: requestHeaders.get("origin") ?? authUrls.origin,
        },
        body: JSON.stringify({
          accept: input.accept,
          oauth_query: input.signedQuery,
        }),
      }),
    );

    const url = await readRedirectUrl(response);

    if (!url) {
      if (response.status === 400 || response.status === 401) {
        // `invalid_signature` and an aged-out `exp` both land here. They are the same thing to a
        // member — the request they started in Claude is no longer usable — and the fix is the same:
        // start again from Claude rather than reload this page, whose query is what expired.
        return { status: "error", message: t("errors.expired") };
      }

      console.error("[consent] provider returned no redirect target", {
        status: response.status,
      });

      return { status: "error", message: t("errors.generic") };
    }

    return { status: "redirect", url };
  } catch (error) {
    const authStatus = authErrorStatus(error);

    if (authStatus === 401 || authStatus === 403) {
      return { status: "error", message: t("errors.notAllowed") };
    }

    console.error("[consent] decision failed", error);

    return { status: "error", message: t("errors.generic") };
  }
}

/**
 * The redirect target, from wherever this build of the provider puts it.
 *
 * The installed build answers `200 { redirect: true, url }`; its own JSDoc documents
 * `{ redirect_uri }`; and a `Location` header would be the third reasonable shape. Accepting all
 * three costs nothing, and picking wrong strands the member on a blank page holding a valid grant.
 */
async function readRedirectUrl(response: Response): Promise<string | null> {
  const location = response.headers.get("location");

  if (location) {
    return location;
  }

  const body = await response.text();

  if (!body) {
    return null;
  }

  try {
    const parsed = JSON.parse(body) as { url?: unknown; redirect_uri?: unknown };

    if (typeof parsed.url === "string" && parsed.url) return parsed.url;
    if (typeof parsed.redirect_uri === "string" && parsed.redirect_uri) return parsed.redirect_uri;
  } catch {
    return null;
  }

  return null;
}
