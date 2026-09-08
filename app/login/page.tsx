import type { Route } from "next";
import { redirect } from "next/navigation";

import { LoginPanel } from "./LoginPanel";
import { AuthShell } from "@/src/components/layout/AuthShell";
import {
  accountStatusRoute,
  getAppAccessState,
  sanitizeCallbackURL,
  securitySetupRoute,
  secondFactorRoute,
} from "@/src/server/auth/app-access";
import { buildAuthorizeResumeUrl } from "@/src/lib/oauth-resume";
import { getGoogleAuthSettings } from "@/src/server/auth/sign-in-methods";

type LoginPageProps = {
  /*
   * Open-ended rather than the three parameters this page owns: the OAuth provider redirects here
   * with a whole authorization request in the query, and `buildAuthorizeResumeUrl` needs to see all
   * of it.
   */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const requestedCallbackURL = getSingleParam(params.callbackURL);

  /*
   * Normalize an OAuth hand-off into an explicit `callbackURL` and redirect, rather than just
   * computing it for `LoginPanel`.
   *
   * Everything downstream reads the parameter from the address bar: `LoginPanel` navigates to it,
   * and `getCurrentCallbackURL` in the auth client rebuilds it for the second-factor hop — and its
   * fallback is `pathname + search`, which on `/login?client_id=…` sanitizes to `/dashboard` and
   * loses the pending authorization. Putting the parameter in the URL once means no other file has
   * to know this flow exists.
   */
  if (!requestedCallbackURL) {
    const resumeURL = buildAuthorizeResumeUrl(params);

    if (resumeURL) {
      redirect(`/login?callbackURL=${encodeURIComponent(resumeURL)}` as Route);
    }
  }

  const callbackURL = sanitizeCallbackURL(requestedCallbackURL);
  const googleAuthSettings = getGoogleAuthSettings();
  const access = await getAppAccessState();

  if (access.status === "active") {
    redirect(callbackURL as Route);
  }

  if (access.status === "second_factor_required") {
    redirect(secondFactorRoute(callbackURL));
  }

  if (access.status === "security_setup_required") {
    redirect(securitySetupRoute(callbackURL));
  }

  if (access.status !== "anonymous") {
    redirect(accountStatusRoute(callbackURL));
  }

  return (
    <AuthShell mood="back">
      <LoginPanel
        callbackURL={callbackURL}
        googleEnabled={googleAuthSettings.enabled}
        initialEmail={getSingleParam(params.email)}
        initialError={getSingleParam(params.error)}
      />
    </AuthShell>
  );
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.at(0) ?? "";
  }

  return value ?? "";
}
