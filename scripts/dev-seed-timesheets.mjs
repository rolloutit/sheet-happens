#!/usr/bin/env node

// Monthly contractor timesheet states for the local dev seed. Every scenario replays the same steps
// the app performs — submit, review, invoice, pay — so the admin approval table has a row in each
// status and the review screen behind it has a believable revision and event history.
//
// Invoice PDFs are generated here and uploaded to the dev MinIO bucket, because the admin invoice
// preview streams the stored object: a document row with nothing behind it renders as a 404.
//
// Idempotent per contractor month. A month that already has a timesheet is left untouched, so
// `pnpm db:dev:seed` never rewrites a workflow the developer moved on by hand.

import { createHash, randomUUID } from "node:crypto";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Reviews are attributed to the active second admin rather than the bootstrap admin, so the
// timeline reads like someone actually looked at the month.
const REVIEWER_EMAIL = "emma.toth@example.com";

// Hours added to the previous step. The first step starts the morning after the month closed.
const STEP_HOURS = {
  submit: 0,
  reject: 26,
  resubmit: 30,
  approve: 26,
  "upload-invoice": 22,
  "reject-invoice": 26,
  "accept-invoice": 26,
  pay: 96,
};

// Whole closed months only — the current month stays open so time tracking has somewhere to write.
// Between them these cover all seven persisted statuses, with two submitted rows for bulk approval
// and one month that already went through a rejection so revision history has something to show.
const SCENARIOS = [
  {
    memberEmail: "marcus.weber@example.com",
    monthsBack: 3,
    steps: ["submit", "approve", "upload-invoice", "accept-invoice", "pay"],
  },
  {
    memberEmail: "sara.klein@example.com",
    monthsBack: 3,
    steps: ["submit", "approve", "upload-invoice", "accept-invoice"],
  },
  {
    memberEmail: "levente.szabo@example.com",
    monthsBack: 3,
    steps: ["submit", "approve", "upload-invoice", "accept-invoice", "pay"],
  },
  {
    memberEmail: "contractor@example.com",
    monthsBack: 3,
    steps: ["submit", "approve", "upload-invoice", "accept-invoice", "pay"],
  },
  {
    memberEmail: "marcus.weber@example.com",
    monthsBack: 2,
    steps: ["submit", "approve", "upload-invoice", "reject-invoice"],
    invoiceRejectionReason:
      "The invoice total does not match the approved hours. Please cancel it and send a replacement.",
  },
  {
    memberEmail: "sara.klein@example.com",
    monthsBack: 2,
    steps: ["submit", "approve", "upload-invoice"],
  },
  {
    memberEmail: "levente.szabo@example.com",
    monthsBack: 2,
    steps: ["submit", "approve"],
  },
  {
    memberEmail: "contractor@example.com",
    monthsBack: 2,
    steps: ["submit", "approve"],
  },
  {
    memberEmail: "marcus.weber@example.com",
    monthsBack: 1,
    steps: ["submit", "reject", "resubmit"],
    rejectionReason:
      "The last client sync of the month is missing. Please add it and submit the month again.",
    // The resubmission has to differ from the rejected revision, otherwise the two snapshots are
    // identical and the revision history says nothing.
    correctionEntry: {
      description: "Client sync call added after the timesheet review",
      durationMinutes: 90,
    },
  },
  {
    memberEmail: "sara.klein@example.com",
    monthsBack: 1,
    steps: ["submit", "reject"],
    rejectionReason: "Two days are logged on Atlas Platform but belong to Aurora Billing.",
  },
  {
    memberEmail: "levente.szabo@example.com",
    monthsBack: 1,
    steps: ["submit"],
  },
  {
    memberEmail: "contractor@example.com",
    monthsBack: 1,
    steps: ["submit"],
  },
];

export async function seedTimesheetWorkflows(client, { memberIds, adminId, objectStorage }) {
  const reviewerId = memberIds.get(REVIEWER_EMAIL) ?? adminId;
  const storage = createStorageClient(objectStorage);
  const now = new Date();
  const summary = { timesheets: 0, revisions: 0, invoices: 0, skipped: 0 };

  for (const scenario of SCENARIOS) {
    const memberId = memberIds.get(scenario.memberEmail);

    if (!memberId) continue;

    const period = monthPeriod(scenario.monthsBack);
    const existing = await client.query(
      "SELECT 1 FROM timesheets WHERE contractor_member_id = $1::uuid AND period_start = $2::date",
      [memberId, period.start],
    );

    if (existing.rowCount > 0) {
      summary.skipped += 1;
      continue;
    }

    const member = await loadMember(client, memberId);
    const lines = await resolveMonthLines(client, { memberId, period });

    // A contractor with no tracked hours in the month has nothing to submit, and the seeded time
    // entries are randomised, so this is a real possibility rather than a defect.
    if (lines.length === 0 || countCurrencies(lines) !== 1) {
      summary.skipped += 1;
      continue;
    }

    const state = {
      member,
      memberId,
      reviewerId,
      period,
      lines,
      timesheetId: null,
      revisionId: null,
      revisionNumber: 0,
      totals: null,
      invoice: null,
    };
    const timestamps = buildStepTimestamps(scenario.steps, period.end, now);

    for (const [index, step] of scenario.steps.entries()) {
      await applyStep(client, {
        step,
        at: timestamps[index],
        scenario,
        state,
        storage,
        objectStorage,
      });
    }

    summary.timesheets += 1;
    summary.revisions += state.revisionNumber;
    if (state.invoice) summary.invoices += 1;
  }

  return summary;
}

async function applyStep(client, { step, at, scenario, state, storage, objectStorage }) {
  switch (step) {
    case "submit":
      await submitRevision(client, { state, at, resubmit: false });
      return;
    case "reject":
      await rejectTimesheet(client, { state, at, reason: scenario.rejectionReason });
      return;
    case "resubmit":
      if (scenario.correctionEntry) {
        await addCorrectionEntry(client, { state, at, entry: scenario.correctionEntry });
      }
      await submitRevision(client, { state, at, resubmit: true });
      return;
    case "approve":
      await approveTimesheet(client, { state, at });
      return;
    case "upload-invoice":
      await uploadInvoice(client, { state, at, storage, objectStorage });
      return;
    case "reject-invoice":
      await reviewInvoice(client, { state, at, reason: scenario.invoiceRejectionReason });
      return;
    case "accept-invoice":
      await reviewInvoice(client, { state, at, reason: null });
      return;
    case "pay":
      await markPaid(client, { state, at });
      return;
    default:
      throw new Error(`Unknown timesheet seed step: ${step}`);
  }
}

// Mirrors submitContractorTimesheet: an immutable revision, one snapshot line per time entry, a
// period lock, and the source entries locked to the revision.
async function submitRevision(client, { state, at, resubmit }) {
  const totals = getTotals(state.lines);
  const previousRevisionId = state.revisionId;
  const revisionNumber = state.revisionNumber + 1;

  if (!state.timesheetId) {
    const inserted = await client.query(
      `
        INSERT INTO timesheets (
          contractor_member_id, period_start, period_end, currency_code, status,
          submitted_at, created_by_member_id, updated_by_member_id, created_at, updated_at
        )
        VALUES ($1::uuid, $2::date, $3::date, $4, 'submitted'::timesheet_status,
          $5::timestamptz, $1::uuid, $1::uuid, $5::timestamptz, $5::timestamptz)
        RETURNING id
      `,
      [state.memberId, state.period.start, state.period.end, totals.currencyCode, at.toISOString()],
    );

    state.timesheetId = inserted.rows[0].id;
  }

  const revision = await client.query(
    `
      INSERT INTO timesheet_revisions (
        timesheet_id, revision_number, status, created_from_revision_id, submitted_at,
        currency_code, total_minutes, total_amount, created_by_member_id, created_at
      )
      VALUES ($1::uuid, $2, 'submitted'::timesheet_status, $3::uuid, $4::timestamptz,
        $5, $6, $7::decimal, $8::uuid, $4::timestamptz)
      RETURNING id
    `,
    [
      state.timesheetId,
      revisionNumber,
      previousRevisionId,
      at.toISOString(),
      totals.currencyCode,
      totals.totalMinutes,
      totals.totalAmount,
      state.memberId,
    ],
  );

  state.revisionId = revision.rows[0].id;
  state.revisionNumber = revisionNumber;
  state.totals = totals;

  if (previousRevisionId) {
    await client.query(
      "UPDATE timesheet_revisions SET superseded_by_revision_id = $2::uuid WHERE id = $1::uuid",
      [previousRevisionId, state.revisionId],
    );
  }

  for (const line of state.lines) {
    await client.query(
      `
        INSERT INTO timesheet_snapshot_lines (
          timesheet_revision_id, source_time_entry_id, member_id, project_id, project_assignment_id,
          local_date, description, duration_minutes, rate_source, source_rate_period_id,
          hourly_rate, currency_code, line_amount, created_at
        )
        VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
          $6::date, $7, $8, $9::rate_source, $10::uuid,
          $11::decimal, $12, $13::decimal, $14::timestamptz)
      `,
      [
        state.revisionId,
        line.id,
        line.member_id,
        line.project_id,
        line.project_assignment_id,
        line.local_date,
        line.description,
        line.duration_minutes,
        line.rate_source,
        line.rate_period_id,
        line.hourly_rate,
        line.currency_code,
        line.line_amount,
        at.toISOString(),
      ],
    );
  }

  await client.query(
    `
      UPDATE timesheets
      SET status = 'submitted'::timesheet_status,
          currency_code = $2,
          current_revision_id = $3::uuid,
          current_revision_number = $4,
          submitted_at = $5::timestamptz,
          approved_at = null,
          accepted_at = null,
          paid_at = null,
          updated_by_member_id = $6::uuid,
          updated_at = $5::timestamptz
      WHERE id = $1::uuid
    `,
    [
      state.timesheetId,
      totals.currencyCode,
      state.revisionId,
      revisionNumber,
      at.toISOString(),
      state.memberId,
    ],
  );

  await client.query(
    `
      INSERT INTO period_locks (
        member_id, period_start, timesheet_id, timesheet_revision_id, locked_at, locked_by_member_id
      )
      VALUES ($1::uuid, $2::date, $3::uuid, $4::uuid, $5::timestamptz, $1::uuid)
    `,
    [state.memberId, state.period.start, state.timesheetId, state.revisionId, at.toISOString()],
  );

  await client.query(
    `
      UPDATE time_entries
      SET locked_by_timesheet_revision_id = $1::uuid, updated_at = $2::timestamptz
      WHERE id = ANY($3::uuid[])
    `,
    [state.revisionId, at.toISOString(), state.lines.map((line) => line.id)],
  );

  const metadata = buildRevisionMetadata(state);

  await recordEvent(client, {
    state,
    at,
    eventType: resubmit ? "resubmitted" : "submitted",
    actorMemberId: state.memberId,
    reason: null,
    metadata,
  });

  await recordAudit(client, {
    at,
    actorMemberId: state.memberId,
    action: resubmit ? "timesheet.resubmitted" : "timesheet.submitted",
    targetType: "timesheet",
    targetId: state.timesheetId,
    after: { ...metadata, status: "SUBMITTED", revisionId: state.revisionId },
  });
}

async function approveTimesheet(client, { state, at }) {
  await client.query(
    `
      UPDATE timesheets
      SET status = 'approved'::timesheet_status,
          approved_at = $2::timestamptz,
          updated_by_member_id = $3::uuid,
          updated_at = $2::timestamptz
      WHERE id = $1::uuid
    `,
    [state.timesheetId, at.toISOString(), state.reviewerId],
  );

  await client.query(
    `
      UPDATE timesheet_revisions
      SET status = 'approved'::timesheet_status,
          approved_at = $2::timestamptz,
          rejected_at = null,
          rejection_reason = null
      WHERE id = $1::uuid
    `,
    [state.revisionId, at.toISOString()],
  );

  const metadata = buildRevisionMetadata(state);

  await recordEvent(client, {
    state,
    at,
    eventType: "approved",
    actorMemberId: state.reviewerId,
    reason: null,
    metadata,
  });

  await recordAudit(client, {
    at,
    actorMemberId: state.reviewerId,
    action: "timesheet.approved",
    targetType: "timesheet",
    targetId: state.timesheetId,
    after: { ...metadata, status: "APPROVED" },
  });
}

// Rejection is the only step that gives the month back to the contractor: the lock is released and
// the source entries are unlocked, which is what makes a resubmission possible.
async function rejectTimesheet(client, { state, at, reason }) {
  await client.query(
    `
      UPDATE timesheets
      SET status = 'rejected'::timesheet_status,
          approved_at = null,
          accepted_at = null,
          paid_at = null,
          updated_by_member_id = $3::uuid,
          updated_at = $2::timestamptz
      WHERE id = $1::uuid
    `,
    [state.timesheetId, at.toISOString(), state.reviewerId],
  );

  await client.query(
    `
      UPDATE timesheet_revisions
      SET status = 'rejected'::timesheet_status,
          approved_at = null,
          accepted_at = null,
          paid_at = null,
          rejected_at = $2::timestamptz,
          rejection_reason = $3
      WHERE id = $1::uuid
    `,
    [state.revisionId, at.toISOString(), reason],
  );

  const unlockedLocks = await client.query(
    `
      UPDATE period_locks
      SET unlocked_at = $3::timestamptz, unlocked_by_member_id = $4::uuid, unlock_reason = $5
      WHERE timesheet_id = $1::uuid AND timesheet_revision_id = $2::uuid AND unlocked_at IS NULL
    `,
    [state.timesheetId, state.revisionId, at.toISOString(), state.reviewerId, reason],
  );

  const unlockedEntries = await client.query(
    `
      UPDATE time_entries
      SET locked_by_timesheet_revision_id = null, updated_at = $2::timestamptz
      WHERE locked_by_timesheet_revision_id = $1::uuid AND deleted_at IS NULL
    `,
    [state.revisionId, at.toISOString()],
  );

  const metadata = {
    ...buildRevisionMetadata(state),
    unlockedLockCount: unlockedLocks.rowCount,
    unlockedEntryCount: unlockedEntries.rowCount,
  };

  for (const eventType of ["rejected", "unlocked"]) {
    await recordEvent(client, {
      state,
      at,
      eventType,
      actorMemberId: state.reviewerId,
      reason,
      metadata,
    });
  }

  await recordAudit(client, {
    at,
    actorMemberId: state.reviewerId,
    action: "timesheet.rejected",
    targetType: "timesheet",
    targetId: state.timesheetId,
    after: { ...metadata, status: "REJECTED", rejectionReason: reason },
  });
}

async function uploadInvoice(client, { state, at, storage, objectStorage }) {
  const invoiceNumber = buildInvoiceNumber(state);
  const filename = `invoice-${state.period.start.slice(0, 7)}-${slug(state.member.displayName)}.pdf`;
  const bytes = createInvoicePdf({
    invoiceNumber,
    contractorName: state.member.displayName,
    contractorEmail: state.member.email,
    periodLabel: `${state.period.start} - ${state.period.end}`,
    totals: state.totals,
    revisionNumber: state.revisionNumber,
  });
  const storageKey = [
    "contractor-invoices",
    state.memberId,
    state.period.start,
    `revision-${state.revisionNumber}`,
    `${randomUUID()}-${filename}`,
  ].join("/");

  await storage.send(
    new PutObjectCommand({
      Bucket: objectStorage.bucket,
      Key: storageKey,
      Body: bytes,
      ContentType: "application/pdf",
      ContentLength: bytes.length,
    }),
  );

  const document = await client.query(
    `
      INSERT INTO documents (
        type, status, owner_member_id, storage_bucket, storage_key, original_filename,
        content_type, byte_size, checksum_sha256, uploaded_by_member_id, created_at
      )
      VALUES ('contractor_invoice'::document_type, 'available'::document_status, $1::uuid, $2, $3, $4,
        'application/pdf', $5, $6, $1::uuid, $7::timestamptz)
      RETURNING id
    `,
    [
      state.memberId,
      objectStorage.bucket,
      storageKey,
      filename,
      bytes.length,
      createHash("sha256").update(bytes).digest("hex"),
      at.toISOString(),
    ],
  );

  const invoice = await client.query(
    `
      INSERT INTO contractor_invoices (
        timesheet_id, timesheet_revision_id, document_id, role, status, invoice_number,
        declared_amount, currency_code, uploaded_by_member_id, created_at
      )
      VALUES ($1::uuid, $2::uuid, $3::uuid, 'original'::invoice_role, 'uploaded'::invoice_status, $4,
        $5::decimal, $6, $7::uuid, $8::timestamptz)
      RETURNING id
    `,
    [
      state.timesheetId,
      state.revisionId,
      document.rows[0].id,
      invoiceNumber,
      state.totals.totalAmount,
      state.totals.currencyCode,
      state.memberId,
      at.toISOString(),
    ],
  );

  state.invoice = {
    id: invoice.rows[0].id,
    documentId: document.rows[0].id,
    invoiceNumber,
    storageKey,
  };

  await client.query(
    `
      UPDATE timesheets
      SET status = 'invoiced'::timesheet_status,
          updated_by_member_id = $2::uuid,
          updated_at = $3::timestamptz
      WHERE id = $1::uuid
    `,
    [state.timesheetId, state.memberId, at.toISOString()],
  );

  await client.query(
    "UPDATE timesheet_revisions SET status = 'invoiced'::timesheet_status WHERE id = $1::uuid",
    [state.revisionId],
  );

  const metadata = {
    ...buildInvoiceMetadata(state),
    documentStorageKey: storageKey,
    byteSize: bytes.length,
    invoiceRole: "ORIGINAL",
    replacedInvoiceId: null,
    referencesInvoiceId: null,
  };

  await recordEvent(client, {
    state,
    at,
    eventType: "invoice_uploaded",
    actorMemberId: state.memberId,
    reason: null,
    metadata,
  });

  await recordAudit(client, {
    at,
    actorMemberId: state.memberId,
    action: "invoice.uploaded",
    targetType: "contractor_invoice",
    targetId: state.invoice.id,
    after: {
      ...metadata,
      timesheetId: state.timesheetId,
      timesheetRevisionId: state.revisionId,
      status: "UPLOADED",
    },
  });
}

// One step for both invoice outcomes: a reason means rejection, no reason means acceptance.
async function reviewInvoice(client, { state, at, reason }) {
  const accepted = !reason;
  const invoiceStatus = accepted ? "accepted" : "rejected";
  const timesheetStatus = accepted ? "accepted" : "invoice_rejected";

  await client.query(
    `
      UPDATE contractor_invoices
      SET status = $2::invoice_status,
          reviewed_by_member_id = $3::uuid,
          reviewed_at = $4::timestamptz,
          rejection_reason = $5
      WHERE id = $1::uuid
    `,
    [state.invoice.id, invoiceStatus, state.reviewerId, at.toISOString(), reason],
  );

  await client.query(
    `
      UPDATE timesheets
      SET status = $2::timesheet_status,
          accepted_at = $3::timestamptz,
          paid_at = null,
          updated_by_member_id = $4::uuid,
          updated_at = $5::timestamptz
      WHERE id = $1::uuid
    `,
    [
      state.timesheetId,
      timesheetStatus,
      accepted ? at.toISOString() : null,
      state.reviewerId,
      at.toISOString(),
    ],
  );

  await client.query(
    `
      UPDATE timesheet_revisions
      SET status = $2::timesheet_status, accepted_at = $3::timestamptz, paid_at = null
      WHERE id = $1::uuid
    `,
    [state.revisionId, timesheetStatus, accepted ? at.toISOString() : null],
  );

  const metadata = buildInvoiceMetadata(state);

  await recordEvent(client, {
    state,
    at,
    eventType: accepted ? "invoice_accepted" : "invoice_rejected",
    actorMemberId: state.reviewerId,
    reason,
    metadata,
  });

  await recordAudit(client, {
    at,
    actorMemberId: state.reviewerId,
    action: accepted ? "invoice.accepted" : "invoice.rejected",
    targetType: "contractor_invoice",
    targetId: state.invoice.id,
    after: {
      ...metadata,
      status: accepted ? "ACCEPTED" : "REJECTED",
      ...(accepted ? {} : { rejectionReason: reason }),
    },
  });
}

async function markPaid(client, { state, at }) {
  await client.query(
    `
      UPDATE timesheets
      SET status = 'paid'::timesheet_status,
          paid_at = $2::timestamptz,
          updated_by_member_id = $3::uuid,
          updated_at = $2::timestamptz
      WHERE id = $1::uuid
    `,
    [state.timesheetId, at.toISOString(), state.reviewerId],
  );

  await client.query(
    "UPDATE timesheet_revisions SET status = 'paid'::timesheet_status, paid_at = $2::timestamptz WHERE id = $1::uuid",
    [state.revisionId, at.toISOString()],
  );

  const metadata = {
    ...buildRevisionMetadata(state),
    invoiceId: state.invoice.id,
    invoiceNumber: state.invoice.invoiceNumber,
    invoiceDeclaredAmount: state.totals.totalAmount,
    invoiceCurrencyCode: state.totals.currencyCode,
    documentId: state.invoice.documentId,
  };

  await recordEvent(client, {
    state,
    at,
    eventType: "paid",
    actorMemberId: state.reviewerId,
    reason: null,
    metadata,
  });

  await recordAudit(client, {
    at,
    actorMemberId: state.reviewerId,
    action: "timesheet.paid",
    targetType: "timesheet",
    targetId: state.timesheetId,
    after: { ...metadata, status: "PAID" },
  });
}

async function addCorrectionEntry(client, { state, at, entry }) {
  const last = state.lines.at(-1);

  await client.query(
    `
      INSERT INTO time_entries (
        member_id, project_id, project_assignment_id, local_date, timezone,
        duration_minutes, description, source,
        created_by_member_id, updated_by_member_id, created_at, updated_at
      )
      VALUES ($1::uuid, $2::uuid, $3::uuid, $4::date, $5,
        $6, $7, 'form'::entry_source,
        $1::uuid, $1::uuid, $8::timestamptz, $8::timestamptz)
    `,
    [
      state.memberId,
      last.project_id,
      last.project_assignment_id,
      last.local_date,
      state.member.timezone,
      entry.durationMinutes,
      entry.description,
      at.toISOString(),
    ],
  );

  state.lines = await resolveMonthLines(client, {
    memberId: state.memberId,
    period: state.period,
  });
}

async function recordEvent(client, { state, at, eventType, actorMemberId, reason, metadata }) {
  await client.query(
    `
      INSERT INTO timesheet_events (
        timesheet_id, timesheet_revision_id, event_type, actor_member_id, reason, metadata, created_at
      )
      VALUES ($1::uuid, $2::uuid, $3::timesheet_event_type, $4::uuid, $5, $6::jsonb, $7::timestamptz)
    `,
    [
      state.timesheetId,
      state.revisionId,
      eventType,
      actorMemberId,
      reason,
      JSON.stringify(metadata),
      at.toISOString(),
    ],
  );
}

async function recordAudit(client, { at, actorMemberId, action, targetType, targetId, after }) {
  await client.query(
    `
      INSERT INTO audit_logs (actor_member_id, action, target_type, target_id, after, user_agent, created_at)
      VALUES ($1::uuid, $2, $3, $4::uuid, $5::jsonb, 'sheet-happens-dev-seed', $6::timestamptz)
    `,
    [actorMemberId, action, targetType, targetId, JSON.stringify(after), at.toISOString()],
  );
}

// The same rate resolution the submission path performs: an assignment override wins over the
// member default for the entry's own date, and the line amount rounds to whole cents.
async function resolveMonthLines(client, { memberId, period }) {
  const result = await client.query(
    `
      SELECT
        entry.id,
        entry.member_id,
        entry.project_id,
        entry.project_assignment_id,
        to_char(entry.local_date, 'YYYY-MM-DD') AS local_date,
        entry.description,
        entry.duration_minutes,
        CASE WHEN override.id IS NULL THEN 'member_default' ELSE 'project_override' END AS rate_source,
        COALESCE(override.id, member_rate.id) AS rate_period_id,
        COALESCE(override.hourly_rate, member_rate.hourly_rate) AS hourly_rate,
        COALESCE(override.currency_code, member_rate.currency_code) AS currency_code,
        ROUND(COALESCE(override.hourly_rate, member_rate.hourly_rate) * entry.duration_minutes / 60, 2) AS line_amount
      FROM time_entries entry
      LEFT JOIN LATERAL (
        SELECT rate.id, rate.hourly_rate, rate.currency_code
        FROM assignment_rate_periods rate
        WHERE rate.project_assignment_id = entry.project_assignment_id
          AND rate.valid_from <= entry.local_date
          AND (rate.valid_to IS NULL OR rate.valid_to > entry.local_date)
        ORDER BY rate.valid_from DESC
        LIMIT 1
      ) override ON true
      LEFT JOIN LATERAL (
        SELECT rate.id, rate.hourly_rate, rate.currency_code
        FROM member_default_rate_periods rate
        WHERE rate.member_id = entry.member_id
          AND rate.valid_from <= entry.local_date
          AND (rate.valid_to IS NULL OR rate.valid_to > entry.local_date)
        ORDER BY rate.valid_from DESC
        LIMIT 1
      ) member_rate ON true
      WHERE entry.member_id = $1::uuid
        AND entry.deleted_at IS NULL
        AND entry.local_date BETWEEN $2::date AND $3::date
      ORDER BY entry.local_date, entry.created_at
    `,
    [memberId, period.start, period.end],
  );

  return result.rows.filter((row) => row.rate_period_id);
}

async function loadMember(client, memberId) {
  const result = await client.query(
    "SELECT display_name, email, timezone FROM members WHERE id = $1::uuid",
    [memberId],
  );

  return {
    displayName: result.rows[0].display_name,
    email: result.rows[0].email,
    timezone: result.rows[0].timezone,
  };
}

function getTotals(lines) {
  const totalMinutes = lines.reduce((total, line) => total + line.duration_minutes, 0);
  const totalCents = lines.reduce((total, line) => total + moneyToCents(line.line_amount), 0);

  return {
    currencyCode: lines[0].currency_code.trim(),
    totalMinutes,
    totalAmount: centsToMoney(totalCents),
    entryCount: lines.length,
    projectCount: new Set(lines.map((line) => line.project_id)).size,
  };
}

function countCurrencies(lines) {
  return new Set(lines.map((line) => line.currency_code.trim())).size;
}

function buildRevisionMetadata(state) {
  return {
    periodStart: state.period.start,
    periodEnd: state.period.end,
    revisionId: state.revisionId,
    revisionNumber: state.revisionNumber,
    entryCount: state.totals.entryCount,
    projectCount: state.totals.projectCount,
    currencyCode: state.totals.currencyCode,
    totalMinutes: state.totals.totalMinutes,
    totalAmount: state.totals.totalAmount,
  };
}

function buildInvoiceMetadata(state) {
  return {
    invoiceId: state.invoice.id,
    invoiceNumber: state.invoice.invoiceNumber,
    invoiceDeclaredAmount: state.totals.totalAmount,
    invoiceCurrencyCode: state.totals.currencyCode,
    documentId: state.invoice.documentId,
    timesheetId: state.timesheetId,
    periodStart: state.period.start,
    periodEnd: state.period.end,
    revisionId: state.revisionId,
    revisionNumber: state.revisionNumber,
    entryCount: state.totals.entryCount,
    projectCount: state.totals.projectCount,
    timesheetTotalMinutes: state.totals.totalMinutes,
    timesheetTotalAmount: state.totals.totalAmount,
    timesheetCurrencyCode: state.totals.currencyCode,
  };
}

function buildInvoiceNumber(state) {
  const initials = state.member.displayName
    .split(/\s+/)
    .map((part) => part.at(0) ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return `${initials || "SH"}-${state.period.start.slice(0, 7).replace("-", "")}-01`;
}

function buildStepTimestamps(steps, periodEnd, now) {
  const base = new Date(`${periodEnd}T09:15:00.000Z`);

  base.setUTCDate(base.getUTCDate() + 1);

  let cursor = base;
  const stamps = steps.map((step, index) => {
    cursor = index === 0 ? cursor : new Date(cursor.getTime() + STEP_HOURS[step] * 3_600_000);

    return cursor;
  });

  // A month that closed yesterday cannot have a week of review behind it. Clamping each step to
  // its own slot before now keeps the chain in order however recently the month ended.
  return stamps.map((stamp, index) => {
    const latest = now.getTime() - (steps.length - 1 - index) * 60_000;

    return stamp.getTime() > latest ? new Date(latest) : stamp;
  });
}

function monthPeriod(monthsBack) {
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsBack, 1));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));

  return { start: toDateOnly(start), end: toDateOnly(end) };
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function moneyToCents(value) {
  return Math.round(Number(value) * 100);
}

function centsToMoney(cents) {
  return (cents / 100).toFixed(2);
}

function slug(value) {
  return (
    value
      .normalize("NFD")
      .replaceAll(/[\u0300-\u036f]/g, "")
      .replaceAll(/[^a-zA-Z0-9]+/g, "-")
      .replaceAll(/^-|-$/g, "")
      .toLowerCase() || "contractor"
  );
}

function createStorageClient(objectStorage) {
  return new S3Client({
    endpoint: objectStorage.endpoint,
    region: objectStorage.region,
    forcePathStyle: objectStorage.forcePathStyle !== "false",
    credentials: {
      accessKeyId: objectStorage.accessKeyId,
      secretAccessKey: objectStorage.secretAccessKey,
    },
  });
}

// A hand-built one-page PDF. The invoice preview only has to render something recognisable, and
// this keeps the seed free of a PDF dependency and of a Typst binary on PATH.
function createInvoicePdf({
  invoiceNumber,
  contractorName,
  contractorEmail,
  periodLabel,
  totals,
  revisionNumber,
}) {
  const hours = (totals.totalMinutes / 60).toFixed(2);
  const content = buildPdfContent([
    { size: 20, text: `Invoice ${invoiceNumber}` },
    { size: 11, text: "Dev seed placeholder - not a real invoice" },
    { size: 12, text: `Contractor: ${contractorName} (${contractorEmail})` },
    { size: 12, text: `Period: ${periodLabel}` },
    { size: 12, text: `Timesheet revision: ${revisionNumber}` },
    { size: 12, text: `Hours: ${hours}` },
    { size: 14, text: `Total: ${totals.totalAmount} ${totals.currencyCode}` },
  ]);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [];

  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "latin1");

  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

function buildPdfContent(lines) {
  const drawn = lines.map(
    (line, index) =>
      `/F1 ${line.size} Tf\n${index === 0 ? "0 0" : "0 -28"} Td\n(${escapePdfText(line.text)}) Tj`,
  );

  return `BT\n56 760 Td\n${drawn.join("\n")}\nET`;
}

function escapePdfText(text) {
  // WinAnsi covers the accents the seed uses; anything outside it becomes a plain letter rather
  // than a broken glyph.
  return text
    .replaceAll("ő", "o")
    .replaceAll("ű", "u")
    .replaceAll("Ő", "O")
    .replaceAll("Ű", "U")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}
