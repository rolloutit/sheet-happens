#!/usr/bin/env node

// One-time local seed for manually testing /admin/reports: adds several members,
// projects, a project group, assignments, internal rates, and ~2 months of time
// entries. Safe to re-run — it skips anything it already created.
//
// Usage: pnpm db:dev:seed:reports-demo (requires `pnpm db:dev` to have run first,
// since it hangs seeded projects/rates off the existing admin@example.com member).

import "dotenv/config";

import process from "node:process";

import { Client } from "pg";

const defaultDatabaseUrl =
  "postgresql://sheet_happens:sheet_happens@localhost:5432/sheet_happens?schema=public";
const databaseUrl = process.env.DATABASE_URL || defaultDatabaseUrl;

const ADMIN_EMAIL = "admin@example.com";
const RATE_VALID_FROM = "2024-01-01";
const SEED_DAYS_BACK = 65;

const MEMBERS = [
  {
    email: "dora.kovacs@example.com",
    firstName: "Dóra",
    lastName: "Kovács",
    profile: "employee",
    currency: "EUR",
    timezone: "Europe/Budapest",
    locale: "hu",
    hourlyRate: "28.00",
  },
  {
    email: "bence.nagy@example.com",
    firstName: "Bence",
    lastName: "Nagy",
    profile: "employee",
    currency: "HUF",
    timezone: "Europe/Budapest",
    locale: "hu",
    hourlyRate: "8500.00",
  },
  {
    email: "emma.toth@example.com",
    firstName: "Emma",
    lastName: "Tóth",
    profile: "employee",
    currency: "EUR",
    timezone: "Europe/Budapest",
    locale: "en",
    hourlyRate: "26.50",
  },
  {
    email: "marcus.weber@example.com",
    firstName: "Marcus",
    lastName: "Weber",
    profile: "contractor",
    currency: "EUR",
    timezone: "Europe/Berlin",
    locale: "en",
    hourlyRate: "55.00",
  },
  {
    email: "sara.klein@example.com",
    firstName: "Sara",
    lastName: "Klein",
    profile: "contractor",
    currency: "EUR",
    timezone: "Europe/Vienna",
    locale: "en",
    hourlyRate: "60.00",
  },
  {
    email: "levente.szabo@example.com",
    firstName: "Levente",
    lastName: "Szabó",
    profile: "contractor",
    currency: "HUF",
    timezone: "Europe/Budapest",
    locale: "hu",
    hourlyRate: "12000.00",
  },
];

const PROJECTS = [
  {
    slug: "atlas-platform",
    name: "Atlas Platform",
    colorToken: "teal",
    status: "active",
    isInternal: false,
    descriptions: [
      "Sprint planning",
      "API endpoint implementation",
      "Code review",
      "Bug triage",
      "Client sync call",
      "Database migration work",
    ],
  },
  {
    slug: "nimbus-mobile-app",
    name: "Nimbus Mobile App",
    colorToken: "cyan",
    status: "active",
    isInternal: false,
    descriptions: [
      "UI polish",
      "Push notification integration",
      "App store release prep",
      "Crash investigation",
      "Onboarding flow updates",
      "QA pass",
    ],
  },
  {
    slug: "fenix-data-pipeline",
    name: "Fenix Data Pipeline",
    colorToken: "mint",
    status: "active",
    isInternal: false,
    descriptions: [
      "ETL job maintenance",
      "Data quality checks",
      "Pipeline monitoring setup",
      "Schema migration",
      "Performance tuning",
      "Incident follow-up",
    ],
  },
  {
    slug: "horizon-redesign",
    name: "Horizon Redesign",
    colorToken: "amber",
    status: "inactive",
    isInternal: false,
    descriptions: [
      "Design handoff review",
      "Component library updates",
      "Accessibility fixes",
      "Content migration",
      "Stakeholder review",
      "Final QA",
    ],
  },
  {
    slug: "vega-integration",
    name: "Vega Integration",
    colorToken: "violet",
    status: "active",
    isInternal: false,
    descriptions: [
      "Third-party API integration",
      "Webhook handling",
      "Auth flow updates",
      "Integration testing",
      "Partner sync call",
      "Error handling improvements",
    ],
  },
  {
    slug: "internal-ops-tooling",
    name: "Internal Ops & Tooling",
    colorToken: "slate",
    status: "active",
    isInternal: true,
    descriptions: [
      "Internal dashboard updates",
      "CI pipeline maintenance",
      "Dev tooling improvements",
      "Documentation",
      "Onboarding docs update",
      "Infra cleanup",
    ],
  },
];

const GROUPS = [
  {
    slug: "client-delivery",
    name: "Client Delivery",
    description: "Billable client-facing work",
    projectSlugs: [
      "atlas-platform",
      "nimbus-mobile-app",
      "fenix-data-pipeline",
      "horizon-redesign",
      "vega-integration",
    ],
  },
  {
    slug: "internal",
    name: "Internal",
    description: "Non-billable internal work",
    projectSlugs: ["internal-ops-tooling"],
  },
];

const ASSIGNMENTS = [
  { memberEmail: "dora.kovacs@example.com", projectSlug: "atlas-platform" },
  { memberEmail: "dora.kovacs@example.com", projectSlug: "nimbus-mobile-app" },
  { memberEmail: "bence.nagy@example.com", projectSlug: "fenix-data-pipeline" },
  { memberEmail: "bence.nagy@example.com", projectSlug: "internal-ops-tooling" },
  { memberEmail: "emma.toth@example.com", projectSlug: "atlas-platform" },
  { memberEmail: "emma.toth@example.com", projectSlug: "internal-ops-tooling" },
  { memberEmail: "marcus.weber@example.com", projectSlug: "nimbus-mobile-app" },
  { memberEmail: "marcus.weber@example.com", projectSlug: "vega-integration" },
  { memberEmail: "sara.klein@example.com", projectSlug: "atlas-platform", overrideRate: "65.00" },
  { memberEmail: "sara.klein@example.com", projectSlug: "horizon-redesign" },
  { memberEmail: "levente.szabo@example.com", projectSlug: "fenix-data-pipeline" },
  { memberEmail: "levente.szabo@example.com", projectSlug: "vega-integration" },
];

const DURATIONS_MINUTES = [60, 90, 120, 150, 180, 210, 240, 270, 300];
const ENTRY_PROBABILITY = 0.7;

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query("begin");

    const adminId = await getAdminId(client);
    const memberIds = new Map();

    for (const member of MEMBERS) {
      const id = await ensureMember(client, member);
      memberIds.set(member.email, id);
      await ensureProfilePeriod(client, id, member.profile);
      await ensureMemberDefaultRate(client, {
        memberId: id,
        currencyCode: member.currency,
        hourlyRate: member.hourlyRate,
        createdByMemberId: adminId,
      });
    }

    const projectIds = new Map();

    for (const project of PROJECTS) {
      const id = await ensureProject(client, project, adminId);
      projectIds.set(project.slug, id);
    }

    for (const group of GROUPS) {
      const groupId = await ensureProjectGroup(client, group);

      for (const projectSlug of group.projectSlugs) {
        await ensureGroupProject(client, groupId, projectIds.get(projectSlug));
      }
    }

    let entriesInserted = 0;

    for (const assignment of ASSIGNMENTS) {
      const memberId = memberIds.get(assignment.memberEmail);
      const projectId = projectIds.get(assignment.projectSlug);
      const assignmentId = await ensureAssignment(client, {
        memberId,
        projectId,
        createdByMemberId: adminId,
      });

      if (assignment.overrideRate) {
        const member = MEMBERS.find((candidate) => candidate.email === assignment.memberEmail);

        await ensureAssignmentOverrideRate(client, {
          projectAssignmentId: assignmentId,
          currencyCode: member.currency,
          hourlyRate: assignment.overrideRate,
          createdByMemberId: adminId,
        });
      }

      const project = PROJECTS.find((candidate) => candidate.slug === assignment.projectSlug);
      const member = MEMBERS.find((candidate) => candidate.email === assignment.memberEmail);

      entriesInserted += await seedTimeEntries(client, {
        memberId,
        projectId,
        assignmentId,
        timezone: member.timezone,
        descriptions: project.descriptions,
      });
    }

    await client.query("commit");

    printSummary({ entriesInserted });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

async function getAdminId(client) {
  const result = await client.query("SELECT id FROM members WHERE email = $1::citext", [
    ADMIN_EMAIL,
  ]);

  if (result.rowCount === 0) {
    throw new Error(
      `No member found for ${ADMIN_EMAIL}. Run "pnpm db:dev" first so the base dev seed exists.`,
    );
  }

  return result.rows[0].id;
}

async function ensureMember(client, member) {
  const displayName = `${member.firstName} ${member.lastName}`;

  const inserted = await client.query(
    `
      INSERT INTO members (
        email, first_name, last_name, display_name, role, status, current_profile,
        default_currency_code, timezone, locale, activated_at, updated_at
      )
      VALUES (
        $1::citext, $2, $3, $4, 'member'::member_role, 'active'::member_status,
        $5::member_profile_type, $6, $7, $8, now(), now()
      )
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `,
    [
      member.email,
      member.firstName,
      member.lastName,
      displayName,
      member.profile,
      member.currency,
      member.timezone,
      member.locale,
    ],
  );

  if (inserted.rowCount > 0) return inserted.rows[0].id;

  const existing = await client.query("SELECT id FROM members WHERE email = $1::citext", [
    member.email,
  ]);

  return existing.rows[0].id;
}

async function ensureProfilePeriod(client, memberId, profile) {
  await client.query(
    `
      INSERT INTO member_profile_periods (member_id, profile, valid_from, reason)
      SELECT $1::uuid, $2::member_profile_type, $3::date, 'Reports demo seed'
      WHERE NOT EXISTS (
        SELECT 1 FROM member_profile_periods
        WHERE member_id = $1::uuid AND reason = 'Reports demo seed'
      )
    `,
    [memberId, profile, RATE_VALID_FROM],
  );
}

async function ensureMemberDefaultRate(
  client,
  { memberId, currencyCode, hourlyRate, createdByMemberId },
) {
  const existing = await client.query(
    "SELECT 1 FROM member_default_rate_periods WHERE member_id = $1::uuid LIMIT 1",
    [memberId],
  );

  if (existing.rowCount > 0) return;

  await client.query(
    `
      INSERT INTO member_default_rate_periods (
        member_id, valid_from, hourly_rate, currency_code, created_by_member_id, note
      )
      VALUES ($1::uuid, $2::date, $3::decimal, $4, $5::uuid, 'Reports demo seed')
    `,
    [memberId, RATE_VALID_FROM, hourlyRate, currencyCode, createdByMemberId],
  );
}

async function ensureProject(client, project, adminId) {
  const inserted = await client.query(
    `
      INSERT INTO projects (
        name, slug, color_token, status, is_internal, notes,
        created_by_member_id, updated_by_member_id, updated_at
      )
      VALUES ($1, $2, $3, $4::project_status, $5, 'Seeded for reports demo', $6::uuid, $6::uuid, now())
      ON CONFLICT (slug) DO NOTHING
      RETURNING id
    `,
    [project.name, project.slug, project.colorToken, project.status, project.isInternal, adminId],
  );

  if (inserted.rowCount > 0) return inserted.rows[0].id;

  const existing = await client.query("SELECT id FROM projects WHERE slug = $1", [project.slug]);

  return existing.rows[0].id;
}

async function ensureProjectGroup(client, group) {
  const inserted = await client.query(
    `
      INSERT INTO project_groups (name, slug, description, updated_at)
      VALUES ($1, $2, $3, now())
      ON CONFLICT (slug) DO NOTHING
      RETURNING id
    `,
    [group.name, group.slug, group.description],
  );

  if (inserted.rowCount > 0) return inserted.rows[0].id;

  const existing = await client.query("SELECT id FROM project_groups WHERE slug = $1", [
    group.slug,
  ]);

  return existing.rows[0].id;
}

async function ensureGroupProject(client, groupId, projectId) {
  await client.query(
    `
      INSERT INTO project_group_projects (project_group_id, project_id)
      VALUES ($1::uuid, $2::uuid)
      ON CONFLICT (project_group_id, project_id) DO NOTHING
    `,
    [groupId, projectId],
  );
}

async function ensureAssignment(client, { memberId, projectId, createdByMemberId }) {
  const existing = await client.query(
    "SELECT id FROM project_assignments WHERE member_id = $1::uuid AND project_id = $2::uuid LIMIT 1",
    [memberId, projectId],
  );

  if (existing.rowCount > 0) return existing.rows[0].id;

  const inserted = await client.query(
    `
      INSERT INTO project_assignments (
        member_id, project_id, valid_from, created_by_member_id, updated_by_member_id, updated_at
      )
      VALUES ($1::uuid, $2::uuid, $3::date, $4::uuid, $4::uuid, now())
      RETURNING id
    `,
    [memberId, projectId, RATE_VALID_FROM, createdByMemberId],
  );

  return inserted.rows[0].id;
}

async function ensureAssignmentOverrideRate(
  client,
  { projectAssignmentId, currencyCode, hourlyRate, createdByMemberId },
) {
  const existing = await client.query(
    "SELECT 1 FROM assignment_rate_periods WHERE project_assignment_id = $1::uuid LIMIT 1",
    [projectAssignmentId],
  );

  if (existing.rowCount > 0) return;

  await client.query(
    `
      INSERT INTO assignment_rate_periods (
        project_assignment_id, valid_from, hourly_rate, currency_code, created_by_member_id, note
      )
      VALUES ($1::uuid, $2::date, $3::decimal, $4, $5::uuid, 'Reports demo seed override')
    `,
    [projectAssignmentId, RATE_VALID_FROM, hourlyRate, currencyCode, createdByMemberId],
  );
}

async function seedTimeEntries(
  client,
  { memberId, projectId, assignmentId, timezone, descriptions },
) {
  const existing = await client.query(
    "SELECT 1 FROM time_entries WHERE project_assignment_id = $1::uuid LIMIT 1",
    [assignmentId],
  );

  if (existing.rowCount > 0) return 0;

  let inserted = 0;

  for (const date of eachWeekday(SEED_DAYS_BACK)) {
    if (!chance(ENTRY_PROBABILITY)) continue;

    const durationMinutes = pick(DURATIONS_MINUTES);
    const description = pick(descriptions);
    const source = pickSource();
    const { startedAt, endedAt } = source === "timer" ? timerWindow(date, durationMinutes) : {};

    await client.query(
      `
        INSERT INTO time_entries (
          member_id, project_id, project_assignment_id, local_date, timezone,
          started_at, ended_at, duration_minutes, description, source, updated_at
        )
        VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4::date, $5,
          $6, $7, $8, $9, $10::entry_source, now()
        )
      `,
      [
        memberId,
        projectId,
        assignmentId,
        date,
        timezone,
        startedAt ?? null,
        endedAt ?? null,
        durationMinutes,
        description,
        source,
      ],
    );

    inserted += 1;
  }

  return inserted;
}

function* eachWeekday(daysBack) {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - daysBack);

  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = cursor.getUTCDay();

    if (day === 0 || day === 6) continue;

    yield formatDateOnly(cursor);
  }
}

function timerWindow(dateIso, durationMinutes) {
  const [year, month, day] = dateIso.split("-").map(Number);
  const startedAt = new Date(Date.UTC(year, month - 1, day, 7, 0, 0));
  const endedAt = new Date(startedAt.getTime() + durationMinutes * 60_000);

  return { startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString() };
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function chance(probability) {
  return Math.random() < probability;
}

function pickSource() {
  const roll = Math.random();

  if (roll < 0.75) return "grid";
  if (roll < 0.9) return "form";

  return "timer";
}

function printSummary({ entriesInserted }) {
  console.log("");
  console.log("Reports demo data is ready.");
  console.log(`Members: ${MEMBERS.length}`);
  console.log(`Projects: ${PROJECTS.length}`);
  console.log(`Project groups: ${GROUPS.length}`);
  console.log(`Assignments: ${ASSIGNMENTS.length}`);
  console.log(`Time entries inserted this run: ${entriesInserted}`);
  console.log("");
  console.log("Open http://localhost:3000/admin/reports (as the activated admin) to explore it.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
