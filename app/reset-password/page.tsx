import type { Route } from "next";
import { redirect } from "next/navigation";

import {
  getAppAccessState,
  sanitizeCallbackURL,
  securitySetupRoute,
  secondFactorRoute,
} from "@/src/server/auth/app-access";
import { AuthShell } from "@/src/components/layout/AuthShell";
import { ResetPasswordPanel } from "./ResetPasswordPanel";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    callbackURL?: string | string[];
    error?: string | string[];
    token?: string | string[];
  }>;
};

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const callbackURL = sanitizeCallbackURL(getSingleParam(params.callbackURL) || "/dashboard");
  const token = getSingleParam(params.token);
  const error = getSingleParam(params.error);
  const access = await getAppAccessState();

  if (access.status === "active" && !token && !error) {
    redirect(callbackURL as Route);
  }

  if (access.status === "second_factor_required" && !token && !error) {
    redirect(secondFactorRoute(callbackURL));
  }

  if (access.status === "security_setup_required" && !token && !error) {
    redirect(securitySetupRoute(callbackURL));
  }

  return (
    <AuthShell mood="fresh">
      <ResetPasswordPanel callbackURL={callbackURL} initialError={error} token={token} />
    </AuthShell>
  );
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.at(0) ?? "";
  }

  return value ?? "";
}
