import { Client } from "pg";

import type { NotificationType } from "@/src/server/db/generated/enums";
import { databaseConnectionString, prisma } from "@/src/server/db/client";
import { formatDateOnly } from "@/src/server/time-tracking/dates";
import { getNotificationConfiguration, type NotificationRuleValue } from "./configuration";
import {
  enqueueNotification,
  processQueuedNotificationEmails,
  type NotificationRecipient,
} from "./delivery";
import { refreshStalePublicHolidays } from "@/src/server/leave/holidays";
import {
  getInvoiceReminderOccurrence,
  getMonthEndLeaveReminderOccurrence,
  getWeeklyOccurrence,
  LEAVE_REMINDER_TIME,
} from "./schedule";

const JOB_NAME = "notification_dispatch";
const JOB_HEARTBEAT_KEY = `${JOB_NAME}:heartbeat`;
const CURSOR_OVERLAP_MS = 60_000;
const ADVISORY_LOCK_ID = "6001134311443833413";
/** The holiday cache is checked at most this often; the API is only called when a year is stale. */
const HOLIDAY_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
let lastHolidayRefreshAt = 0;

type RuleMap = Map<NotificationType, NotificationRuleValue>;

export async function runNotificationDispatcher(input: { now?: Date } = {}) {
  const now = input.now ?? new Date();
  return withDispatcherLock(() => runLockedNotificationDispatcher(now));
}

async function runLockedNotificationDispatcher(now: Date) {
  const previousRun = await prisma.jobRun.findUnique({
    where: { idempotencyKey: JOB_HEARTBEAT_KEY },
    select: { metadata: true },
  });
  const previousMetadata = asObject(previousRun?.metadata);
  const job = await prisma.jobRun.upsert({
    where: { idempotencyKey: JOB_HEARTBEAT_KEY },
    create: {
      jobName: JOB_NAME,
      idempotencyKey: JOB_HEARTBEAT_KEY,
      startedAt: now,
      status: "RUNNING",
    },
    update: {
      startedAt: now,
      finishedAt: null,
      status: "RUNNING",
      error: null,
    },
  });

  try {
    const [configuration, storedConfiguration] = await Promise.all([
      getNotificationConfiguration(),
      prisma.notificationConfiguration.findUnique({
        where: { id: "system" },
        select: { createdAt: true },
      }),
    ]);
    const previousCursor =
      typeof previousMetadata.cursor === "string" ? new Date(previousMetadata.cursor) : null;
    const since =
      previousCursor && !Number.isNaN(previousCursor.getTime())
        ? new Date(previousCursor.getTime() - CURSOR_OVERLAP_MS)
        : (storedConfiguration?.createdAt ?? now);
    const rules = new Map(configuration.rules.map((rule) => [rule.type, rule])) as RuleMap;

    const [workflowCount, weeklyCount, invoiceCount, leaveCount] = await Promise.all([
      projectWorkflowNotifications({ since, now, rules }),
      projectWeeklyReminders({ now, configuration, rules }),
      projectInvoiceReminders({ now, configuration, rules }),
      projectLeaveReminders({ now, configuration, rules }),
    ]);
    const deliveries = await processQueuedNotificationEmails({ now });
    refreshHolidaysInBackground(now);

    const result = { workflowCount, weeklyCount, invoiceCount, leaveCount, deliveries };
    await prisma.jobRun.update({
      where: { id: job.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        metadata: { cursor: now.toISOString(), ...result },
      },
    });
    return { status: "success" as const, ...result };
  } catch (error) {
    await prisma.jobRun.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error:
          error instanceof Error ? error.message.slice(0, 2_000) : "Unknown notification job error",
      },
    });
    throw error;
  }
}

async function withDispatcherLock<T>(work: () => Promise<T>) {
  const lockClient = new Client({ connectionString: databaseConnectionString });
  await lockClient.connect();
  let acquired = false;

  try {
    const result = await lockClient.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock($1::bigint) AS acquired",
      [ADVISORY_LOCK_ID],
    );
    acquired = result.rows[0]?.acquired === true;
    if (!acquired) {
      return { status: "skipped" as const, reason: "locked_by_other_instance" as const };
    }
    return await work();
  } finally {
    if (acquired) {
      await lockClient
        .query("SELECT pg_advisory_unlock($1::bigint)", [ADVISORY_LOCK_ID])
        .catch((error) => console.error("[notifications] Failed to release advisory lock.", error));
    }
    await lockClient
      .end()
      .catch((error) => console.error("[notifications] Failed to close lock connection.", error));
  }
}

async function projectWorkflowNotifications(input: { since: Date; now: Date; rules: RuleMap }) {
  const [events, auditEvents, admins] = await Promise.all([
    prisma.timesheetEvent.findMany({
      where: { createdAt: { gte: input.since, lte: input.now } },
      orderBy: { createdAt: "asc" },
      take: 1_000,
      include: {
        timesheet: {
          select: {
            id: true,
            periodStart: true,
            contractor: { select: { id: true, email: true, locale: true, displayName: true } },
          },
        },
      },
    }),
    prisma.auditLog.findMany({
      where: {
        createdAt: { gte: input.since, lte: input.now },
        action: { in: ["payslip.uploaded", "payslip.replaced", "time_entry.admin_updated"] },
      },
      orderBy: { createdAt: "asc" },
      take: 1_000,
    }),
    getActiveAdmins(),
  ]);
  let count = 0;

  for (const event of events) {
    const mapping = mapTimesheetEvent(event.eventType);
    if (!mapping) continue;
    const recipients =
      mapping.audience === "admins" ? admins : [toRecipient(event.timesheet.contractor)];
    const rule = input.rules.get(mapping.type);
    if (!rule || (!rule.emailEnabled && !rule.inAppEnabled)) continue;

    for (const recipient of recipients) {
      await enqueueNotification({
        recipient,
        type: mapping.type,
        idempotencyKey: `timesheet-event:${event.id}:${recipient.memberId}`,
        actionUrl:
          mapping.audience === "admins"
            ? `/admin/timesheets/${event.timesheet.id}`
            : `/timesheets?month=${formatDateOnly(event.timesheet.periodStart).slice(0, 7)}`,
        metadata: {
          ...asObject(event.metadata),
          periodStart: formatDateOnly(event.timesheet.periodStart),
          memberName: event.timesheet.contractor.displayName,
          reason: event.reason,
        },
        emailEnabled: rule.emailEnabled,
        inAppEnabled: rule.inAppEnabled,
        createdAt: event.createdAt,
      });
      count += 1;
    }
  }

  for (const event of auditEvents) {
    const data = { ...asObject(event.before), ...asObject(event.after) };
    const type: NotificationType = event.action.startsWith("payslip.")
      ? "PAYSLIP_AVAILABLE"
      : "TIME_ENTRY_ADMIN_MODIFIED";
    const memberId = text(data.employeeMemberId) || text(data.memberId);
    if (!memberId) continue;
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, email: true, locale: true },
    });
    const rule = input.rules.get(type);
    if (!member || !rule || (!rule.emailEnabled && !rule.inAppEnabled)) continue;

    await enqueueNotification({
      recipient: toRecipient(member),
      type,
      idempotencyKey: `audit-event:${event.id}:${member.id}`,
      actionUrl: type === "PAYSLIP_AVAILABLE" ? "/payslips" : "/time",
      metadata: {
        ...data,
        reason: text(data.adminModificationReason),
      },
      emailEnabled: rule.emailEnabled,
      inAppEnabled: rule.inAppEnabled,
      createdAt: event.createdAt,
    });
    count += 1;
  }

  return count;
}

async function projectWeeklyReminders(input: {
  now: Date;
  configuration: Awaited<ReturnType<typeof getNotificationConfiguration>>;
  rules: RuleMap;
}) {
  const rule = input.rules.get("WEEKLY_HOURS_REMINDER");
  if (!rule || (!rule.emailEnabled && !rule.inAppEnabled)) return 0;
  const occurrence = getWeeklyOccurrence({
    now: input.now,
    timezone: input.configuration.companyTimezone,
    weekday: input.configuration.weeklyWeekday,
    time: input.configuration.weeklyTime,
  });
  if (!occurrence) return 0;

  const assignments = await prisma.projectAssignment.findMany({
    where: {
      active: true,
      validFrom: { lte: occurrence.weekEnd },
      OR: [{ validTo: null }, { validTo: { gte: occurrence.weekStart } }],
      member: { status: "ACTIVE", deletedAt: null },
      project: { status: "ACTIVE", deletedAt: null },
    },
    select: {
      memberId: true,
      projectId: true,
      member: { select: { id: true, email: true, locale: true } },
      project: { select: { name: true } },
    },
  });
  if (assignments.length === 0) return 0;

  const [entries, inactiveWeeks] = await Promise.all([
    prisma.timeEntry.findMany({
      where: {
        memberId: { in: unique(assignments.map(({ memberId }) => memberId)) },
        projectId: { in: unique(assignments.map(({ projectId }) => projectId)) },
        localDate: { gte: occurrence.weekStart, lte: occurrence.weekEnd },
        deletedAt: null,
      },
      select: { memberId: true, projectId: true },
    }),
    prisma.inactiveProjectWeek.findMany({
      where: {
        memberId: { in: unique(assignments.map(({ memberId }) => memberId)) },
        projectId: { in: unique(assignments.map(({ projectId }) => projectId)) },
        weekStartDate: occurrence.weekStart,
      },
      select: { memberId: true, projectId: true },
    }),
  ]);
  const covered = new Set([
    ...entries.map(({ memberId, projectId }) => `${memberId}:${projectId}`),
    ...inactiveWeeks.map(({ memberId, projectId }) => `${memberId}:${projectId}`),
  ]);
  const missingByMember = new Map<
    string,
    { recipient: NotificationRecipient; projectNames: string[] }
  >();
  for (const assignment of assignments) {
    if (covered.has(`${assignment.memberId}:${assignment.projectId}`)) continue;
    const current = missingByMember.get(assignment.memberId) ?? {
      recipient: toRecipient(assignment.member),
      projectNames: [],
    };
    current.projectNames.push(assignment.project.name);
    missingByMember.set(assignment.memberId, current);
  }

  for (const { recipient, projectNames } of missingByMember.values()) {
    await enqueueNotification({
      recipient,
      type: "WEEKLY_HOURS_REMINDER",
      idempotencyKey: `${occurrence.key}:${recipient.memberId}`,
      actionUrl: `/time?week=${formatDateOnly(occurrence.weekStart)}`,
      metadata: {
        weekStart: formatDateOnly(occurrence.weekStart),
        weekEnd: formatDateOnly(occurrence.weekEnd),
        projectNames: unique(projectNames),
      },
      emailEnabled: rule.emailEnabled,
      inAppEnabled: rule.inAppEnabled,
      createdAt: input.now,
    });
  }

  return missingByMember.size;
}

/**
 * Every active employee, every month, whatever they recorded: the reminder asks them to check,
 * and an employee with nothing to record is exactly who might have forgotten.
 */
async function projectLeaveReminders(input: {
  now: Date;
  configuration: Awaited<ReturnType<typeof getNotificationConfiguration>>;
  rules: RuleMap;
}) {
  const rule = input.rules.get("LEAVE_MONTH_END_REMINDER");
  if (!rule || (!rule.emailEnabled && !rule.inAppEnabled)) return 0;
  const occurrence = getMonthEndLeaveReminderOccurrence({
    now: input.now,
    timezone: input.configuration.companyTimezone,
    time: LEAVE_REMINDER_TIME,
  });
  if (!occurrence) return 0;

  const employees = await prisma.member.findMany({
    where: { currentProfile: "EMPLOYEE", status: "ACTIVE", deletedAt: null },
    select: { id: true, email: true, locale: true },
  });

  for (const employee of employees) {
    await enqueueNotification({
      recipient: toRecipient(employee),
      type: "LEAVE_MONTH_END_REMINDER",
      idempotencyKey: `${occurrence.key}:${employee.id}`,
      actionUrl: "/leave",
      metadata: { periodStart: `${occurrence.month}-01` },
      emailEnabled: rule.emailEnabled,
      inAppEnabled: rule.inAppEnabled,
      createdAt: input.now,
    });
  }

  return employees.length;
}

/** Fire and forget: a slow or failing holiday API must never hold up notification delivery. */
function refreshHolidaysInBackground(now: Date) {
  if (now.getTime() - lastHolidayRefreshAt < HOLIDAY_REFRESH_INTERVAL_MS) return;
  lastHolidayRefreshAt = now.getTime();
  void refreshStalePublicHolidays({ now }).catch((error: unknown) => {
    console.error("[holidays] Background refresh failed.", error);
  });
}

async function projectInvoiceReminders(input: {
  now: Date;
  configuration: Awaited<ReturnType<typeof getNotificationConfiguration>>;
  rules: RuleMap;
}) {
  const rule = input.rules.get("MONTHLY_INVOICE_REMINDER");
  if (!rule || (!rule.emailEnabled && !rule.inAppEnabled)) return 0;
  const cutoff = new Date(
    input.now.getTime() - input.configuration.invoiceInitialDelayHours * 3_600_000,
  );
  const timesheets = await prisma.timesheet.findMany({
    where: {
      status: "APPROVED",
      approvedAt: { not: null, lte: cutoff },
      contractor: { status: "ACTIVE", deletedAt: null },
    },
    select: {
      id: true,
      periodStart: true,
      approvedAt: true,
      contractor: { select: { id: true, email: true, locale: true } },
    },
  });
  let count = 0;
  for (const timesheet of timesheets) {
    if (!timesheet.approvedAt) continue;
    const occurrence = getInvoiceReminderOccurrence({
      now: input.now,
      approvedAt: timesheet.approvedAt,
      initialDelayHours: input.configuration.invoiceInitialDelayHours,
      repeatIntervalHours: input.configuration.invoiceRepeatIntervalHours,
    });
    if (occurrence === null) continue;
    await enqueueNotification({
      recipient: toRecipient(timesheet.contractor),
      type: "MONTHLY_INVOICE_REMINDER",
      idempotencyKey: `invoice-reminder:${timesheet.id}:${timesheet.approvedAt.toISOString()}:${occurrence}`,
      actionUrl: `/timesheets?month=${formatDateOnly(timesheet.periodStart).slice(0, 7)}`,
      metadata: {
        timesheetId: timesheet.id,
        periodStart: formatDateOnly(timesheet.periodStart),
        approvedAt: timesheet.approvedAt.toISOString(),
        occurrence,
      },
      emailEnabled: rule.emailEnabled,
      inAppEnabled: rule.inAppEnabled,
      createdAt: input.now,
    });
    count += 1;
  }
  return count;
}

function mapTimesheetEvent(
  eventType: string,
): { type: NotificationType; audience: "admins" | "contractor" } | null {
  if (["SUBMITTED", "RESUBMITTED", "CORRECTED_REVISION_SUBMITTED"].includes(eventType)) {
    return { type: "TIMESHEET_SUBMITTED", audience: "admins" };
  }
  if (eventType === "APPROVED") return { type: "TIMESHEET_APPROVED", audience: "contractor" };
  if (eventType === "REJECTED") return { type: "TIMESHEET_REJECTED", audience: "contractor" };
  if (["INVOICE_UPLOADED", "CANCELLATION_INVOICE_UPLOADED"].includes(eventType)) {
    return { type: "INVOICE_UPLOADED", audience: "admins" };
  }
  if (eventType === "INVOICE_REJECTED") return { type: "INVOICE_REJECTED", audience: "contractor" };
  if (eventType === "INVOICE_ACCEPTED") return { type: "INVOICE_ACCEPTED", audience: "contractor" };
  if (eventType === "PAID") return { type: "TIMESHEET_PAID", audience: "contractor" };
  return null;
}

async function getActiveAdmins(): Promise<NotificationRecipient[]> {
  const admins = await prisma.member.findMany({
    where: { role: "ADMIN", status: "ACTIVE", deletedAt: null },
    select: { id: true, email: true, locale: true },
  });
  return admins.map(toRecipient);
}

function toRecipient(member: { id: string; email: string; locale: string }): NotificationRecipient {
  return { memberId: member.id, email: member.email, locale: member.locale };
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}
