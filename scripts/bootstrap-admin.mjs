import { createHash, randomBytes } from "node:crypto";

import nodemailer from "nodemailer";
import { Client } from "pg";

const INVITATION_VALIDITY_HOURS = 72;
const BOOTSTRAP_REASON = "Bootstrap admin invitation";

async function main() {
  const input = getBootstrapInput();

  if (!input) {
    console.info("[bootstrap-admin] BOOTSTRAP_ADMIN_EMAIL is not set; skipping.");
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to bootstrap the first admin.");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const result = await bootstrapAdmin(client, input);

    if (result.status === "active") {
      console.info(`[bootstrap-admin] Active admin already exists for ${input.email}; skipping.`);
      return;
    }

    console.info("[bootstrap-admin] Bootstrap admin invitation is ready.");
    console.info(`[bootstrap-admin] Email: ${input.email}`);
    console.info(`[bootstrap-admin] Expires at: ${result.expiresAt.toISOString()}`);
    console.info(`[bootstrap-admin] Accept URL: ${result.acceptUrl}`);

    await maybeSendBootstrapEmail({
      acceptUrl: result.acceptUrl,
      email: input.email,
      expiresAt: result.expiresAt,
      name: input.displayName,
    });
  } finally {
    await client.end();
  }
}

async function bootstrapAdmin(client, input) {
  const token = createInvitationToken();
  const tokenHash = hashInvitationToken(token);
  const acceptUrl = buildAcceptUrl(input.appUrl, token);
  const expiresAt = addHours(new Date(), INVITATION_VALIDITY_HOURS);

  await client.query("BEGIN");

  try {
    const member = await upsertBootstrapMember(client, input);

    if (member.status === "active") {
      await client.query("COMMIT");
      return {
        status: "active",
      };
    }

    await ensureProfilePeriod(client, member.id, input.profile);
    await revokePendingInvitations(client, input.email);

    const invitation = await createInvitation(client, {
      ...input,
      expiresAt,
      invitedByMemberId: member.id,
      memberId: member.id,
      tokenHash,
    });

    await createAuditLog(client, {
      email: input.email,
      invitationId: invitation.id,
      memberId: member.id,
      profile: input.profile,
    });

    await client.query("COMMIT");

    return {
      acceptUrl,
      expiresAt,
      status: "invited",
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function upsertBootstrapMember(client, input) {
  const existing = await client.query(
    `
      SELECT id, role, status, deleted_at
      FROM members
      WHERE email = $1::citext
      FOR UPDATE
    `,
    [input.email],
  );

  if (existing.rowCount === 0) {
    const created = await client.query(
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
          updated_at
        )
        VALUES (
          $1::citext,
          $2,
          $3,
          $4,
          'admin'::member_role,
          'invited'::member_status,
          $5::member_profile_type,
          $6,
          $7,
          $8,
          now()
        )
        RETURNING id, status
      `,
      [
        input.email,
        input.firstName,
        input.lastName,
        input.displayName,
        input.profile,
        input.defaultCurrencyCode,
        input.timezone,
        input.locale,
      ],
    );

    return {
      id: created.rows[0].id,
      status: created.rows[0].status,
    };
  }

  const member = existing.rows[0];

  if (member.deleted_at) {
    throw new Error(`Cannot bootstrap ${input.email}; the member is soft-deleted.`);
  }

  if (member.status === "active") {
    if (member.role !== "admin") {
      throw new Error(
        `Cannot bootstrap ${input.email}; an active non-admin member already exists.`,
      );
    }

    return {
      id: member.id,
      status: member.status,
    };
  }

  if (member.status !== "invited") {
    throw new Error(`Cannot bootstrap ${input.email}; member status is ${member.status}.`);
  }

  const updated = await client.query(
    `
      UPDATE members
      SET
        first_name = $2,
        last_name = $3,
        display_name = $4,
        role = 'admin'::member_role,
        status = 'invited'::member_status,
        current_profile = $5::member_profile_type,
        default_currency_code = $6,
        timezone = $7,
        locale = $8,
        inactivated_at = NULL,
        updated_at = now()
      WHERE id = $1::uuid
      RETURNING id, status
    `,
    [
      member.id,
      input.firstName,
      input.lastName,
      input.displayName,
      input.profile,
      input.defaultCurrencyCode,
      input.timezone,
      input.locale,
    ],
  );

  return {
    id: updated.rows[0].id,
    status: updated.rows[0].status,
  };
}

async function ensureProfilePeriod(client, memberId, profile) {
  await client.query(
    `
      INSERT INTO member_profile_periods (member_id, profile, valid_from, reason)
      SELECT $1::uuid, $2::member_profile_type, current_date, $3
      WHERE NOT EXISTS (
        SELECT 1
        FROM member_profile_periods
        WHERE member_id = $1::uuid
          AND reason = $3
      )
    `,
    [memberId, profile, BOOTSTRAP_REASON],
  );
}

async function revokePendingInvitations(client, email) {
  await client.query(
    `
      UPDATE invitations
      SET status = 'revoked'::invitation_status,
          revoked_at = now()
      WHERE email = $1::citext
        AND status = 'pending'::invitation_status
    `,
    [email],
  );
}

async function createInvitation(client, invitation) {
  const result = await client.query(
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
      VALUES (
        $1::citext,
        $2,
        $3,
        'admin'::member_role,
        $4::member_profile_type,
        'pending'::invitation_status,
        $5::uuid,
        $6,
        $7,
        $8::uuid
      )
      RETURNING id
    `,
    [
      invitation.email,
      invitation.firstName,
      invitation.lastName,
      invitation.profile,
      invitation.memberId,
      invitation.tokenHash,
      invitation.expiresAt,
      invitation.invitedByMemberId,
    ],
  );

  return result.rows[0];
}

async function createAuditLog(client, input) {
  await client.query(
    `
      INSERT INTO audit_logs (
        actor_member_id,
        action,
        target_type,
        target_id,
        after
      )
      VALUES (
        $1::uuid,
        'member.bootstrap_invited',
        'member',
        $1,
        $2::jsonb
      )
    `,
    [
      input.memberId,
      JSON.stringify({
        bootstrap: true,
        email: input.email,
        invitationId: input.invitationId,
        profile: input.profile,
        role: "ADMIN",
      }),
    ],
  );
}

async function maybeSendBootstrapEmail({ acceptUrl, email, expiresAt, name }) {
  if (!parseBoolean(process.env.BOOTSTRAP_ADMIN_SEND_EMAIL)) {
    return;
  }

  if (process.env.AUTH_EMAIL_DELIVERY_MODE !== "smtp") {
    console.info("[bootstrap-admin] BOOTSTRAP_ADMIN_SEND_EMAIL is set, but SMTP is disabled.");
    console.info(`[bootstrap-admin] Email body: ${buildEmailText({ acceptUrl, expiresAt, name })}`);
    return;
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const secure = process.env.SMTP_SECURE === "true";

  if (!host) {
    throw new Error("SMTP_HOST is required when BOOTSTRAP_ADMIN_SEND_EMAIL=true.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });

  await transporter.sendMail({
    from: process.env.AUTH_EMAIL_FROM ?? "Sheet Happens <auth@sheethappens.local>",
    to: email,
    subject: "Your Sheet Happens QA admin invitation",
    text: buildEmailText({ acceptUrl, expiresAt, name }),
    html: `<p>Hi ${escapeHtml(name)},</p><p>Your Sheet Happens QA admin invitation is ready.</p><p><a href="${acceptUrl}">Accept invitation</a></p><p>This invitation link expires at ${expiresAt.toISOString()}.</p>`,
  });

  console.info(`[bootstrap-admin] Sent bootstrap invitation email to ${email}.`);
}

function getBootstrapInput() {
  const email = normalizeEmail(process.env.BOOTSTRAP_ADMIN_EMAIL ?? "");

  if (!email) {
    return null;
  }

  if (!email.includes("@")) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL must be an email address.");
  }

  const firstName = normalizeRequiredString(process.env.BOOTSTRAP_ADMIN_FIRST_NAME, "QA");
  const lastName = normalizeRequiredString(process.env.BOOTSTRAP_ADMIN_LAST_NAME, "Admin");
  const displayName = `${firstName} ${lastName}`.trim();

  return {
    appUrl: getAppUrl(),
    defaultCurrencyCode: normalizeCurrencyCode(process.env.BOOTSTRAP_ADMIN_CURRENCY ?? "EUR"),
    displayName,
    email,
    firstName,
    lastName,
    locale: normalizeRequiredString(process.env.BOOTSTRAP_ADMIN_LOCALE, "en"),
    profile: "employee",
    timezone: normalizeRequiredString(process.env.BOOTSTRAP_ADMIN_TIMEZONE, "Europe/Budapest"),
  };
}

function buildAcceptUrl(appUrl, token) {
  const url = new URL("/accept-invite", appUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

function getAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function buildEmailText({ acceptUrl, expiresAt, name }) {
  return [
    `Hi ${name},`,
    "",
    "Your Sheet Happens QA admin invitation is ready.",
    "",
    acceptUrl,
    "",
    `This invitation link expires at ${expiresAt.toISOString()}.`,
  ].join("\n");
}

function createInvitationToken() {
  return randomBytes(32).toString("base64url");
}

function hashInvitationToken(token) {
  return createHash("sha256").update(token).digest("base64url");
}

function addHours(date, hours) {
  const next = new Date(date);
  next.setUTCHours(next.getUTCHours() + hours);
  return next;
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function normalizeRequiredString(value, fallback) {
  const normalized = value?.trim() || fallback;

  if (!normalized) {
    throw new Error("Bootstrap admin identity values cannot be blank.");
  }

  return normalized;
}

function normalizeCurrencyCode(value) {
  const normalized = value.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error("BOOTSTRAP_ADMIN_CURRENCY must be a 3-letter currency code.");
  }

  return normalized;
}

function parseBoolean(value) {
  return value === "1" || value === "true" || value === "yes";
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

main().catch((error) => {
  console.error(`[bootstrap-admin] ${error.message}`);
  process.exit(1);
});
