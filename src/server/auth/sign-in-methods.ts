export type GoogleAuthSettings = {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  allowedDomains: string[];
  hostedDomain: string | undefined;
};

export type GoogleProfileForPolicy = {
  email?: unknown;
  email_verified?: unknown;
  hd?: unknown;
  name?: unknown;
  picture?: unknown;
  sub?: unknown;
};

type GoogleAuthEnv = {
  [key: string]: string | undefined;
  AUTH_GOOGLE_CLIENT_ID?: string;
  AUTH_GOOGLE_CLIENT_SECRET?: string;
  AUTH_GOOGLE_ALLOWED_DOMAINS?: string;
};

export function getGoogleAuthSettings(env: GoogleAuthEnv = process.env): GoogleAuthSettings {
  const clientId = normalizeEnvValue(env.AUTH_GOOGLE_CLIENT_ID);
  const clientSecret = normalizeEnvValue(env.AUTH_GOOGLE_CLIENT_SECRET);
  const allowedDomains = parseDomainList(env.AUTH_GOOGLE_ALLOWED_DOMAINS);

  return {
    enabled: Boolean(clientId && clientSecret && allowedDomains.length > 0),
    clientId,
    clientSecret,
    allowedDomains,
    hostedDomain:
      allowedDomains.length === 1 ? allowedDomains[0] : allowedDomains.length > 1 ? "*" : undefined,
  };
}

export function parseDomainList(value: string | undefined) {
  return Array.from(
    new Set(
      (value ?? "")
        .split(",")
        .map((domain) => domain.trim().toLowerCase())
        .filter((domain) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)),
    ),
  );
}

export function isAllowedGoogleWorkspaceProfile(
  profile: GoogleProfileForPolicy,
  allowedDomains: string[],
) {
  if (allowedDomains.length === 0 || profile.email_verified !== true) {
    return false;
  }

  const email = typeof profile.email === "string" ? profile.email.toLowerCase() : "";
  const hostedDomain = typeof profile.hd === "string" ? profile.hd.toLowerCase() : "";
  const emailDomain = email.split("@").at(1) ?? "";

  return allowedDomains.includes(emailDomain) && allowedDomains.includes(hostedDomain);
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const payload = token.split(".").at(1);

  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

function normalizeEnvValue(value: string | undefined) {
  return value?.trim() ?? "";
}
