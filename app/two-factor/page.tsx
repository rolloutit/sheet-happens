import type { Route } from "next";
import { redirect } from "next/navigation";

import { TwoFactorChallengePanel } from "./TwoFactorChallengePanel";
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
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <TwoFactorChallengePanel callbackURL={callbackURL} />
    </main>
  );
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.at(0) ?? "";
  }

  return value ?? "";
}
