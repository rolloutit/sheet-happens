import { headers } from "next/headers";

import { auth } from "@/src/server/auth/auth";
import { prisma } from "@/src/server/db/client";

export class AuthenticationError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  constructor(message = "You are not allowed to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function getSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function requireSession() {
  const session = await getSession();

  if (!session) {
    throw new AuthenticationError();
  }

  return session;
}

export async function getCurrentMember() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  return prisma.member.findUnique({
    where: {
      authUserId: session.user.id,
    },
  });
}

export async function requireMember() {
  const session = await requireSession();

  const member = await prisma.member.findUnique({
    where: {
      authUserId: session.user.id,
    },
  });

  if (!member) {
    throw new AuthorizationError("No Sheet Happens member is linked to this auth account.");
  }

  return member;
}

export async function requireActiveMember() {
  const member = await requireMember();

  if (member.status !== "ACTIVE" || member.deletedAt) {
    throw new AuthorizationError("Your Sheet Happens account is not active.");
  }

  return member;
}

export async function requireAdmin() {
  const member = await requireActiveMember();

  if (member.role !== "ADMIN") {
    throw new AuthorizationError("Admin access required.");
  }

  return member;
}

export async function requireProfile(profile: "CONTRACTOR" | "EMPLOYEE") {
  const member = await requireActiveMember();

  if (member.currentProfile !== profile) {
    throw new AuthorizationError(`${profile.toLowerCase()} profile required.`);
  }

  return member;
}
