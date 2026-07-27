import type { Route } from "next";
import { redirect } from "next/navigation";

import { TwoFactorChallengePanel } from "./TwoFactorChallengePanel";
import { AuthShell } from "@/src/components/layout/AuthShell";
import {
  accountStatusRoute,
  getAppAccessState,
  loginRoute,
  sanitizeCallbackURL,
  securitySetupRoute,
} from "@/src/server/auth/app-access";

type TwoFactorPageProps = {
  searchParams: Promise<{
    callbackURL?: string | string[];
  }>;
};

export const dynamic = "force-dynamic";

export default async function TwoFactorPage({ searchParams }: TwoFactorPageProps) {
  const params = await searchParams;
  const callbackURL = sanitizeCallbackURL(getSingleParam(params.callbackURL));
  const access = await getAppAccessState();

  if (access.status === "active") {
    redirect(callbackURL as Route);
  }

  if (access.status === "anonymous") {
    redirect(loginRoute(callbackURL));
  }

  if (access.status === "security_setup_required") {
    redirect(securitySetupRoute(callbackURL));
  }

  if (access.status !== "second_factor_required") {
    redirect(accountStatusRoute(callbackURL));
  }

  return (
    <AuthShell mood="secure">
      <TwoFactorChallengePanel callbackURL={callbackURL} />
    </AuthShell>
  );
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.at(0) ?? "";
  }

  return value ?? "";
}
