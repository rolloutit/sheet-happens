import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/react";
import { magicLinkClient, twoFactorClient } from "better-auth/client/plugins";

const baseURL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL;

export const authClient = createAuthClient({
  ...(baseURL ? { baseURL } : {}),
  plugins: [magicLinkClient(), passkeyClient(), twoFactorClient({ twoFactorPage: "/two-factor" })],
});
