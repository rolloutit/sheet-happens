#!/usr/bin/env node

import "dotenv/config";

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import process from "node:process";
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import pg from "pg";

import { SEED_INVITATIONS, seedDevDatabase } from "./dev-seed.mjs";

const { Client } = pg;

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const composeFile = join(rootDir, "docker-compose.dev.yml");
const defaultDatabaseUrl =
  "postgresql://sheet_happens:sheet_happens@localhost:5432/sheet_happens?schema=public";
const devDatabaseUrl = process.env.DATABASE_URL || defaultDatabaseUrl;

/**
 * The e2e suite's own database, on the same server as the dev one.
 *
 * It exists so the suite never writes to the database a developer is browsing: onboarding a member
 * flips rows, and an aria baseline is only trustworthy if nothing edits the fixture by hand. Both
 * directions matter — `pnpm db:dev:reset` also stops being something that breaks the suite.
 *
 * Kept in step with `e2e/database.ts`, which owns the same name for `playwright.config.ts`.
 * TypeScript cannot import this file (`allowJs` is off), so the name lives in both.
 */
const E2E_DATABASE_NAME = "sheet_happens_e2e";
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const objectStorage = {
  endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
  bucket: process.env.S3_BUCKET || "sheet-happens-dev",
  accessKeyId: process.env.S3_ACCESS_KEY_ID || "sheet_happens",
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "sheet_happens",
  region: process.env.S3_REGION || "us-east-1",
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE || "true",
};

const command = process.argv.at(2) || "start";

if (!["start", "reset", "stop", "seed", "test", "test-reset", "test-url"].includes(command)) {
  console.error("Usage: pnpm db:dev [start|reset|stop|seed|test|test-reset|test-url]");
  process.exit(1);
}

// The `test*` commands target the e2e database and never touch Docker, so the same code path works
// locally against the dev container and in CI against a service container.
const isE2ECommand = command.startsWith("test");
const databaseUrl = isE2ECommand
  ? withDatabaseName(devDatabaseUrl, E2E_DATABASE_NAME)
  : devDatabaseUrl;

try {
  if (command === "test-url") {
    // One bare line, because the `dev:e2e` script substitutes this into DATABASE_URL.
    process.stdout.write(`${databaseUrl}\n`);
    process.exit(0);
  }

  if (command === "stop") {
    await dockerCompose(["down"]);
    process.exit(0);
  }

  if (command === "reset") {
    await dockerCompose(["down", "--volumes", "--remove-orphans"]);
  }

  if (isE2ECommand) {
    // The target may not exist yet, so wait on the maintenance database instead.
    await waitForDatabase(maintenanceUrl());

    if (command === "test-reset") {
      await dropE2EDatabase();
    }

    await createE2EDatabase();
    // `migrate deploy` rather than `db push`: this is the database the release path is validated
    // against, and the init migration creates the citext and pgcrypto extensions the seed needs.
    await prismaMigrateDeploy();
    await ensureBucket();
  } else if (command !== "seed") {
    await dockerCompose(["up", "-d", "db", "minio"]);
    await dockerCompose(["run", "--rm", "minio-init"]);
    await waitForDatabase();
    await ensureExtensions();
    await prismaDbPush();
  }

  const summary = await seedDatabase();

  printSummary(summary);
} catch (error) {
  // The whole error, not just its message. A failure here is usually several layers down — an
  // upload inside the seed, a query inside a transaction — and the stack is the only part that
  // names the layer. `exitCode` rather than `process.exit()`, which would cut the write short.
  console.error(error);
  process.exitCode = 1;
}

async function dockerCompose(args) {
  await run("docker", ["compose", "-f", composeFile, ...args], {
    cwd: rootDir,
  });
}

async function prismaDbPush() {
  await run("pnpm", ["exec", "prisma", "db", "push"], {
    cwd: rootDir,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });
}

async function prismaMigrateDeploy() {
  await run("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: rootDir,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });
}

function withDatabaseName(url, name) {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

/**
 * A connection to the server's own `postgres` database, which is where CREATE and DROP DATABASE
 * have to be issued from. Prisma's `?schema=` parameter is meaningless to a plain `pg` connection,
 * so it is dropped rather than passed along.
 */
function maintenanceUrl() {
  const parsed = new URL(databaseUrl);
  parsed.pathname = "/postgres";
  parsed.search = "";
  return parsed.toString();
}

async function withMaintenanceClient(callback) {
  const client = new Client({ connectionString: maintenanceUrl() });

  await client.connect();

  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

async function dropE2EDatabase() {
  await withMaintenanceClient(async (client) => {
    // FORCE so a dev server still holding a connection cannot block the reset.
    await client.query(`DROP DATABASE IF EXISTS "${E2E_DATABASE_NAME}" WITH (FORCE)`);
  });
}

async function createE2EDatabase() {
  await withMaintenanceClient(async (client) => {
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      E2E_DATABASE_NAME,
    ]);

    if (existing.rowCount > 0) return;

    await client.query(`CREATE DATABASE "${E2E_DATABASE_NAME}"`);
  });
}

async function waitForDatabase(connectionString = databaseUrl) {
  const deadline = Date.now() + 60_000;
  let lastError;

  while (Date.now() < deadline) {
    const client = new Client({ connectionString });

    try {
      await client.connect();
      await client.query("select 1");
      await client.end();
      return;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => undefined);
      await sleep(1_000);
    }
  }

  throw new Error(
    `Timed out waiting for ${connectionString}. Is the dev database up? ` +
      `${lastError instanceof Error ? lastError.message : ""}`,
  );
}

async function ensureExtensions() {
  await withClient(async (client) => {
    await client.query('CREATE EXTENSION IF NOT EXISTS "citext"');
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  });
}

/**
 * Creates the bucket the seed uploads contractor invoices into.
 *
 * The dev path never needs this: `docker compose up` runs a `minio-init` service that creates the
 * bucket before anything asks for it. The e2e path touches Docker not at all — that is what makes
 * it the same command locally and in CI — so nothing else would, and the seed's first
 * `PutObjectCommand` would fail against a bucket that was never there.
 *
 * Waits the way `waitForDatabase` does, because object storage started moments earlier in the same
 * CI job is not listening yet. An already-existing bucket is the success case, not an error.
 */
async function ensureBucket() {
  const client = new S3Client({
    endpoint: objectStorage.endpoint,
    region: objectStorage.region,
    // Matches createStorageClient in scripts/dev-seed-timesheets.mjs: anything but the string
    // "false" means path style, which MinIO requires.
    forcePathStyle: objectStorage.forcePathStyle !== "false",
    credentials: {
      accessKeyId: objectStorage.accessKeyId,
      secretAccessKey: objectStorage.secretAccessKey,
    },
  });

  const deadline = Date.now() + 60_000;
  let lastError;

  try {
    while (Date.now() < deadline) {
      try {
        await client.send(new CreateBucketCommand({ Bucket: objectStorage.bucket }));
        return;
      } catch (error) {
        // Which of the two a provider answers with depends on whether it scopes bucket names per
        // account; both mean the bucket is there, which is all this function wanted.
        if (error?.name === "BucketAlreadyOwnedByYou" || error?.name === "BucketAlreadyExists") {
          return;
        }

        lastError = error;
        await sleep(1_000);
      }
    }
  } finally {
    client.destroy();
  }

  // The reason travels as `cause` rather than interpolated: an AWS SDK connection failure can
  // carry an empty `message`, which is exactly how today's CI failure managed to print a blank
  // line instead of a reason. `console.error` renders the cause chain in full.
  throw new Error(
    `Timed out creating the bucket "${objectStorage.bucket}" at ${objectStorage.endpoint}. ` +
      "The seed uploads a contractor invoice PDF per invoiced month, so it needs object storage — " +
      "`pnpm db:dev` starts MinIO locally.",
    { cause: lastError },
  );
}

async function seedDatabase() {
  return withClient(async (client) => {
    await client.query("begin");

    try {
      const summary = await seedDevDatabase(client, { objectStorage });

      await client.query("commit");

      return summary;
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

async function withClient(callback) {
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();

  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

function printSummary(summary) {
  console.log("");
  console.log(isE2ECommand ? "E2E database is ready." : "Dev database is ready.");
  console.log(`DATABASE_URL=${databaseUrl}`);
  console.log("");
  console.log("Dev object storage is ready.");
  console.log(`S3_ENDPOINT=${objectStorage.endpoint}`);
  console.log(`S3_REGION=${objectStorage.region}`);
  console.log(`S3_BUCKET=${objectStorage.bucket}`);
  console.log(`S3_ACCESS_KEY_ID=${objectStorage.accessKeyId}`);
  console.log(`S3_SECRET_ACCESS_KEY=${objectStorage.secretAccessKey}`);
  console.log(`S3_FORCE_PATH_STYLE=${objectStorage.forcePathStyle}`);
  console.log("");
  console.log("Seeded data:");
  console.log(`- members: ${summary.members}`);
  console.log(`- projects: ${summary.projects} in ${summary.groups} groups`);
  console.log(`- assignments: ${summary.assignments} (${summary.overrideRates} rate overrides)`);
  console.log(`- time entries inserted this run: ${summary.timeEntries}`);
  console.log(
    `- aria-baseline week (${summary.frozenWeekStart}): ` +
      `${summary.frozenWeekEntries} entries inserted this run`,
  );
  console.log(`- inactive project weeks inserted this run: ${summary.inactiveWeeks}`);
  console.log(
    `- timesheets seeded this run: ${summary.timesheets.timesheets}` +
      ` (${summary.timesheets.revisions} revisions, ${summary.timesheets.invoices} invoices)`,
  );
  console.log(`- timesheet statuses: ${summary.timesheetStatuses.join(", ")}`);
  console.log("- no payslips (create those by hand)");
  console.log("");
  console.log("Seeded invite links:");

  for (const invitation of SEED_INVITATIONS) {
    console.log(`- ${invitation.email}: ${appUrl}/accept-invite?token=${invitation.token}`);
  }

  console.log("");
  console.log("Use AUTH_EMAIL_DELIVERY_MODE=console to see magic links in the dev server output.");
}

function run(commandName, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandName, args, {
      stdio: "inherit",
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${commandName} ${args.join(" ")} exited with ${code}`));
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
