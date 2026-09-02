import { prisma } from "@/src/server/db/client";
import { addDays, formatDateOnly, parseDateOnly } from "@/src/server/time-tracking/dates";
import { getNotificationConfiguration } from "./configuration";
import { enqueueNotification } from "./delivery";

export type ManualReminderErrorCode = "member_unavailable" | "not_flagged" | "delivery_disabled";

export class ManualReminderError extends Error {
  constructor(readonly code: ManualReminderErrorCode) {
    super(code);
    this.name = "ManualReminderError";
  }
}

export async function sendManualWeeklyReminder(input: {
  actorMemberId: string;
  memberId: string;
  weekStart: string;
  requestMetadata?: {
    requestId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
}) {
  const weekStart = parseDateOnly(input.weekStart);
  const weekEnd = addDays(weekStart, 6);
  const configuration = await getNotificationConfiguration();
  const rule = configuration.rules.find(({ type }) => type === "WEEKLY_HOURS_REMINDER");

  if (!rule || (!rule.emailEnabled && !rule.inAppEnabled)) {
    throw new ManualReminderError("delivery_disabled");
  }

  const member = await prisma.member.findFirst({
    where: { id: input.memberId, status: "ACTIVE", deletedAt: null },
    select: { id: true, email: true, locale: true },
  });
  if (!member) throw new ManualReminderError("member_unavailable");

  const assignments = await prisma.projectAssignment.findMany({
    where: {
      memberId: member.id,
      active: true,
      validFrom: { lte: weekEnd },
      OR: [{ validTo: null }, { validTo: { gte: weekStart } }],
      project: { status: "ACTIVE", deletedAt: null },
    },
    select: { projectId: true, project: { select: { name: true } } },
  });
  if (assignments.length === 0) throw new ManualReminderError("not_flagged");

  const projectIds = assignments.map(({ projectId }) => projectId);
  const [entries, inactiveWeeks] = await Promise.all([
    prisma.timeEntry.findMany({
      where: {
        memberId: member.id,
        projectId: { in: projectIds },
        localDate: { gte: weekStart, lte: weekEnd },
        deletedAt: null,
      },
      select: { projectId: true },
    }),
    prisma.inactiveProjectWeek.findMany({
      where: {
        memberId: member.id,
        projectId: { in: projectIds },
        weekStartDate: weekStart,
      },
      select: { projectId: true },
    }),
  ]);
  const coveredProjects = new Set([
    ...entries.map(({ projectId }) => projectId),
    ...inactiveWeeks.map(({ projectId }) => projectId),
  ]);
  const projectNames = assignments
    .filter(({ projectId }) => !coveredProjects.has(projectId))
    .map(({ project }) => project.name);
  if (projectNames.length === 0) throw new ManualReminderError("not_flagged");

  const audit = await prisma.auditLog.create({
    data: {
      actorMemberId: input.actorMemberId,
      action: "notification.weekly_reminder_sent",
      targetType: "member",
      targetId: member.id,
      after: {
        weekStart: formatDateOnly(weekStart),
        weekEnd: formatDateOnly(weekEnd),
        projectNames,
        emailEnabled: rule.emailEnabled,
        inAppEnabled: rule.inAppEnabled,
      },
      requestId: input.requestMetadata?.requestId,
      ipAddress: input.requestMetadata?.ipAddress,
      userAgent: input.requestMetadata?.userAgent,
    },
    select: { id: true },
  });

  await enqueueNotification({
    recipient: { memberId: member.id, email: member.email, locale: member.locale },
    type: "WEEKLY_HOURS_REMINDER",
    idempotencyKey: `manual-weekly-reminder:${audit.id}`,
    actionUrl: `/time?week=${formatDateOnly(weekStart)}`,
    metadata: {
      weekStart: formatDateOnly(weekStart),
      weekEnd: formatDateOnly(weekEnd),
      projectNames,
    },
    emailEnabled: rule.emailEnabled,
    inAppEnabled: rule.inAppEnabled,
  });

  return { projectCount: projectNames.length };
}
