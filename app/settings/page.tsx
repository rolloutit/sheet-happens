import { ShieldCheck, ShieldPlus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

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
  mapMemberToShellRole,
  mapMemberToShellUser,
  requireSecuritySettingsAppMember,
  sanitizeCallbackURL,
} from "@/src/server/auth/app-access";
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
  const { member, authUser } = access;
  const securityState = await getSecurityState(authUser.id);
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
      user={mapMemberToShellUser(member)}
    >
      <section className="mx-auto grid w-full max-w-[86rem] gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <SectionHead
          eyebrow="Account"
          title="Security settings"
          subtitle="Manage passkeys and authenticator-app verification for your Sheet Happens account."
        />
        {showSetupBanner ? (
          <SecuritySetupBanner
            adminTotpRequired={adminTotpRequired}
            callbackURL={callbackURL}
            complete={!setupStillRequired}
          />
        ) : null}
        <SecuritySettingsClient
          user={{
            id: authUser.id,
            email: authUser.email,
            name: authUser.name,
            twoFactorEnabled: securityState.twoFactorEnabled,
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
}: {
  adminTotpRequired: boolean;
  callbackURL: string;
  complete: boolean;
}) {
  return (
    <Card variant={complete ? "selected" : "warning"} density="lg">
      <CardHeader className="block">
        <Badge tone={complete ? "success" : "warning"} dot>
          {complete ? "Security ready" : "Action required"}
        </Badge>
        <CardTitle className="mt-4 flex items-center gap-2">
          {complete ? (
            <ShieldCheck className="size-5 text-success" aria-hidden="true" />
          ) : (
            <ShieldPlus className="size-5 text-warning" aria-hidden="true" />
          )}
          Complete account security
        </CardTitle>
        <CardDescription>
          {complete
            ? "Security setup is complete. You can continue to the protected app."
            : adminTotpRequired
              ? "Admin tools require authenticator-app verification. Enable TOTP before returning to management screens."
              : "Add a passkey or enable an authenticator app before continuing to the protected app."}
        </CardDescription>
      </CardHeader>
      {complete && callbackURL !== "/settings" ? (
        <CardFooter>
          <Button asChild icon={ShieldCheck}>
            <Link href={callbackURL as Route}>Continue</Link>
          </Button>
        </CardFooter>
      ) : (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {complete
              ? "No further security action is required right now."
              : "Use the passkey or authenticator-app controls below to satisfy this requirement."}
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
