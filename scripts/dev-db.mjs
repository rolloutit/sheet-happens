#!/usr/bin/env node

import "dotenv/config";

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import process from "node:process";
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
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
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
