import { AppShell } from "@/src/components/layout/AppShell";
import { SectionHead } from "@/src/components/ui/SectionHead";
import {
  mapMemberToShellRole,
  mapMemberToShellUser,
  requireActiveAppMember,
} from "@/src/server/auth/app-access";
import { prisma } from "@/src/server/db/client";
import { SecuritySettingsClient } from "./SecuritySettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { member, authUser } = await requireActiveAppMember("/settings");
  const securityState = await getSecurityState(authUser.id);

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
