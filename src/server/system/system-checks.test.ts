import { describe, expect, it, vi } from "vitest";

import type { ObjectStorage } from "@/src/server/storage";
import {
  runEmailCheck,
  runGoogleOAuthCheck,
  runObjectStorageCheck,
  runSystemChecks,
  runTypstCheck,
} from "./system-checks";

const checkedAt = "2026-07-30T00:00:00.000Z";
const now = new Date(checkedAt);

describe("system checks", () => {
  it("probes object storage with write, read, and delete", async () => {
    const storage = createMemoryStorage();

    const result = await runObjectStorageCheck({
      checkedAt,
      now,
      storage,
      env: {
        OBJECT_STORAGE_PROVIDER: "s3",
        S3_ENDPOINT: "https://storage.example.test",
        S3_REGION: "auto",
        S3_BUCKET: "sheet-happens-dev",
        S3_ACCESS_KEY_ID: "access-key",
        S3_SECRET_ACCESS_KEY: "secret-key",
      },
    });

    expect(result.status).toBe("pass");
    expect(result.code).toBe("ok");
    expect(storage.putObject).toHaveBeenCalledOnce();
    expect(storage.getObject).toHaveBeenCalledOnce();
    expect(storage.deleteObject).toHaveBeenCalledOnce();
  });

  it("fails object storage checks before probing when required env vars are missing", async () => {
    const storage = createMemoryStorage();

    const result = await runObjectStorageCheck({
      checkedAt,
      now,
      storage,
      env: {
        OBJECT_STORAGE_PROVIDER: "s3",
        S3_ENDPOINT: "https://storage.example.test",
      },
    });

    expect(result.status).toBe("fail");
    expect(result.code).toBe("missingEnv");
    expect(result.missingEnv).toEqual(["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]);
    expect(storage.putObject).not.toHaveBeenCalled();
  });

  it("redacts secret values from object storage probe errors", async () => {
    const storage = createMemoryStorage({
      putError: new Error("Rejected secret-key"),
    });

    const result = await runObjectStorageCheck({
      checkedAt,
      now,
      storage,
      env: {
        OBJECT_STORAGE_PROVIDER: "s3",
        S3_ENDPOINT: "https://storage.example.test",
        S3_REGION: "auto",
        S3_BUCKET: "sheet-happens-dev",
        S3_ACCESS_KEY_ID: "access-key",
        S3_SECRET_ACCESS_KEY: "secret-key",
      },
    });

    expect(result.status).toBe("fail");
    expect(result.code).toBe("storageProbeFailed");
    expect(result.error).toContain("[redacted]");
    expect(result.error).not.toContain("secret-key");
  });

  it("classifies console email mode as a deployment warning", async () => {
    const result = await runEmailCheck({
      checkedAt,
      now,
      env: {
        AUTH_EMAIL_DELIVERY_MODE: "console",
      },
    });

    expect(result.status).toBe("warning");
    expect(result.code).toBe("emailConsole");
  });

  it("fails partially configured Google OAuth", async () => {
    const result = await runGoogleOAuthCheck({
      checkedAt,
      now,
      env: {
        AUTH_GOOGLE_CLIENT_ID: "client-id",
        AUTH_GOOGLE_ALLOWED_DOMAINS: "rolloutit.net",
      },
    });

    expect(result.status).toBe("fail");
    expect(result.code).toBe("googlePartialConfig");
    expect(result.missingEnv).toEqual(["AUTH_GOOGLE_CLIENT_SECRET"]);
  });

  it("passes Typst checks when the probe renders a PDF", async () => {
    const typstRenderer = vi.fn(async () => Buffer.from("%PDF-1.7\n"));

    const result = await runTypstCheck({
      checkedAt,
      env: {},
      typstRenderer,
    });

    expect(result.status).toBe("pass");
    expect(result.code).toBe("ok");
    expect(typstRenderer).toHaveBeenCalledWith(
      {
        source: expect.stringContaining("Sheet Happens Typst check"),
        filename: "system-check",
      },
      {
        typstBin: "typst",
        timeoutMs: 5_000,
      },
    );
  });

  it("fails Typst checks when the probe cannot render a PDF", async () => {
    const typstRenderer = vi.fn(async () => Buffer.from("not a pdf"));

    const result = await runTypstCheck({
      checkedAt,
      env: {
        TYPST_BIN: "/opt/bin/typst",
      },
      typstRenderer,
    });

    expect(result.status).toBe("fail");
    expect(result.code).toBe("typstProbeFailed");
    expect(result.error).toContain("Typst probe did not return a PDF file.");
  });

  it("summarizes warnings without failing the whole system check", async () => {
    const storage = createMemoryStorage();
    const db = {
      $queryRawUnsafe: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    };

    const summary = await runSystemChecks({
      now,
      db,
      storage,
      typstRenderer: vi.fn(async () => Buffer.from("%PDF-1.7\n")),
      env: {
        DATABASE_URL: "postgresql://user:password@example.test/db",
        BETTER_AUTH_SECRET: "auth-secret",
        BETTER_AUTH_URL: "https://sheet.example.test",
        NEXT_PUBLIC_APP_URL: "https://sheet.example.test",
        NEXT_PUBLIC_BETTER_AUTH_URL: "https://sheet.example.test",
        AUTH_EMAIL_DELIVERY_MODE: "console",
        OBJECT_STORAGE_PROVIDER: "s3",
        S3_ENDPOINT: "https://storage.example.test",
        S3_REGION: "auto",
        S3_BUCKET: "sheet-happens-dev",
        S3_ACCESS_KEY_ID: "access-key",
        S3_SECRET_ACCESS_KEY: "secret-key",
      },
    });

    expect(summary.status).toBe("warning");
    expect(summary.checks).toHaveLength(6);
  });
});

function createMemoryStorage(options: { putError?: Error } = {}): ObjectStorage {
  const objects = new Map<string, Buffer>();

  return {
    putObject: vi.fn(async (input) => {
      if (options.putError) throw options.putError;
      objects.set(input.key, input.body);
      return {
        bucket: "sheet-happens-dev",
        key: input.key,
      };
    }),
    getObject: vi.fn(async (input) => ({
      bucket: input.bucket,
      key: input.key,
      body: objects.get(input.key) ?? Buffer.alloc(0),
      contentType: "text/plain; charset=utf-8",
      byteSize: objects.get(input.key)?.byteLength ?? 0,
    })),
    deleteObject: vi.fn(async (input) => {
      objects.delete(input.key);
    }),
    getSignedReadUrl: vi.fn(async (input) => `https://storage.example.test/${input.key}`),
  };
}
