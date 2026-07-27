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
import { getGoogleAuthSettings } from "@/src/server/auth/sign-in-methods";

type LoginPageProps = {
  searchParams: Promise<{
    callbackURL?: string | string[];
    email?: string | string[];
    error?: string | string[];
  }>;
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const callbackURL = sanitizeCallbackURL(getSingleParam(params.callbackURL));
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
