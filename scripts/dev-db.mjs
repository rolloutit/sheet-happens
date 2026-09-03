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
const databaseUrl = process.env.DATABASE_URL || defaultDatabaseUrl;
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

if (!["start", "reset", "stop", "seed"].includes(command)) {
  console.error("Usage: pnpm db:dev [start|reset|stop|seed]");
  process.exit(1);
}

try {
  if (command === "stop") {
    await dockerCompose(["down"]);
    process.exit(0);
  }

  if (command === "reset") {
    await dockerCompose(["down", "--volumes", "--remove-orphans"]);
  }

  if (command !== "seed") {
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

async function waitForDatabase() {
  const deadline = Date.now() + 60_000;
  let lastError;

  while (Date.now() < deadline) {
    const client = new Client({ connectionString: databaseUrl });

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
    `Timed out waiting for the dev database. ${lastError instanceof Error ? lastError.message : ""}`,
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
  console.log("Dev database is ready.");
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
