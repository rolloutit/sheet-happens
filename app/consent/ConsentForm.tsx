"use client";

import { Check, ShieldCheck, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AuthNotice } from "@/src/components/layout/AuthForm";
import { Button } from "@/src/components/ui/Button";
import { buildSignedOAuthQuery } from "@/src/lib/oauth-signed-query";

import { submitConsentDecision } from "./actions";

export type ConsentFormProps = {
  scopeGroupIds: readonly string[];
  unknownScopes: readonly string[];
};

export function ConsentForm({ scopeGroupIds, unknownScopes }: ConsentFormProps) {
  const t = useTranslations("Consent");
  const [pending, setPending] = useState<"allow" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(accept: boolean) {
    setPending(accept ? "allow" : "deny");
    setError(null);

    /*
     * Read from the live URL rather than from a server-rendered prop.
     *
     * The provider verifies an HMAC over these parameters, so the string has to be byte-identical to
     * what it put in the address bar. Reconstructing it from Next's parsed `searchParams` would
     * re-encode every value, and one `+`-versus-`%20` difference is an `invalid_signature`. The
     * filter drops anything that was not signed, so an extra parameter picked up along the way
     * cannot break verification either.
     */
    const signedQuery = buildSignedOAuthQuery(window.location.search);
    const result = await submitConsentDecision({ accept, signedQuery });

    if (result.status === "redirect") {
      // A real navigation, not `router.push`: the target is the OAuth client's own origin.
      window.location.assign(result.url);
      return;
    }

    setPending(null);

    if (result.status === "error") {
      setError(result.message);
    }
  }

  return (
    <div className="grid gap-5">
      <ul className="grid gap-3">
        {scopeGroupIds.map((groupId) => (
          <li key={groupId} className="flex items-start gap-3">
            <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="grid gap-0.5">
              <p className="text-sm font-medium text-foreground">{t(`scopes.${groupId}.title`)}</p>
              <p className="text-sm leading-6 text-muted-foreground">
                {t(`scopes.${groupId}.description`)}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {unknownScopes.length > 0 ? (
        <AuthNotice tone="warning">
          {t("unknownScopes", { scopes: unknownScopes.join(", ") })}
        </AuthNotice>
      ) : null}

      {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="soft"
          icon={X}
          loading={pending === "deny"}
          disabled={pending !== null}
          onClick={() => void decide(false)}
        >
          {t("actions.deny")}
        </Button>
        <Button
          type="button"
          variant="primary"
          icon={Check}
          loading={pending === "allow"}
          disabled={pending !== null}
          onClick={() => void decide(true)}
        >
          {t("actions.allow")}
        </Button>
      </div>
    </div>
  );
}
