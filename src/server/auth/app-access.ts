import type { Route } from "next";
import { redirect } from "next/navigation";

import { AuthenticationError, AuthorizationError, getSession } from "./session";
import { hasSatisfiedSecondFactor } from "./second-factor";
import { prisma } from "@/src/server/db/client";

export type AppAccessState =
  | {
      status: "anonymous";
      session: null;
      member: null;
      authUser: null;
    }
  | {
      status: "unlinked" | "invited" | "inactive" | "deleted";
      session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
      member: AppMember | null;
      authUser: AppAuthUser;
    }
  | {
      status: "second_factor_required";
      session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
      member: AppMember;
      authUser: AppAuthUser;
    }
  | {
      status: "security_setup_required";
      session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
      member: AppMember;
      authUser: AppAuthUser;
    }
  | {
      status: "active";
      session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
      member: AppMember;
      authUser: AppAuthUser;
    };

export type ActiveAppAccess = Extract<AppAccessState, { status: "active" }>;
export type SecuritySettingsAppAccess = Extract<
  AppAccessState,
  { status: "active" | "security_setup_required" }
>;

export type AppMember = {
  id: string;
  authUserId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  role: "ADMIN" | "MEMBER";
  status: "INVITED" | "ACTIVE" | "INACTIVE" | "DELETED";
  currentProfile: "CONTRACTOR" | "EMPLOYEE";
  deletedAt: Date | null;
};

export type AppAuthUser = {
  id: string;
  name: string;
  email: string;
  twoFactorEnabled: boolean;
  passkeyCount: number;
};

export async function getAppAccessState(): Promise<AppAccessState> {
  const session = await getSession();

  if (!session) {
    return {
      status: "anonymous",
      session: null,
      member: null,
      authUser: null,
    };
  }

  const [member, authUser, passkeyCount] = await Promise.all([
    prisma.member.findUnique({
      where: {
        authUserId: session.user.id,
      },
      select: {
        id: true,
        authUserId: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        role: true,
        status: true,
        currentProfile: true,
        deletedAt: true,
      },
    }),
    prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        twoFactorEnabled: true,
      },
    }),
    prisma.passkey.count({
      where: {
        userId: session.user.id,
      },
    }),
  ]);

  const resolvedAuthUser: AppAuthUser = authUser
    ? {
        ...authUser,
        passkeyCount,
      }
    : {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        twoFactorEnabled: Boolean(
          (session.user as { twoFactorEnabled?: boolean }).twoFactorEnabled,
        ),
        passkeyCount,
      };

  if (!member) {
    return {
      status: "unlinked",
      session,
      member: null,
      authUser: resolvedAuthUser,
    };
  }

  if (member.deletedAt) {
    return {
      status: "deleted",
      session,
      member,
      authUser: resolvedAuthUser,
    };
  }

  if (member.status === "DELETED") {
    return {
      status: "deleted",
      session,
      member,
      authUser: resolvedAuthUser,
    };
  }

  if (member.status === "INVITED") {
    return {
      status: "invited",
      session,
      member,
      authUser: resolvedAuthUser,
    };
  }

  if (member.status === "INACTIVE") {
    return {
      status: "inactive",
      session,
      member,
      authUser: resolvedAuthUser,
    };
  }

  if (
    resolvedAuthUser.twoFactorEnabled &&
    !(await hasSatisfiedSecondFactor({
      userId: session.user.id,
      sessionToken: session.session.token,
    }))
  ) {
    return {
      status: "second_factor_required",
      session,
      member,
      authUser: resolvedAuthUser,
    };
  }

  if (!hasCompletedSecuritySetup(resolvedAuthUser)) {
    return {
      status: "security_setup_required",
      session,
      member,
      authUser: resolvedAuthUser,
    };
  }

  return {
    status: "active",
    session,
    member,
    authUser: resolvedAuthUser,
  };
}

export async function requireActiveAppMember(callbackURL: string): Promise<ActiveAppAccess> {
  const state = await getAppAccessState();

  if (state.status === "anonymous") {
    redirect(loginRoute(callbackURL));
  }

  if (state.status === "second_factor_required") {
    redirect(secondFactorRoute(callbackURL));
  }

  if (state.status === "security_setup_required") {
    redirect(securitySetupRoute(callbackURL));
  }

  if (state.status !== "active") {
    redirect(accountStatusRoute(callbackURL));
  }

  return state;
}

export async function requireAdminAppMember(callbackURL: string): Promise<ActiveAppAccess> {
  const state = await requireActiveAppMember(callbackURL);

  if (state.member.role !== "ADMIN") {
    redirect(accountStatusRoute(callbackURL, "admin-required"));
  }

  if (!state.authUser.twoFactorEnabled) {
    redirect(securitySetupRoute(callbackURL, "admin-totp-required"));
  }

  return state;
}

export async function requireSecuritySettingsAppMember(
  callbackURL: string,
): Promise<SecuritySettingsAppAccess> {
  const state = await getAppAccessState();

  if (state.status === "anonymous") {
    redirect(loginRoute(callbackURL));
  }

  if (state.status === "second_factor_required") {
    redirect(secondFactorRoute(callbackURL));
  }

  if (state.status !== "active" && state.status !== "security_setup_required") {
    redirect(accountStatusRoute(callbackURL));
  }

  return state;
}

export async function requireActiveAppMemberForAction(): Promise<ActiveAppAccess> {
  const state = await getAppAccessState();

  if (state.status === "anonymous") {
    throw new AuthenticationError();
  }

  if (state.status === "second_factor_required") {
    throw new AuthorizationError("Second-factor verification required.");
  }

  if (state.status === "security_setup_required") {
    throw new AuthorizationError("Complete security setup before using Sheet Happens.");
  }

  if (state.status !== "active") {
    throw new AuthorizationError("Your Sheet Happens account is not active.");
  }

  return state;
}

export async function requireAdminAppMemberForAction(): Promise<ActiveAppAccess> {
  const state = await requireActiveAppMemberForAction();

  if (state.member.role !== "ADMIN") {
    throw new AuthorizationError("Admin access required.");
  }

  if (!state.authUser.twoFactorEnabled) {
    throw new AuthorizationError("Authenticator app setup is required for admin actions.");
  }

  return state;
}

export function loginRoute(callbackURL: string) {
  return `/login?callbackURL=${encodeURIComponent(sanitizeCallbackURL(callbackURL))}` as Route;
}

export function secondFactorRoute(callbackURL: string) {
  return `/two-factor?callbackURL=${encodeURIComponent(sanitizeCallbackURL(callbackURL))}` as Route;
}

export function securitySetupRoute(callbackURL: string, reason?: string) {
  const params = new URLSearchParams({
    setup: "required",
    callbackURL: sanitizeCallbackURL(callbackURL),
  });

  if (reason) params.set("reason", reason);

  return `/settings?${params.toString()}` as Route;
}

export function accountStatusRoute(callbackURL: string, reason?: string) {
  const params = new URLSearchParams({
    callbackURL: sanitizeCallbackURL(callbackURL),
  });

  if (reason) params.set("reason", reason);

  return `/account-status?${params.toString()}` as Route;
}

export function sanitizeCallbackURL(callbackURL: string | undefined) {
  if (!callbackURL || !callbackURL.startsWith("/") || callbackURL.startsWith("//")) {
    return "/dashboard";
  }

  return callbackURL;
}

export function mapMemberToShellRole(member: Pick<AppMember, "role" | "currentProfile">) {
  if (member.role === "ADMIN") return "admin";
  return member.currentProfile === "CONTRACTOR" ? "contractor" : "employee";
}

export function mapMemberToShellUser(
  member: Pick<AppMember, "displayName" | "firstName" | "lastName" | "email" | "role">,
) {
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

function hasCompletedSecuritySetup(authUser: AppAuthUser) {
  return authUser.twoFactorEnabled || authUser.passkeyCount > 0;
}
