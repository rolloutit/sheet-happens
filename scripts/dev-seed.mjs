#!/usr/bin/env node

// Content of the local dev seed: members, invitations, projects, project groups,
// assignments, internal rates, and a year of weekday time entries.
// Orchestration (Docker, extensions, `prisma db push`) lives in scripts/dev-db.mjs,
// the contractor timesheet workflow states in scripts/dev-seed-timesheets.mjs.
//
// Deliberately stops before payslips: that flow is meant to be driven by hand.
//
// Every insert is idempotent, so `pnpm db:dev:seed` can run against a database
// that is already seeded. Randomised parts run through a fixed-seed PRNG, so a
// reset on the same day reproduces the same dataset.

import { createHash } from "node:crypto";

import { seedTimesheetWorkflows } from "./dev-seed-timesheets.mjs";

const RATE_HISTORY_START = "2024-01-01";
const ASSIGNMENT_HISTORY_START = "2024-01-01";

// Time entries cover the current month plus this many whole months before it. A year of history
// is what makes the report period filters — year and custom ranges especially — worth testing.
const ENTRY_MONTHS_BACK = 12;
// Only the most recent weeks get "nothing to report" markers.
const INACTIVE_WEEK_LOOKBACK = 4;

const WORKDAY_PROBABILITY = 0.82;
// Share of weeks a member spends on a single project rather than splitting two.
const WEEKLY_SINGLE_FOCUS_PROBABILITY = 0.55;
const INACTIVE_WEEK_PROBABILITY = 0.4;
const ADMIN_EDIT_PROBABILITY = 0.02;
const DAILY_MINUTES = [360, 390, 420, 450, 480, 480, 480, 510, 540];

export const SEED_INVITATIONS = [
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

// `rates` entries are ordered oldest first; each period is closed automatically
// at the next one's start, so the last entry stays open-ended.
const MEMBERS = [
  {
    email: "admin@example.com",
    firstName: "Admin",
    lastName: "User",
    role: "admin",
    status: "invited",
    profile: "employee",
    currency: "EUR",
    timezone: "Europe/Budapest",
    locale: "en",
    profileReason: "Dev first admin bootstrap",
    rates: [{ validFrom: RATE_HISTORY_START, hourlyRate: "42.00" }],
  },
  {
    email: "contractor@example.com",
    firstName: "Contractor",
    lastName: "Example",
    role: "member",
    status: "invited",
    profile: "contractor",
    currency: "EUR",
    timezone: "Europe/Budapest",
    locale: "en",
    profileReason: "Dev contractor invitation",
    rates: [
      { validFrom: RATE_HISTORY_START, hourlyRate: "58.00" },
      { monthsBack: 2, hourlyRate: "62.00" },
    ],
  },
  {
    email: "employee@example.com",
    firstName: "Employee",
    lastName: "Example",
    role: "member",
    status: "inactive",
    profile: "employee",
    currency: "HUF",
    timezone: "Europe/Budapest",
    locale: "hu",
    profileReason: "Dev inactive employee sample",
    rates: [{ validFrom: RATE_HISTORY_START, hourlyRate: "9200.00" }],
  },
  {
    email: "dora.kovacs@example.com",
    firstName: "Dóra",
    lastName: "Kovács",
    role: "member",
    status: "active",
    profile: "employee",
    currency: "EUR",
    timezone: "Europe/Budapest",
    locale: "hu",
    profileReason: "Dev team seed",
    rates: [
      { validFrom: RATE_HISTORY_START, hourlyRate: "26.00" },
      { monthsBack: 2, hourlyRate: "28.00" },
    ],
  },
  {
    email: "bence.nagy@example.com",
    firstName: "Bence",
    lastName: "Nagy",
    role: "member",
    status: "active",
    profile: "employee",
    currency: "HUF",
    timezone: "Europe/Budapest",
    locale: "hu",
    profileReason: "Dev team seed",
    rates: [{ validFrom: RATE_HISTORY_START, hourlyRate: "8500.00" }],
  },
  {
    email: "emma.toth@example.com",
    firstName: "Emma",
    lastName: "Tóth",
    role: "admin",
    status: "active",
    profile: "employee",
    currency: "EUR",
    timezone: "Europe/Budapest",
    locale: "en",
    profileReason: "Dev second admin seed",
    rates: [
      { validFrom: RATE_HISTORY_START, hourlyRate: "24.00" },
      { monthsBack: 3, hourlyRate: "26.50" },
    ],
  },
  {
    email: "marcus.weber@example.com",
    firstName: "Marcus",
    lastName: "Weber",
    role: "member",
    status: "active",
    profile: "contractor",
    currency: "EUR",
    timezone: "Europe/Berlin",
    locale: "en",
    profileReason: "Dev team seed",
    rates: [{ validFrom: RATE_HISTORY_START, hourlyRate: "55.00" }],
  },
  {
    email: "sara.klein@example.com",
    firstName: "Sara",
    lastName: "Klein",
    role: "member",
    status: "active",
    profile: "contractor",
    currency: "EUR",
    timezone: "Europe/Vienna",
    locale: "en",
    profileReason: "Dev team seed",
    rates: [
      { validFrom: RATE_HISTORY_START, hourlyRate: "60.00" },
      { monthsBack: 1, hourlyRate: "64.00" },
    ],
  },
  {
    email: "levente.szabo@example.com",
    firstName: "Levente",
    lastName: "Szabó",
    role: "member",
    status: "active",
    profile: "contractor",
    currency: "HUF",
    timezone: "Europe/Budapest",
    locale: "hu",
    profileReason: "Dev team seed",
    rates: [{ validFrom: RATE_HISTORY_START, hourlyRate: "12000.00" }],
  },
];

const PROJECTS = [
  {
    slug: "atlas-platform",
    name: "Atlas Platform",
    colorToken: "teal",
    status: "active",
    isInternal: false,
    startsOn: "2024-02-01",
    notes: "Flagship client platform. Long-running delivery team.",
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
    startsOn: "2024-05-01",
    notes: "iOS and Android companion app.",
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
    startsOn: "2024-09-01",
    notes: "Nightly ETL and reporting warehouse.",
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
    slug: "vega-integration",
    name: "Vega Integration",
    colorToken: "violet",
    status: "active",
    isInternal: false,
    startsOn: "2025-01-06",
    notes: "Partner API integration, contractor-heavy.",
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
    slug: "aurora-billing",
    name: "Aurora Billing",
    colorToken: "blue",
    status: "active",
    isInternal: false,
    startsOnMonthsBack: 1,
    notes: "Newest engagement — started this quarter.",
    descriptions: [
      "Discovery workshop",
      "Billing rules mapping",
      "Prototype implementation",
      "Data model review",
      "Stakeholder demo",
      "Estimation session",
    ],
  },
  {
    slug: "horizon-redesign",
    name: "Horizon Redesign",
    colorToken: "amber",
    status: "inactive",
    isInternal: false,
    startsOn: "2024-03-01",
    endsOnMonthsBack: 1,
    notes: "Wrapped up; kept inactive for reporting history.",
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
    slug: "orion-legacy-migration",
    name: "Orion Legacy Migration",
    colorToken: "rose",
    status: "archived",
    isInternal: false,
    startsOn: "2023-06-01",
    endsOnMonthsBack: 2,
    notes: "Archived after the cutover. Read-only history.",
    descriptions: [
      "Legacy data export",
      "Cutover rehearsal",
      "Rollback plan review",
      "Decommission checklist",
      "Handover documentation",
      "Post-migration support",
    ],
  },
  {
    slug: "internal-ops-tooling",
    name: "Internal Ops & Tooling",
    colorToken: "slate",
    status: "active",
    isInternal: true,
    startsOn: "2024-01-02",
    notes: "Non-billable internal engineering time.",
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
      "vega-integration",
      "aurora-billing",
      "horizon-redesign",
      "orion-legacy-migration",
    ],
  },
  {
    slug: "internal",
    name: "Internal",
    description: "Non-billable internal work",
    projectSlugs: ["internal-ops-tooling"],
  },
];

// `endedMonthsBack` closes the assignment at the first of that month, which also
// stops its time entries there. `startedMonthsBack` does the same for the start.
const ASSIGNMENTS = [
  { memberEmail: "admin@example.com", projectSlug: "internal-ops-tooling" },
  { memberEmail: "admin@example.com", projectSlug: "atlas-platform" },
  { memberEmail: "contractor@example.com", projectSlug: "vega-integration", overrideRate: "70.00" },
  { memberEmail: "contractor@example.com", projectSlug: "nimbus-mobile-app" },
  { memberEmail: "employee@example.com", projectSlug: "horizon-redesign", endedMonthsBack: 2 },
  { memberEmail: "dora.kovacs@example.com", projectSlug: "atlas-platform" },
  { memberEmail: "dora.kovacs@example.com", projectSlug: "nimbus-mobile-app" },
  { memberEmail: "bence.nagy@example.com", projectSlug: "fenix-data-pipeline" },
  { memberEmail: "bence.nagy@example.com", projectSlug: "internal-ops-tooling" },
  {
    memberEmail: "bence.nagy@example.com",
    projectSlug: "orion-legacy-migration",
    endedMonthsBack: 2,
  },
  { memberEmail: "emma.toth@example.com", projectSlug: "atlas-platform" },
  { memberEmail: "emma.toth@example.com", projectSlug: "internal-ops-tooling" },
  { memberEmail: "marcus.weber@example.com", projectSlug: "nimbus-mobile-app" },
  { memberEmail: "marcus.weber@example.com", projectSlug: "vega-integration" },
  { memberEmail: "sara.klein@example.com", projectSlug: "atlas-platform", overrideRate: "65.00" },
  { memberEmail: "sara.klein@example.com", projectSlug: "horizon-redesign", endedMonthsBack: 1 },
  {
    memberEmail: "sara.klein@example.com",
    projectSlug: "aurora-billing",
    startedMonthsBack: 1,
    overrideRate: "68.00",
  },
  { memberEmail: "levente.szabo@example.com", projectSlug: "fenix-data-pipeline" },
  { memberEmail: "levente.szabo@example.com", projectSlug: "vega-integration" },
];

const NOTIFICATION_RULE_TYPES = [
  "weekly_hours_reminder",
  "monthly_invoice_reminder",
  "timesheet_submitted",
  "timesheet_approved",
  "timesheet_rejected",
  "invoice_uploaded",
  "invoice_rejected",
  "invoice_accepted",
  "timesheet_paid",
  "payslip_available",
  "time_entry_admin_modified",
];

export async function seedDevDatabase(client, { objectStorage }) {
  const memberIds = new Map();

  for (const member of MEMBERS) {
    const memberId = await ensureMember(client, member);
    memberIds.set(member.email, memberId);
    await ensureProfilePeriod(client, memberId, member);
  }

  const adminId = memberIds.get("admin@example.com");

  for (const member of MEMBERS) {
    await ensureMemberDefaultRates(client, {
      memberId: memberIds.get(member.email),
      member,
      createdByMemberId: adminId,
    });
  }

  for (const invitation of SEED_INVITATIONS) {
    await ensureInvitation(client, invitation);
  }

  const projectIds = new Map();

  for (const project of PROJECTS) {
    projectIds.set(project.slug, await ensureProject(client, project, adminId));
  }

  for (const group of GROUPS) {
    const groupId = await ensureProjectGroup(client, group);

    for (const projectSlug of group.projectSlugs) {
      await ensureGroupProject(client, groupId, projectIds.get(projectSlug));
    }
  }

  const assignmentsByMember = new Map();
  let overrideRateCount = 0;

  for (const assignment of ASSIGNMENTS) {
    const memberId = memberIds.get(assignment.memberEmail);
    const projectId = projectIds.get(assignment.projectSlug);
    const validFrom = assignment.startedMonthsBack
      ? toDateOnly(monthStart(assignment.startedMonthsBack))
      : ASSIGNMENT_HISTORY_START;
    const validTo = assignment.endedMonthsBack
      ? toDateOnly(monthStart(assignment.endedMonthsBack))
      : null;

    const assignmentId = await ensureAssignment(client, {
      memberId,
      projectId,
      validFrom,
      validTo,
      createdByMemberId: adminId,
    });

    if (assignment.overrideRate) {
      const member = MEMBERS.find((candidate) => candidate.email === assignment.memberEmail);

      overrideRateCount += await ensureAssignmentOverrideRate(client, {
        projectAssignmentId: assignmentId,
        currencyCode: member.currency,
        hourlyRate: assignment.overrideRate,
        validFrom,
        createdByMemberId: adminId,
      });
    }

    const memberAssignments = assignmentsByMember.get(assignment.memberEmail) ?? [];

    memberAssignments.push({
      assignmentId,
      projectId,
      projectSlug: assignment.projectSlug,
      validFrom,
      validTo,
    });
    assignmentsByMember.set(assignment.memberEmail, memberAssignments);
  }

  let timeEntryCount = 0;
  let inactiveWeekCount = 0;

  for (const [email, assignments] of assignmentsByMember) {
    const member = MEMBERS.find((candidate) => candidate.email === email);
    const result = await seedMemberTimeTracking(client, {
      member,
      memberId: memberIds.get(email),
      assignments,
      adminId,
    });

    timeEntryCount += result.timeEntries;
    inactiveWeekCount += result.inactiveWeeks;
  }

  await ensureNotificationConfiguration(client);

  const timesheets = await seedTimesheetWorkflows(client, {
    memberIds,
    adminId,
    objectStorage,
  });

  return {
    members: MEMBERS.length,
    projects: PROJECTS.length,
    groups: GROUPS.length,
    assignments: ASSIGNMENTS.length,
    overrideRates: overrideRateCount,
    timeEntries: timeEntryCount,
    inactiveWeeks: inactiveWeekCount,
    timesheets,
    timesheetStatuses: await countTimesheetStatuses(client),
  };
}

async function countTimesheetStatuses(client) {
  const result = await client.query(
    "SELECT status, count(*)::int AS count FROM timesheets GROUP BY status ORDER BY status",
  );

  return result.rows.map((row) => `${row.status} ${row.count}`);
}

async function ensureMember(client, member) {
  const inserted = await client.query(
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
        activated_at,
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
        CASE WHEN $6::member_status = 'invited'::member_status THEN null ELSE now() END,
        CASE WHEN $6::member_status = 'inactive'::member_status THEN now() ELSE null END,
        now()
      )
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `,
    [
      member.email,
      member.firstName,
      member.lastName,
      `${member.firstName} ${member.lastName}`,
      member.role,
      member.status,
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

async function ensureProfilePeriod(client, memberId, member) {
  await client.query(
    `
      INSERT INTO member_profile_periods (member_id, profile, valid_from, reason)
      SELECT $1::uuid, $2::member_profile_type, $3::date, $4
      WHERE NOT EXISTS (
        SELECT 1 FROM member_profile_periods
        WHERE member_id = $1::uuid AND reason = $4
      )
    `,
    [memberId, member.profile, RATE_HISTORY_START, member.profileReason],
  );
}

async function ensureMemberDefaultRates(client, { memberId, member, createdByMemberId }) {
  const existing = await client.query(
    "SELECT 1 FROM member_default_rate_periods WHERE member_id = $1::uuid LIMIT 1",
    [memberId],
  );

  if (existing.rowCount > 0) return;

  const periods = resolveRatePeriods(member.rates);

  for (const period of periods) {
    await client.query(
      `
        INSERT INTO member_default_rate_periods (
          member_id, valid_from, valid_to, hourly_rate, currency_code, created_by_member_id, note
        )
        VALUES ($1::uuid, $2::date, $3::date, $4::decimal, $5, $6::uuid, 'Dev seed')
      `,
      [
        memberId,
        period.validFrom,
        period.validTo,
        period.hourlyRate,
        member.currency,
        createdByMemberId,
      ],
    );
  }
}

async function ensureInvitation(client, invitation) {
  const tokenHash = createHash("sha256").update(invitation.token).digest("base64url");

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

async function ensureProject(client, project, adminId) {
  const startsOn = project.startsOnMonthsBack
    ? toDateOnly(monthStart(project.startsOnMonthsBack))
    : (project.startsOn ?? null);
  const endsOn = project.endsOnMonthsBack ? toDateOnly(monthStart(project.endsOnMonthsBack)) : null;

  const inserted = await client.query(
    `
      INSERT INTO projects (
        name, slug, color_token, status, starts_on, ends_on, is_internal, notes,
        created_by_member_id, updated_by_member_id, updated_at
      )
      VALUES (
        $1, $2, $3, $4::project_status, $5::date, $6::date, $7, $8, $9::uuid, $9::uuid, now()
      )
      ON CONFLICT (slug) DO NOTHING
      RETURNING id
    `,
    [
      project.name,
      project.slug,
      project.colorToken,
      project.status,
      startsOn,
      endsOn,
      project.isInternal,
      project.notes,
      adminId,
    ],
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

async function ensureAssignment(
  client,
  { memberId, projectId, validFrom, validTo, createdByMemberId },
) {
  const existing = await client.query(
    "SELECT id FROM project_assignments WHERE member_id = $1::uuid AND project_id = $2::uuid LIMIT 1",
    [memberId, projectId],
  );

  if (existing.rowCount > 0) return existing.rows[0].id;

  const inserted = await client.query(
    `
      INSERT INTO project_assignments (
        member_id, project_id, active, valid_from, valid_to,
        created_by_member_id, updated_by_member_id, updated_at
      )
      VALUES ($1::uuid, $2::uuid, $3, $4::date, $5::date, $6::uuid, $6::uuid, now())
      RETURNING id
    `,
    [memberId, projectId, validTo === null, validFrom, validTo, createdByMemberId],
  );

  return inserted.rows[0].id;
}

async function ensureAssignmentOverrideRate(
  client,
  { projectAssignmentId, currencyCode, hourlyRate, validFrom, createdByMemberId },
) {
  const existing = await client.query(
    "SELECT 1 FROM assignment_rate_periods WHERE project_assignment_id = $1::uuid LIMIT 1",
    [projectAssignmentId],
  );

  if (existing.rowCount > 0) return 0;

  await client.query(
    `
      INSERT INTO assignment_rate_periods (
        project_assignment_id, valid_from, hourly_rate, currency_code, created_by_member_id, note
      )
      VALUES ($1::uuid, $2::date, $3::decimal, $4, $5::uuid, 'Dev seed project override')
    `,
    [projectAssignmentId, validFrom, hourlyRate, currencyCode, createdByMemberId],
  );

  return 1;
}

// Real weeks have a focus: people rarely touch every assigned project every week.
// Picking a weekly focus first is what makes "nothing to report" markers meaningful.
async function seedMemberTimeTracking(client, { member, memberId, assignments, adminId }) {
  // Skipping is per day rather than per assignment, so a database seeded a month ago gains the
  // days it is missing instead of staying frozen at whatever the first run produced. Months that
  // already carry a timesheet stay untouched: a new entry there would sit outside the submitted
  // snapshot, which is the one thing a timesheet revision must never be.
  const [seededDays, timesheetMonths] = await Promise.all([
    client.query(
      "SELECT DISTINCT to_char(local_date, 'YYYY-MM-DD') AS day FROM time_entries WHERE member_id = $1::uuid",
      [memberId],
    ),
    client.query(
      "SELECT to_char(period_start, 'YYYY-MM') AS month FROM timesheets WHERE contractor_member_id = $1::uuid",
      [memberId],
    ),
  ]);
  const filledDays = new Set(seededDays.rows.map((row) => row.day));
  const closedMonths = new Set(timesheetMonths.rows.map((row) => row.month));
  const random = createRandom(`time-tracking:${member.email}`);
  const windowStart = monthStart(ENTRY_MONTHS_BACK);
  const windowEnd = startOfToday();
  const adminEditCutoff = addDays(windowEnd, -30);
  const inactiveWeekCutoff = addDays(getMonday(windowEnd), -7 * INACTIVE_WEEK_LOOKBACK);
  let timeEntries = 0;
  let inactiveWeeks = 0;

  for (const weekStart of eachWeekStart(windowStart, windowEnd)) {
    const days = eachWeekday(
      maxDate(weekStart, windowStart),
      minDate(addDays(weekStart, 6), windowEnd),
    );
    const eligible = assignments.filter((assignment) => coversWeek(assignment, weekStart));

    if (eligible.length === 0) continue;

    const focusCount =
      eligible.length === 1 || random() < WEEKLY_SINGLE_FOCUS_PROBABILITY
        ? 1
        : Math.min(2, eligible.length);
    const focus = pickMany(random, eligible, focusCount);

    for (const date of days) {
      const localDate = toDateOnly(date);
      const active = focus.filter((assignment) => coversDate(assignment, localDate));

      if (active.length === 0) continue;
      if (random() >= WORKDAY_PROBABILITY) continue;

      // Decided after the rolls above, never before them: skipping earlier would shift the PRNG
      // stream, and the next run would invent a different set of workdays for the same days.
      const skipDay = filledDays.has(localDate) || closedMonths.has(localDate.slice(0, 7));

      const durations = splitMinutes(random, pick(random, DAILY_MINUTES), active.length);
      // Timer-sourced entries need non-overlapping windows, so walk a clock through the day.
      let cursor = new Date(`${localDate}T07:00:00.000Z`);

      for (const [index, assignment] of active.entries()) {
        const durationMinutes = durations[index];
        const source = pickSource(random);
        const startedAt = cursor;
        const endedAt = new Date(cursor.getTime() + durationMinutes * 60_000);
        const project = PROJECTS.find((candidate) => candidate.slug === assignment.projectSlug);
        const description = pick(random, project.descriptions);
        const isAdminEdited = date >= adminEditCutoff && random() < ADMIN_EDIT_PROBABILITY;

        cursor = new Date(endedAt.getTime() + 30 * 60_000);

        if (skipDay) continue;

        await client.query(
          `
            INSERT INTO time_entries (
              member_id, project_id, project_assignment_id, local_date, timezone,
              started_at, ended_at, duration_minutes, description, source,
              created_by_member_id, updated_by_member_id,
              admin_modified_at, admin_modified_by_member_id, admin_modification_reason,
              updated_at
            )
            VALUES (
              $1::uuid, $2::uuid, $3::uuid, $4::date, $5,
              $6, $7, $8, $9, $10::entry_source,
              $1::uuid, $1::uuid,
              $11, $12::uuid, $13,
              now()
            )
          `,
          [
            memberId,
            assignment.projectId,
            assignment.assignmentId,
            localDate,
            member.timezone,
            source === "timer" ? startedAt.toISOString() : null,
            source === "timer" ? endedAt.toISOString() : null,
            durationMinutes,
            description,
            source,
            isAdminEdited ? endedAt.toISOString() : null,
            isAdminEdited ? adminId : null,
            isAdminEdited ? "Corrected after the weekly review." : null,
          ],
        );

        timeEntries += 1;
      }
    }

    if (weekStart < inactiveWeekCutoff) continue;

    for (const assignment of eligible) {
      if (focus.includes(assignment)) continue;
      if (random() >= INACTIVE_WEEK_PROBABILITY) continue;

      const marked = await client.query(
        `
          INSERT INTO inactive_project_weeks (member_id, project_id, week_start_date, timezone, note)
          VALUES ($1::uuid, $2::uuid, $3::date, $4, 'Dev seed')
          ON CONFLICT (member_id, project_id, week_start_date) DO NOTHING
        `,
        [memberId, assignment.projectId, toDateOnly(weekStart), member.timezone],
      );

      inactiveWeeks += marked.rowCount;
    }
  }

  return { timeEntries, inactiveWeeks };
}

async function ensureNotificationConfiguration(client) {
  await client.query(
    `
      INSERT INTO notification_configuration (id, updated_at)
      VALUES ('system', now())
      ON CONFLICT (id) DO NOTHING
    `,
  );

  for (const type of NOTIFICATION_RULE_TYPES) {
    await client.query(
      `
        INSERT INTO notification_rules (type, email_enabled, in_app_enabled, updated_at)
        VALUES ($1::notification_type, true, true, now())
        ON CONFLICT (type) DO NOTHING
      `,
      [type],
    );
  }
}

function resolveRatePeriods(rates) {
  const resolved = rates.map((rate) => ({
    validFrom: rate.validFrom ?? toDateOnly(monthStart(rate.monthsBack)),
    hourlyRate: rate.hourlyRate,
  }));

  // valid_to is exclusive, so each period ends where the next one starts.
  return resolved.map((rate, index) => ({
    ...rate,
    validTo: resolved[index + 1]?.validFrom ?? null,
  }));
}

function startOfToday() {
  const date = new Date();

  date.setUTCHours(0, 0, 0, 0);

  return date;
}

function monthStart(monthsBack) {
  const today = startOfToday();

  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsBack, 1));
}

function addDays(date, days) {
  const next = new Date(date);

  next.setUTCDate(next.getUTCDate() + days);

  return next;
}

function getMonday(date) {
  return addDays(date, -((date.getUTCDay() + 6) % 7));
}

function minDate(left, right) {
  return left <= right ? left : right;
}

function maxDate(left, right) {
  return left >= right ? left : right;
}

function* eachWeekStart(start, end) {
  for (const cursor = getMonday(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 7)) {
    yield new Date(cursor);
  }
}

function coversDate(assignment, localDate) {
  return (
    localDate >= assignment.validFrom &&
    (assignment.validTo === null || localDate < assignment.validTo)
  );
}

function coversWeek(assignment, weekStart) {
  return (
    toDateOnly(addDays(weekStart, 6)) >= assignment.validFrom &&
    (assignment.validTo === null || toDateOnly(weekStart) < assignment.validTo)
  );
}

function* eachWeekday(start, end) {
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const weekday = cursor.getUTCDay();

    if (weekday === 0 || weekday === 6) continue;

    yield new Date(cursor);
  }
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

function pickMany(random, list, count) {
  const pool = [...list];
  const picked = [];

  while (picked.length < count && pool.length > 0) {
    picked.push(...pool.splice(Math.floor(random() * pool.length), 1));
  }

  return picked;
}

function splitMinutes(random, totalMinutes, parts) {
  if (parts === 1) return [totalMinutes];

  const quarters = totalMinutes / 15;
  const minQuarters = 4;
  const firstQuarters = minQuarters + Math.floor(random() * (quarters - minQuarters * 2 + 1));

  return [firstQuarters * 15, totalMinutes - firstQuarters * 15];
}

function pickSource(random) {
  const roll = random();

  if (roll < 0.75) return "grid";
  if (roll < 0.9) return "form";

  return "timer";
}

// mulberry32 seeded from the caller's label, so a reset reproduces the same data.
function createRandom(seedText) {
  let state = 0;

  for (const character of seedText) {
    state = (Math.imul(state, 31) + character.codePointAt(0)) >>> 0;
  }

  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;

    let value = state;

    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
