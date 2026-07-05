import Link from "next/link";

import { AppShell } from "@/src/components/layout/AppShell";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { Button } from "@/src/components/ui/Button";
import { SectionHead } from "@/src/components/ui/SectionHead";
import {
  AuthenticationError,
  AuthorizationError,
  requireActiveMember,
} from "@/src/server/auth/session";
import { prisma } from "@/src/server/db/client";
import { SecuritySettingsClient } from "./SecuritySettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const pageState = await getSettingsPageState();

  if (pageState.status === "denied") {
    return (
      <AppShell current="settings" role="employee" notifications={[]}>
        <section className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-3xl place-items-center px-4 py-10 sm:px-6 lg:px-8">
          <ErrorState
            title={
              pageState.error instanceof AuthenticationError
                ? "Sign-in required"
                : "Account unavailable"
            }
            message={
              pageState.error instanceof AuthenticationError
                ? "Sign in with an active Sheet Happens account before managing security settings."
                : pageState.error.message
            }
            tone="warning"
            action={
              <Button asChild variant="soft">
                <Link href="/">Back to home</Link>
              </Button>
            }
          />
        </section>
      </AppShell>
    );
  }

  const { authUser, member } = pageState;

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
            twoFactorEnabled: authUser.twoFactorEnabled,
          }}
          passkeys={authUser.passkeys.map((passkey) => ({
            id: passkey.id,
            name: passkey.name,
            deviceType: passkey.deviceType,
            backedUp: passkey.backedUp,
            transports: passkey.transports,
            createdAt: passkey.createdAt?.toISOString() ?? null,
          }))}
          twoFactor={{
            enabled: authUser.twoFactorEnabled,
            verified: authUser.twoFactors.some((twoFactor) => twoFactor.verified),
            lockedUntil:
              authUser.twoFactors
                .find((twoFactor) => twoFactor.lockedUntil)
                ?.lockedUntil?.toISOString() ?? null,
            failedVerificationCount:
              authUser.twoFactors.find((twoFactor) => twoFactor.failedVerificationCount > 0)
                ?.failedVerificationCount ?? 0,
          }}
        />
      </section>
    </AppShell>
  );
}

async function getSettingsPageState() {
  try {
    const member = await requireActiveMember();

    if (!member.authUserId) {
      throw new AuthorizationError("No auth account is linked to this member.");
    }

    const authUser = await prisma.user.findUnique({
      where: {
        id: member.authUserId,
      },
      select: {
        id: true,
        name: true,
        email: true,
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

    if (!authUser) {
      throw new AuthorizationError("No auth account is linked to this member.");
    }

    return {
      status: "authorized" as const,
      member,
      authUser,
    };
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return {
        status: "denied" as const,
        error,
      };
    }

    throw error;
  }
}

function mapMemberToShellRole(member: {
  role: "ADMIN" | "MEMBER";
  currentProfile: "CONTRACTOR" | "EMPLOYEE";
}) {
  if (member.role === "ADMIN") return "admin";
  return member.currentProfile === "CONTRACTOR" ? "contractor" : "employee";
}

function mapMemberToShellUser(member: {
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "ADMIN" | "MEMBER";
}) {
  const name =
    member.displayName.trim() ||
    [member.firstName.trim(), member.lastName.trim()].filter(Boolean).join(" ") ||
    member.email;

  return {
    name,
    email: member.email,
    role: member.role === "ADMIN" ? "Admin" : "Member",
    initials: getInitials(name),
  };
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.at(0)?.toUpperCase() ?? "")
    .join("");
}
