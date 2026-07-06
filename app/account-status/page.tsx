import { ShieldAlert, UserX } from "lucide-react";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { AccountStatusActions } from "./AccountStatusActions";
import { ErrorState } from "@/src/components/ui/ErrorState";
import {
  getAppAccessState,
  loginRoute,
  sanitizeCallbackURL,
  securitySetupRoute,
  secondFactorRoute,
} from "@/src/server/auth/app-access";

type AccountStatusPageProps = {
  searchParams: Promise<{
    callbackURL?: string | string[];
    reason?: string | string[];
  }>;
};

export const dynamic = "force-dynamic";

export default async function AccountStatusPage({ searchParams }: AccountStatusPageProps) {
  const params = await searchParams;
  const callbackURL = sanitizeCallbackURL(getSingleParam(params.callbackURL));
  const reason = getSingleParam(params.reason);
  const access = await getAppAccessState();

  if (access.status === "anonymous") {
    redirect(loginRoute(callbackURL));
  }

  if (access.status === "second_factor_required") {
    redirect(secondFactorRoute(callbackURL));
  }

  if (access.status === "security_setup_required") {
    redirect(securitySetupRoute(callbackURL));
  }

  if (access.status === "active" && reason !== "admin-required") {
    redirect(callbackURL as Route);
  }

  const content = getAccountStatusContent(access.status, reason);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8">
      <ErrorState
        icon={content.tone === "error" ? UserX : ShieldAlert}
        title={content.title}
        message={content.message}
        tone={content.tone}
        action={<AccountStatusActions />}
        className="w-full max-w-xl"
      />
    </main>
  );
}

function getAccountStatusContent(status: string, reason: string) {
  if (reason === "admin-required") {
    return {
      tone: "warning" as const,
      title: "Admin access required",
      message: "Your account is active, but it does not have permission to open this admin area.",
    };
  }

  if (status === "invited") {
    return {
      tone: "warning" as const,
      title: "Account not activated",
      message: "Use your invitation link once to activate this member profile.",
    };
  }

  if (status === "inactive") {
    return {
      tone: "warning" as const,
      title: "Account inactive",
      message: "This member profile is inactive. Ask an admin to reactivate it.",
    };
  }

  if (status === "deleted") {
    return {
      tone: "error" as const,
      title: "Account unavailable",
      message: "This member profile is deleted and cannot access Sheet Happens.",
    };
  }

  return {
    tone: "warning" as const,
    title: "No member profile linked",
    message: "This auth account is not linked to a Sheet Happens member profile.",
  };
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.at(0) ?? "";
  }

  return value ?? "";
}
