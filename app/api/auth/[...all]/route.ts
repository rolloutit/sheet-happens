import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/src/server/auth/auth";
import {
  clearPasswordSignInFailures,
  getPasswordSignInLockout,
  recordFailedPasswordSignIn,
} from "@/src/server/auth/password-lockout";

export const runtime = "nodejs";

const authHandlers = toNextJsHandler(auth);

export const { GET, PATCH, PUT, DELETE } = authHandlers;

export async function POST(request: Request) {
  if (!isEmailPasswordSignInRequest(request)) {
    return authHandlers.POST(request);
  }

  const email = await readSignInEmail(request);

  if (!email) {
    return authHandlers.POST(request);
  }

  const lockout = await getPasswordSignInLockout(email, getPasswordLockoutSecret());

  if (lockout.locked) {
    return passwordLockoutResponse(lockout.retryAfterSeconds ?? 1);
  }

  const response = await authHandlers.POST(request);

  if (response.ok) {
    await clearPasswordSignInFailures(email, getPasswordLockoutSecret());
    return response;
  }

  if (!(await isInvalidCredentialResponse(response))) {
    return response;
  }

  const failedAttempt = await recordFailedPasswordSignIn(email, getPasswordLockoutSecret());

  return failedAttempt.lockoutStarted
    ? passwordLockoutResponse(failedAttempt.retryAfterSeconds ?? 1)
    : response;
}

function isEmailPasswordSignInRequest(request: Request) {
  return new URL(request.url).pathname.endsWith("/sign-in/email");
}

async function readSignInEmail(request: Request) {
  try {
    const body = (await request.clone().json()) as { email?: unknown };
    return typeof body.email === "string" ? body.email : null;
  } catch {
    return null;
  }
}

async function isInvalidCredentialResponse(response: Response) {
  if (response.status !== 401) return false;

  try {
    const body = (await response.clone().json()) as { code?: unknown };
    return body.code === "INVALID_EMAIL_OR_PASSWORD";
  } catch {
    return false;
  }
}

function getPasswordLockoutSecret() {
  return (
    process.env.AUTH_LOGIN_ATTEMPT_SECRET ?? process.env.BETTER_AUTH_SECRET ?? "local-dev-only"
  );
}

function passwordLockoutResponse(retryAfterSeconds: number) {
  return Response.json(
    {
      code: "PASSWORD_SIGN_IN_LOCKED",
      message: "Too many password sign-in attempts. Please try again later.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": retryAfterSeconds.toString(),
        "X-Retry-After": retryAfterSeconds.toString(),
      },
    },
  );
}
