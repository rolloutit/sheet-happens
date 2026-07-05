import type { Route } from "next";
import { redirect } from "next/navigation";

import { LoginPanel } from "./LoginPanel";
import { getCurrentMember } from "@/src/server/auth/session";

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
  const callbackURL = getLocalCallbackURL(params.callbackURL);
  const currentMember = await getCurrentMember();

  if (currentMember?.status === "ACTIVE" && !currentMember.deletedAt) {
    redirect(callbackURL as Route);
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

function getLocalCallbackURL(value: string | string[] | undefined) {
  const callbackURL = getSingleParam(value) || "/settings";

  if (!callbackURL.startsWith("/") || callbackURL.startsWith("//")) {
    return "/settings";
  }

  return callbackURL;
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.at(0) ?? "";
  }

  return value ?? "";
}
