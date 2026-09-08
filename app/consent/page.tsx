import { ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AuthScreenHead } from "@/src/components/layout/AuthForm";
import { AuthShell } from "@/src/components/layout/AuthShell";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { requireActiveAppMember } from "@/src/server/auth/app-access";
import {
  groupConsentScopes,
  loadConsentClient,
  parseConsentRequest,
} from "@/src/server/mcp/consent";

import { ConsentForm } from "./ConsentForm";

type ConsentPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

/**
 * The OAuth consent screen.
 *
 * The provider redirects here with the whole authorization request signed into the query string, so
 * this page is reached mid-flow rather than navigated to. Two consequences shape it:
 *
 * - The gate runs FIRST, with a callback back to this exact URL. An invited, inactive, deleted or
 *   not-yet-two-factored member is bounced the same way they would be on `/time`. That is what stops
 *   MCP from becoming a side door around the account-status machine: a member who cannot use the web
 *   app cannot grant an agent access to it either.
 * - The query is short-lived. It carries the provider's `exp`, so a member who took too long over
 *   login gets told to start again from Claude rather than shown a button that will fail.
 */
export default async function ConsentPage({ searchParams }: ConsentPageProps) {
  const params = await searchParams;
  const consentRequest = parseConsentRequest(params);

  const { member } = await requireActiveAppMember(buildCallbackURL(params));
  const t = await getTranslations("Consent");

  if (!consentRequest || consentRequest.isExpired) {
    return (
      <AuthShell mood="secure">
        <ErrorState
          icon={ShieldAlert}
          title={t(consentRequest ? "expired.title" : "invalid.title")}
          message={t(consentRequest ? "expired.message" : "invalid.message")}
          tone="warning"
          className="w-full max-w-xl"
        />
      </AuthShell>
    );
  }

  const client = await loadConsentClient(consentRequest.clientId);
  const groups = groupConsentScopes(consentRequest.scopes);

  return (
    <AuthShell mood="secure">
      <div className="w-full max-w-xl">
        <AuthScreenHead
          eyebrow={t("eyebrow")}
          title={t("title", { client: client.displayName })}
          description={t("description", { name: member.displayName })}
        />
        <div className="mt-6">
          <ConsentForm
            scopeGroupIds={groups.map((group) => group.id)}
            unknownScopes={consentRequest.unknownScopes}
          />
        </div>
      </div>
    </AuthShell>
  );
}

/**
 * Where to come back to after login or a second factor.
 *
 * The whole signed query has to survive the bounce, because it *is* the pending authorization
 * request — dropping it would land the member on a consent page with nothing to consent to.
 * `sanitizeCallbackURL` (inside the guards) accepts an app-relative path with a query and rejects
 * anything absolute, so this stays a same-origin round trip.
 */
function buildCallbackURL(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;

    if (Array.isArray(value)) {
      for (const entry of value) query.append(key, entry);
    } else {
      query.append(key, value);
    }
  }

  const search = query.toString();

  return search ? `/consent?${search}` : "/consent";
}
