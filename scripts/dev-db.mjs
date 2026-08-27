#!/usr/bin/env node

import "dotenv/config";

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import process from "node:process";
import pg from "pg";

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

const seedInvitations = [
  {
    token: "dev-admin-invite-token",
    email: "admin@example.com",
    firstName: "Admin",
    lastName: "User",
    role: "admin",
    profile: "employee",
    inviterEmail: "admin@example.com",
  },
  {
    token: "dev-contractor-invite-token",
    email: "contractor@example.com",
    firstName: "Contractor",
    lastName: "Example",
    role: "member",
    profile: "contractor",
    inviterEmail: "admin@example.com",
  },
];

const seedMembers = [
  {
    email: "admin@example.com",
    firstName: "Admin",
    lastName: "User",
    role: "admin",
    status: "invited",
    profile: "employee",
    defaultCurrencyCode: "EUR",
    timezone: "Europe/Budapest",
    locale: "en",
    profileReason: "Dev first admin bootstrap",
  },
  {
    email: "contractor@example.com",
    firstName: "Contractor",
    lastName: "Example",
    role: "member",
    status: "invited",
    profile: "contractor",
    defaultCurrencyCode: "EUR",
    timezone: "Europe/Budapest",
    locale: "en",
    profileReason: "Dev contractor invitation",
  },
  {
    email: "employee@example.com",
    firstName: "Employee",
    lastName: "Example",
    role: "member",
    status: "inactive",
    profile: "employee",
    defaultCurrencyCode: "HUF",
    timezone: "Europe/Budapest",
    locale: "hu",
    profileReason: "Dev inactive employee sample",
  },
];

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

  await seedDatabase();
  printSummary();
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
  await withClient(async (client) => {
    await client.query("begin");

    try {
      for (const member of seedMembers) {
        await insertMember(client, member);
        await insertProfilePeriod(client, member);
      }

      for (const invitation of seedInvitations) {
        await insertInvitation(client, invitation);
      }

      await insertNotificationConfiguration(client);

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

async function insertNotificationConfiguration(client) {
  await client.query(`
    INSERT INTO notification_configuration (id, updated_at)
    VALUES ('system', now())
    ON CONFLICT (id) DO NOTHING
  `);

  await client.query(`
    INSERT INTO notification_rules (type, email_enabled, in_app_enabled, updated_at) VALUES
      ('weekly_hours_reminder', true, true, now()),
      ('monthly_invoice_reminder', true, true, now()),
      ('timesheet_submitted', true, true, now()),
      ('timesheet_approved', true, true, now()),
      ('timesheet_rejected', true, true, now()),
      ('invoice_uploaded', true, true, now()),
      ('invoice_rejected', true, true, now()),
      ('invoice_accepted', true, true, now()),
      ('timesheet_paid', true, true, now()),
      ('payslip_available', true, true, now()),
      ('time_entry_admin_modified', true, true, now())
    ON CONFLICT (type) DO NOTHING
  `);
}

async function insertMember(client, member) {
  await client.query(
    `
      INSERT INTO members (
        email,
        first_name,
        last_name,
        display_name,
        role,
        status,
        current_profile,
        default_currency_code,
        timezone,
        locale,
        inactivated_at,
        updated_at
      )
      VALUES (
        $1::citext,
        $2,
        $3,
        $4,
        $5::member_role,
        $6::member_status,
        $7::member_profile_type,
        $8,
        $9,
        $10,
        CASE WHEN $6::member_status = 'inactive'::member_status THEN now() ELSE null END,
        now()
      )
      ON CONFLICT (email) DO NOTHING
    `,
    [
      member.email,
      member.firstName,
      member.lastName,
      `${member.firstName} ${member.lastName}`,
      member.role,
      member.status,
      member.profile,
      member.defaultCurrencyCode,
      member.timezone,
      member.locale,
    ],
  );
}

async function insertProfilePeriod(client, member) {
  await client.query(
    `
      INSERT INTO member_profile_periods (member_id, profile, valid_from, reason)
      SELECT id, $2::member_profile_type, current_date, $3
      FROM members
      WHERE email = $1::citext
        AND NOT EXISTS (
          SELECT 1
          FROM member_profile_periods
          WHERE member_id = members.id
            AND reason = $3
        )
    `,
    [member.email, member.profile, member.profileReason],
  );
}

async function insertInvitation(client, invitation) {
  const tokenHash = hashInvitationToken(invitation.token);

  await client.query(
    `
      INSERT INTO invitations (
        email,
        first_name,
        last_name,
        role,
        profile,
        status,
        member_id,
        token_hash,
        expires_at,
        invited_by_member_id
      )
      SELECT
        invited.email,
        $2,
        $3,
        $4::member_role,
        $5::member_profile_type,
        'pending'::invitation_status,
        invited.id,
        $6,
        now() + interval '14 days',
        inviter.id
      FROM members invited
      JOIN members inviter ON inviter.email = $7::citext
      WHERE invited.email = $1::citext
        AND invited.status = 'invited'::member_status
        AND NOT EXISTS (
          SELECT 1
          FROM invitations
          WHERE token_hash = $6
             OR (email = $1::citext AND status = 'pending'::invitation_status)
        )
    `,
    [
      invitation.email,
      invitation.firstName,
      invitation.lastName,
      invitation.role,
      invitation.profile,
      tokenHash,
      invitation.inviterEmail,
    ],
  );
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

function hashInvitationToken(token) {
  return createHash("sha256").update(token).digest("base64url");
}

function printSummary() {
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
  console.log("Seeded invite links:");

  for (const invitation of seedInvitations) {
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
