import { passkey } from "@better-auth/passkey";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { magicLink, twoFactor } from "better-auth/plugins";

import { canCreateAuthUser, canSendAuthLink } from "@/src/server/auth/invite-policy";
import { sendMagicLinkEmail, sendPasswordResetEmail } from "@/src/server/auth/auth-emails";
import {
  decodeJwtPayload,
  getGoogleAuthSettings,
  isAllowedGoogleWorkspaceProfile,
} from "@/src/server/auth/sign-in-methods";
import { prisma } from "@/src/server/db/client";

const appName = "Sheet Happens";
const developmentFallbackSecret =
  "sheet-happens-local-dev-only-auth-secret-please-set-better-auth-secret";
export const authSecret = getAuthSecret();
const authBaseUrl =
  process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const authUrl = new URL(authBaseUrl);
const authOrigin = authUrl.origin;
const localDevelopmentOrigins = ["http://localhost:3000", "http://127.0.0.1:3000"];
const authBaseURLConfig =
  process.env.NODE_ENV === "production"
    ? authOrigin
    : {
        allowedHosts: Array.from(new Set([authUrl.host, "localhost:3000", "127.0.0.1:3000"])),
        fallback: authOrigin,
      };
const passkeyOrigins =
  process.env.NODE_ENV === "production"
    ? authOrigin
    : Array.from(new Set([authOrigin, ...localDevelopmentOrigins]));
const passkeyRpID = process.env.NODE_ENV === "production" ? authUrl.hostname : undefined;
export const googleAuthSettings = getGoogleAuthSettings();

const trustedOrigins = [
  authOrigin,
  ...(process.env.NODE_ENV === "production" ? [] : localDevelopmentOrigins),
  ...(process.env.AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];

type PasskeyAuditRecord = {
  id?: unknown;
  userId?: unknown;
  name?: unknown;
  deviceType?: unknown;
  backedUp?: unknown;
  transports?: unknown;
};

export const auth = betterAuth({
  appName,
  baseURL: authBaseURLConfig,
  secret: authSecret,
  trustedOrigins,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (await canCreateAuthUser(user.email)) {
            return;
          }

          return false;
        },
      },
    },
    passkey: {
      create: {
        after: async (passkey: PasskeyAuditRecord) => {
          await auditPasskeyAdded(passkey);
        },
      },
    },
  },
  ...(googleAuthSettings.enabled
    ? {
        account: {
          accountLinking: {
            trustedProviders: ["google"],
            allowDifferentEmails: false,
            updateUserInfoOnLink: false,
          },
          encryptOAuthTokens: true,
        },
        socialProviders: {
          google: {
            clientId: googleAuthSettings.clientId,
            clientSecret: googleAuthSettings.clientSecret,
            disableSignUp: true,
            hd: googleAuthSettings.hostedDomain,
            prompt: "select_account",
            getUserInfo: async (tokens) => {
              const profile = tokens.idToken ? decodeJwtPayload(tokens.idToken) : null;

              if (
                !profile ||
                !isAllowedGoogleWorkspaceProfile(profile, googleAuthSettings.allowedDomains)
              ) {
                return null;
              }

              const user = mapGoogleProfile(profile);

              if (!user) {
                return null;
              }

              return {
                user,
                data: profile,
              };
            },
          },
        },
      }
    : {}),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 30 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      if (!(await canSendAuthLink(user.email))) {
        return;
      }

      await sendPasswordResetEmail({ email: user.email, url });
    },
    onPasswordReset: async ({ user }, request) => {
      await auditPasswordReset(user.id, request);
    },
  },
  plugins: [
    magicLink({
      expiresIn: 10 * 60,
      storeToken: "hashed",
      sendMagicLink: async ({ email, url }) => {
        if (!(await canSendAuthLink(email))) {
          return;
        }

        await sendMagicLinkEmail({ email, url });
      },
    }),
    passkey({
      ...(passkeyRpID ? { rpID: passkeyRpID } : {}),
      rpName: appName,
      origin: passkeyOrigins,
    }),
    twoFactor({
      allowPasswordless: true,
      issuer: appName,
    }),
    nextCookies(),
  ],
});

export type Auth = typeof auth;

function getAuthSecret() {
  if (process.env.BETTER_AUTH_SECRET) {
    return process.env.BETTER_AUTH_SECRET;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET is required in production.");
  }

  return developmentFallbackSecret;
}

async function auditPasskeyAdded(passkey: PasskeyAuditRecord) {
  if (typeof passkey.id !== "string" || typeof passkey.userId !== "string") {
    return;
  }

  const member = await prisma.member.findUnique({
    where: {
      authUserId: passkey.userId,
    },
    select: {
      id: true,
    },
  });

  if (!member) return;

  await prisma.auditLog.create({
    data: {
      actorMemberId: member.id,
      action: "security.passkey_added",
      targetType: "passkey",
      targetId: passkey.id,
      after: {
        name: typeof passkey.name === "string" ? passkey.name : null,
        deviceType: typeof passkey.deviceType === "string" ? passkey.deviceType : null,
        backedUp: typeof passkey.backedUp === "boolean" ? passkey.backedUp : null,
        transports: typeof passkey.transports === "string" ? passkey.transports : null,
      },
    },
  });
}

async function auditPasswordReset(authUserId: string, request?: Request) {
  const member = await prisma.member.findUnique({
    where: {
      authUserId,
    },
    select: {
      id: true,
    },
  });

  if (!member) return;

  await prisma.auditLog.create({
    data: {
      actorMemberId: member.id,
      action: "security.password_reset",
      targetType: "member",
      targetId: member.id,
      after: {
        authUserId,
      },
      ipAddress: request?.headers.get("x-forwarded-for"),
      userAgent: request?.headers.get("user-agent"),
    },
  });
}

function mapGoogleProfile(profile: Record<string, unknown>) {
  const email = readOptionalString(profile.email);
  const id = readOptionalString(profile.sub);

  if (!email || !id) {
    return null;
  }

  return {
    id,
    name: readOptionalString(profile.name) ?? email,
    email,
    image: readOptionalString(profile.picture),
    emailVerified: profile.email_verified === true,
  };
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}
