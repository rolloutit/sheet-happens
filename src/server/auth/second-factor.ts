import { createHmac, createHash, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { authSecret } from "./auth";

const secondFactorCookieName = "sheet_happens_2fa";
const defaultMaxAgeSeconds = 12 * 60 * 60;
const trustedDeviceMaxAgeSeconds = 30 * 24 * 60 * 60;

type SecondFactorPayload = {
  userId: string;
  tokenHash: string;
  expiresAt: number;
};

export async function hasSatisfiedSecondFactor(input: { userId: string; sessionToken: string }) {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(secondFactorCookieName)?.value;

  if (!cookieValue) return false;

  const payload = verifySecondFactorCookie(cookieValue);

  if (!payload) return false;

  if (payload.expiresAt <= Date.now()) {
    return false;
  }

  return (
    payload.userId === input.userId && payload.tokenHash === hashSessionToken(input.sessionToken)
  );
}

export async function setSecondFactorCookie(input: {
  userId: string;
  sessionToken: string;
  trustDevice?: boolean;
}) {
  const maxAge = input.trustDevice ? trustedDeviceMaxAgeSeconds : defaultMaxAgeSeconds;
  const payload: SecondFactorPayload = {
    userId: input.userId,
    tokenHash: hashSessionToken(input.sessionToken),
    expiresAt: Date.now() + maxAge * 1000,
  };
  const cookieStore = await cookies();

  cookieStore.set(secondFactorCookieName, signSecondFactorPayload(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export async function clearSecondFactorCookie() {
  const cookieStore = await cookies();

  cookieStore.delete(secondFactorCookieName);
}

function signSecondFactorPayload(payload: SecondFactorPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", authSecret).update(encodedPayload).digest("base64url");

  return `${encodedPayload}.${signature}`;
}

function verifySecondFactorCookie(value: string) {
  const [encodedPayload, signature] = value.split(".");

  if (!encodedPayload || !signature) return null;

  const expectedSignature = createHmac("sha256", authSecret)
    .update(encodedPayload)
    .digest("base64url");

  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<SecondFactorPayload>;

    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.tokenHash !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }

    return parsed as SecondFactorPayload;
  } catch {
    return null;
  }
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
