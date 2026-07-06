import { passkey } from "@better-auth/passkey";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { magicLink, twoFactor } from "better-auth/plugins";

import { canCreateAuthUser, canSendAuthLink } from "@/src/server/auth/invite-policy";
import { sendMagicLinkEmail } from "@/src/server/auth/auth-emails";
import { prisma } from "@/src/server/db/client";

const appName = "Sheet Happens";
export const developmentFallbackSecret = "REMOVED-DEV-SECRET";
export const authSecret = process.env.BETTER_AUTH_SECRET ?? developmentFallbackSecret;
const authBaseUrl =
  process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const authUrl = new URL(authBaseUrl);
const authOrigin = authUrl.origin;

const trustedOrigins = [
  authOrigin,
  ...(process.env.AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];

export const auth = betterAuth({
  appName,
  baseURL: authOrigin,
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
  },
  emailAndPassword: {
    enabled: false,
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
      rpID: authUrl.hostname,
      rpName: appName,
      origin: authOrigin,
    }),
    twoFactor({
      allowPasswordless: true,
      issuer: appName,
    }),
    nextCookies(),
  ],
});

export type Auth = typeof auth;
