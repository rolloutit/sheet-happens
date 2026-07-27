import { ShieldAlert, UserX } from "lucide-react";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AccountStatusActions } from "./AccountStatusActions";
import { AuthShell } from "@/src/components/layout/AuthShell";
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
  const t = await getTranslations("AccountStatus");

  if (access.status === "anonymous") {
    redirect(loginRoute(callbackURL));
  }

  if (access.status === "second_factor_required") {
    redirect(secondFactorRoute(callbackURL));
  }

  if (access.status === "security_setup_required") {
    redirect(securitySetupRoute(callbackURL));
  }

  if (
    access.status === "active" &&
    reason !== "admin-required" &&
    reason !== "contractor-required"
  ) {
    redirect(callbackURL as Route);
  }

  const content = getAccountStatusContent(access.status, reason, t);

  return (
    <AuthShell mood="secure">
      <ErrorState
        icon={content.tone === "error" ? UserX : ShieldAlert}
        title={content.title}
        message={content.message}
        tone={content.tone}
        action={<AccountStatusActions />}
        className="w-full max-w-xl"
      />
    </AuthShell>
  );
}

function getAccountStatusContent(
  status: string,
  reason: string,
  t: Awaited<ReturnType<typeof getTranslations>>,
) {
  if (reason === "admin-required") {
    return {
      tone: "warning" as const,
      title: t("adminRequired.title"),
      message: t("adminRequired.message"),
    };
  }

  if (reason === "contractor-required") {
    return {
      tone: "warning" as const,
      title: t("contractorRequired.title"),
      message: t("contractorRequired.message"),
    };
  }

  if (status === "invited") {
    return {
      tone: "warning" as const,
      title: t("invited.title"),
      message: t("invited.message"),
    };
  }

  if (status === "inactive") {
    return {
      tone: "warning" as const,
      title: t("inactive.title"),
      message: t("inactive.message"),
    };
  }

  if (status === "deleted") {
    return {
      tone: "error" as const,
      title: t("deleted.title"),
      message: t("deleted.message"),
    };
  }

  return {
    tone: "warning" as const,
    title: t("unlinked.title"),
    message: t("unlinked.message"),
  };
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.at(0) ?? "";
  }

  return value ?? "";
}
