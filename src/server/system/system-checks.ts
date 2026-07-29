import { randomUUID } from "node:crypto";

import { getGoogleAuthSettings } from "@/src/server/auth/sign-in-methods";
import { prisma } from "@/src/server/db/client";
import { getEmailDeliveryMode } from "@/src/server/email/mailer";
import { getObjectStorage, type ObjectStorage } from "@/src/server/storage";

export type SystemCheckStatus = "pass" | "warning" | "fail";

export type SystemCheckId = "application" | "database" | "objectStorage" | "email" | "googleOAuth";

export type SystemCheckCode =
  | "ok"
  | "missingEnv"
  | "databaseUnavailable"
  | "storageUnsupportedProvider"
  | "storageProbeFailed"
  | "emailConsole"
  | "emailInvalidMode"
  | "emailSmtpMissingHost"
  | "emailSmtpDefaultFrom"
  | "googleDisabled"
  | "googlePartialConfig";

export type SystemCheckDetail = {
  label: string;
  value: string;
};

export type SystemCheckResult = {
  id: SystemCheckId;
  status: SystemCheckStatus;
  code: SystemCheckCode;
  checkedAt: string;
  durationMs: number;
  missingEnv?: string[];
  error?: string;
  details: SystemCheckDetail[];
};

export type SystemCheckSummary = {
  status: SystemCheckStatus;
  checkedAt: string;
  checks: SystemCheckResult[];
};

export type RunSystemChecksDeps = {
  env?: SystemCheckEnv;
  db?: Pick<typeof prisma, "$queryRawUnsafe">;
  storage?: ObjectStorage;
  now?: Date;
};

type SystemCheckEnv = Record<string, string | undefined>;

const CORE_REQUIRED_ENV = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_BETTER_AUTH_URL",
] as const;

const STORAGE_REQUIRED_ENV = [
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
] as const;

const SECRET_ENV_NAMES = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "AUTH_GOOGLE_CLIENT_SECRET",
  "SMTP_PASSWORD",
  "S3_SECRET_ACCESS_KEY",
] as const;

export async function runSystemChecks(deps: RunSystemChecksDeps = {}): Promise<SystemCheckSummary> {
  const env = deps.env ?? process.env;
  const now = deps.now ?? new Date();
  const checkedAt = now.toISOString();

  const checks = await Promise.all([
    runApplicationConfigCheck({ env, checkedAt, now }),
    runDatabaseCheck({ env, checkedAt, db: deps.db }),
    runObjectStorageCheck({ env, checkedAt, storage: deps.storage, now }),
    runEmailCheck({ env, checkedAt, now }),
    runGoogleOAuthCheck({ env, checkedAt, now }),
  ]);

  return {
    checkedAt,
    status: getOverallStatus(checks),
    checks,
  };
}

export async function runApplicationConfigCheck(input: {
  env: SystemCheckEnv;
  checkedAt: string;
  now: Date;
}): Promise<SystemCheckResult> {
  return timeCheck("application", input.checkedAt, () => {
    const missingEnv = getMissingEnv(input.env, CORE_REQUIRED_ENV);

    return {
      status: missingEnv.length > 0 ? "fail" : "pass",
      code: missingEnv.length > 0 ? "missingEnv" : "ok",
      missingEnv,
      details: [
        envPresenceDetail("DATABASE_URL", input.env),
        envPresenceDetail("BETTER_AUTH_SECRET", input.env),
        envValueDetail("BETTER_AUTH_URL", input.env.BETTER_AUTH_URL),
        envValueDetail("NEXT_PUBLIC_APP_URL", input.env.NEXT_PUBLIC_APP_URL),
        envValueDetail("NEXT_PUBLIC_BETTER_AUTH_URL", input.env.NEXT_PUBLIC_BETTER_AUTH_URL),
        { label: "checkedAt", value: input.now.toISOString() },
      ],
    };
  });
}

export async function runDatabaseCheck(input: {
  env: SystemCheckEnv;
  checkedAt: string;
  db?: Pick<typeof prisma, "$queryRawUnsafe">;
}): Promise<SystemCheckResult> {
  return timeCheck("database", input.checkedAt, async () => {
    const missingEnv = getMissingEnv(input.env, ["DATABASE_URL"]);

    if (missingEnv.length > 0) {
      return {
        status: "fail",
        code: "missingEnv",
        missingEnv,
        details: [envPresenceDetail("DATABASE_URL", input.env)],
      };
    }

    try {
      const db = input.db ?? prisma;
      await db.$queryRawUnsafe("SELECT 1");

      return {
        status: "pass",
        code: "ok",
        details: [envPresenceDetail("DATABASE_URL", input.env)],
      };
    } catch (error) {
      return {
        status: "fail",
        code: "databaseUnavailable",
        error: safeErrorMessage(error, input.env),
        details: [envPresenceDetail("DATABASE_URL", input.env)],
      };
    }
  });
}

export async function runObjectStorageCheck(input: {
  env: SystemCheckEnv;
  checkedAt: string;
  storage?: ObjectStorage;
  now: Date;
}): Promise<SystemCheckResult> {
  return timeCheck("objectStorage", input.checkedAt, async () => {
    const provider = (input.env.OBJECT_STORAGE_PROVIDER || "s3").trim().toLowerCase();

    if (provider !== "s3") {
      return {
        status: "fail",
        code: "storageUnsupportedProvider",
        details: [{ label: "provider", value: provider || "missing" }],
      };
    }

    const missingEnv = getMissingEnv(input.env, STORAGE_REQUIRED_ENV);

    if (missingEnv.length > 0) {
      return {
        status: "fail",
        code: "missingEnv",
        missingEnv,
        details: getStorageDetails(input.env),
      };
    }

    const key = `system-checks/${randomUUID()}.txt`;
    const body = Buffer.from(`Sheet Happens object storage check ${input.now.toISOString()}`);
    const storage = input.storage ?? getObjectStorage();
    let uploaded = false;

    try {
      const objectRef = await storage.putObject({
        key,
        body,
        byteSize: body.byteLength,
        contentType: "text/plain; charset=utf-8",
      });
      uploaded = true;

      const object = await storage.getObject(objectRef);

      if (!object.body.equals(body)) {
        throw new Error("Object storage read-back content did not match the uploaded probe.");
      }

      await storage.deleteObject(objectRef);
      uploaded = false;

      return {
        status: "pass",
        code: "ok",
        details: [...getStorageDetails(input.env), { label: "probeObject", value: "deleted" }],
      };
    } catch (error) {
      if (uploaded) {
        await storage
          .deleteObject({
            bucket: input.env.S3_BUCKET ?? "",
            key,
          })
          .catch(() => undefined);
      }

      return {
        status: "fail",
        code: "storageProbeFailed",
        error: safeErrorMessage(error, input.env),
        details: getStorageDetails(input.env),
      };
    }
  });
}

export async function runEmailCheck(input: {
  env: SystemCheckEnv;
  checkedAt: string;
  now: Date;
}): Promise<SystemCheckResult> {
  return timeCheck("email", input.checkedAt, () => {
    const rawMode = input.env.AUTH_EMAIL_DELIVERY_MODE?.trim();
    const mode = getEmailDeliveryMode(rawMode);
    const from = input.env.AUTH_EMAIL_FROM?.trim() || "Sheet Happens <auth@sheethappens.local>";
    const details = [
      { label: "mode", value: mode },
      { label: "from", value: from },
    ];

    if (rawMode && rawMode !== "smtp" && rawMode !== "console") {
      return {
        status: "warning",
        code: "emailInvalidMode",
        details,
      };
    }

    if (mode === "console") {
      return {
        status: "warning",
        code: "emailConsole",
        details,
      };
    }

    if (!input.env.SMTP_HOST?.trim()) {
      return {
        status: "fail",
        code: "emailSmtpMissingHost",
        missingEnv: ["SMTP_HOST"],
        details: [
          ...details,
          envPresenceDetail("SMTP_HOST", input.env),
          envValueDetail("SMTP_PORT", input.env.SMTP_PORT ?? "587"),
          envPresenceDetail("SMTP_USER", input.env),
          envPresenceDetail("SMTP_PASSWORD", input.env),
        ],
      };
    }

    const usesDefaultLocalFrom = from.includes("sheethappens.local");

    return {
      status: usesDefaultLocalFrom ? "warning" : "pass",
      code: usesDefaultLocalFrom ? "emailSmtpDefaultFrom" : "ok",
      details: [
        ...details,
        envValueDetail("SMTP_HOST", input.env.SMTP_HOST),
        envValueDetail("SMTP_PORT", input.env.SMTP_PORT ?? "587"),
        envPresenceDetail("SMTP_USER", input.env),
        envPresenceDetail("SMTP_PASSWORD", input.env),
        envValueDetail("SMTP_SECURE", input.env.SMTP_SECURE ?? "false"),
      ],
    };
  });
}

export async function runGoogleOAuthCheck(input: {
  env: SystemCheckEnv;
  checkedAt: string;
  now: Date;
}): Promise<SystemCheckResult> {
  return timeCheck("googleOAuth", input.checkedAt, () => {
    const settings = getGoogleAuthSettings(input.env);
    const hasClientId = hasEnv(input.env.AUTH_GOOGLE_CLIENT_ID);
    const hasClientSecret = hasEnv(input.env.AUTH_GOOGLE_CLIENT_SECRET);
    const hasAllowedDomains = hasEnv(input.env.AUTH_GOOGLE_ALLOWED_DOMAINS);
    const details = [
      envPresenceDetail("AUTH_GOOGLE_CLIENT_ID", input.env),
      envPresenceDetail("AUTH_GOOGLE_CLIENT_SECRET", input.env),
      {
        label: "allowedDomains",
        value: settings.allowedDomains.length > 0 ? settings.allowedDomains.join(", ") : "missing",
      },
    ];

    if (!hasClientId && !hasClientSecret && !hasAllowedDomains) {
      return {
        status: "warning",
        code: "googleDisabled",
        details,
      };
    }

    if (!settings.enabled) {
      return {
        status: "fail",
        code: "googlePartialConfig",
        missingEnv: [
          ...(!hasClientId ? ["AUTH_GOOGLE_CLIENT_ID"] : []),
          ...(!hasClientSecret ? ["AUTH_GOOGLE_CLIENT_SECRET"] : []),
          ...(!hasAllowedDomains ? ["AUTH_GOOGLE_ALLOWED_DOMAINS"] : []),
        ],
        details,
      };
    }

    return {
      status: "pass",
      code: "ok",
      details,
    };
  });
}

async function timeCheck(
  id: SystemCheckId,
  checkedAt: string,
  run: () =>
    | Omit<SystemCheckResult, "id" | "checkedAt" | "durationMs">
    | Promise<Omit<SystemCheckResult, "id" | "checkedAt" | "durationMs">>,
): Promise<SystemCheckResult> {
  const start = performance.now();
  const result = await run();

  return {
    ...result,
    id,
    checkedAt,
    durationMs: Math.round(performance.now() - start),
  };
}

function getOverallStatus(checks: SystemCheckResult[]): SystemCheckStatus {
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "warning")) return "warning";
  return "pass";
}

function getMissingEnv(env: SystemCheckEnv, names: readonly string[]) {
  return names.filter((name) => !hasEnv(env[name]));
}

function hasEnv(value: string | undefined) {
  return Boolean(value?.trim());
}

function envPresenceDetail(name: string, env: SystemCheckEnv): SystemCheckDetail {
  return {
    label: name,
    value: hasEnv(env[name]) ? "configured" : "missing",
  };
}

function envValueDetail(name: string, value: string | undefined): SystemCheckDetail {
  return {
    label: name,
    value: value?.trim() || "missing",
  };
}

function getStorageDetails(env: SystemCheckEnv) {
  return [
    envValueDetail("OBJECT_STORAGE_PROVIDER", env.OBJECT_STORAGE_PROVIDER || "s3"),
    envValueDetail("S3_ENDPOINT", env.S3_ENDPOINT),
    envValueDetail("S3_REGION", env.S3_REGION || "auto"),
    envValueDetail("S3_BUCKET", env.S3_BUCKET),
    envPresenceDetail("S3_ACCESS_KEY_ID", env),
    envPresenceDetail("S3_SECRET_ACCESS_KEY", env),
    envValueDetail("S3_FORCE_PATH_STYLE", env.S3_FORCE_PATH_STYLE ?? "false"),
  ];
}

function safeErrorMessage(error: unknown, env: SystemCheckEnv) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);

  return SECRET_ENV_NAMES.reduce((redacted, name) => {
    const value = env[name]?.trim();
    return value ? redacted.replaceAll(value, "[redacted]") : redacted;
  }, message);
}
