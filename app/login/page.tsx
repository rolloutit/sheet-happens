import type { Route } from "next";
import { redirect } from "next/navigation";

import { LoginPanel } from "./LoginPanel";
import {
  accountStatusRoute,
  getAppAccessState,
  sanitizeCallbackURL,
  secondFactorRoute,
} from "@/src/server/auth/app-access";

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
  const access = await getAppAccessState();

  if (access.status === "active") {
    redirect(callbackURL as Route);
  }

  if (access.status === "second_factor_required") {
    redirect(secondFactorRoute(callbackURL));
  }

  if (access.status !== "anonymous") {
    redirect(accountStatusRoute(callbackURL));
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <LoginPanel
        callbackURL={callbackURL}
        initialEmail={getSingleParam(params.email)}
        initialError={getSingleParam(params.error)}
      />
    </main>
  );
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.at(0) ?? "";
  }

  return value ?? "";
}
