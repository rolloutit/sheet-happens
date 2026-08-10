import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/react";
import { magicLinkClient, twoFactorClient } from "better-auth/client/plugins";

const baseURL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL;

export const authClient = createAuthClient({
  ...(baseURL ? { baseURL } : {}),
  plugins: [
    magicLinkClient(),
    passkeyClient(),
    twoFactorClient({
      onTwoFactorRedirect: () => {
        window.location.assign(getSecondFactorChallengeURL(getCurrentCallbackURL()));
      },
    }),
  ],
});

export function getSecondFactorChallengeURL(callbackURL: string) {
  return `/two-factor?callbackURL=${encodeURIComponent(sanitizeClientCallbackURL(callbackURL))}`;
}

function getCurrentCallbackURL() {
  const currentURL = new URL(window.location.href);
  const requestedCallbackURL = currentURL.searchParams.get("callbackURL");

  if (requestedCallbackURL) {
    return requestedCallbackURL;
  }

  return `${currentURL.pathname}${currentURL.search}`;
}

function sanitizeClientCallbackURL(callbackURL: string) {
  if (!callbackURL || !callbackURL.startsWith("/") || callbackURL.startsWith("//")) {
    return "/dashboard";
  }

  if (callbackURL.startsWith("/login") || callbackURL.startsWith("/two-factor")) {
    return "/dashboard";
  }

  return callbackURL;
}
