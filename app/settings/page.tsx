import { ShieldCheck, ShieldPlus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AppShell } from "@/src/components/layout/AppShell";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/Card";
import { SectionHead } from "@/src/components/ui/SectionHead";
import {
  mapMemberToShellProfile,
  mapMemberToShellRole,
  mapMemberToShellUser,
  requireSecuritySettingsAppMember,
  sanitizeCallbackURL,
} from "@/src/server/auth/app-access";
import { getGoogleAuthSettings } from "@/src/server/auth/sign-in-methods";
import { prisma } from "@/src/server/db/client";
import { SecuritySettingsClient } from "./SecuritySettingsClient";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams: Promise<{
    callbackURL?: string | string[];
    reason?: string | string[];
    setup?: string | string[];
  }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const callbackURL = sanitizeCallbackURL(getSingleParam(params.callbackURL));
  const setupParam = getSingleParam(params.setup);
  const setupReason = getSingleParam(params.reason);
  const access = await requireSecuritySettingsAppMember("/settings");
  const t = await getTranslations("Settings");
  const { member, authUser } = access;
  const securityState = await getSecurityState(authUser.id);
  const googleAuthSettings = getGoogleAuthSettings();
  const hasSecurityMethod = securityState.twoFactorEnabled || securityState.passkeys.length > 0;
  const adminTotpRequired = member.role === "ADMIN" && !securityState.twoFactorEnabled;
  const showSetupBanner =
    access.status === "security_setup_required" ||
    setupParam === "required" ||
    setupReason === "admin-totp-required" ||
    adminTotpRequired;
  const setupStillRequired = !hasSecurityMethod || adminTotpRequired;

  return (
    <AppShell
      current="settings"
      role={mapMemberToShellRole(member)}
      profile={mapMemberToShellProfile(member)}
      user={mapMemberToShellUser(member)}
    >
      <section className="mx-auto grid w-full max-w-[86rem] gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <SectionHead
          eyebrow={t("page.eyebrow")}
          title={t("page.title")}
          subtitle={t("page.subtitle")}
        />
        {showSetupBanner ? (
          <SecuritySetupBanner
            adminTotpRequired={adminTotpRequired}
            callbackURL={callbackURL}
            complete={!setupStillRequired}
            t={t}
          />
        ) : null}
        <SecuritySettingsClient
          user={{
            id: authUser.id,
            email: authUser.email,
            name: authUser.name,
            twoFactorEnabled: securityState.twoFactorEnabled,
            passwordEnabled: securityState.accounts.some(
              (account) => account.providerId === "credential",
            ),
            googleLinked: securityState.accounts.some((account) => account.providerId === "google"),
            googleAvailable: googleAuthSettings.enabled,
          }}
          passkeys={securityState.passkeys.map((passkey) => ({
            id: passkey.id,
            name: passkey.name,
            deviceType: passkey.deviceType,
            backedUp: passkey.backedUp,
            transports: passkey.transports,
            createdAt: passkey.createdAt?.toISOString() ?? null,
          }))}
          twoFactor={{
            enabled: securityState.twoFactorEnabled,
            verified: securityState.twoFactors.some((twoFactor) => twoFactor.verified),
            lockedUntil:
              securityState.twoFactors
                .find((twoFactor) => twoFactor.lockedUntil)
                ?.lockedUntil?.toISOString() ?? null,
            failedVerificationCount:
              securityState.twoFactors.find((twoFactor) => twoFactor.failedVerificationCount > 0)
                ?.failedVerificationCount ?? 0,
          }}
        />
      </section>
    </AppShell>
  );
}

function SecuritySetupBanner({
  adminTotpRequired,
  callbackURL,
  complete,
  t,
}: {
  adminTotpRequired: boolean;
  callbackURL: string;
  complete: boolean;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <Card variant={complete ? "selected" : "warning"} density="lg">
      <CardHeader className="block">
        <Badge tone={complete ? "success" : "warning"} dot>
          {complete ? t("setupBanner.securityReady") : t("setupBanner.actionRequired")}
        </Badge>
        <CardTitle className="mt-4 flex items-center gap-2">
          {complete ? (
            <ShieldCheck className="size-5 text-success" aria-hidden="true" />
          ) : (
            <ShieldPlus className="size-5 text-warning" aria-hidden="true" />
          )}
          {t("setupBanner.title")}
        </CardTitle>
        <CardDescription>
          {complete
            ? t("setupBanner.completeDescription")
            : adminTotpRequired
              ? t("setupBanner.adminTotpDescription")
              : t("setupBanner.memberDescription")}
        </CardDescription>
      </CardHeader>
      {complete && callbackURL !== "/settings" ? (
        <CardFooter>
          <Button asChild icon={ShieldCheck}>
            <Link href={callbackURL as Route}>{t("actions.continue")}</Link>
          </Button>
        </CardFooter>
      ) : (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {complete
              ? t("setupBanner.noFurtherAction")
              : adminTotpRequired
                ? t("setupBanner.adminTotpHint")
                : t("setupBanner.memberHint")}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

async function getSecurityState(userId: string) {
  const securityState = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      twoFactorEnabled: true,
      passkeys: {
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          name: true,
          deviceType: true,
          backedUp: true,
          transports: true,
          createdAt: true,
        },
      },
      accounts: {
        select: {
          providerId: true,
        },
      },
      twoFactors: {
        select: {
          verified: true,
          failedVerificationCount: true,
          lockedUntil: true,
        },
      },
    },
  });

  if (!securityState) {
    throw new Error("No auth account is linked to this member.");
  }

  return securityState;
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.at(0) ?? "";
  }

  return value ?? "";
}
