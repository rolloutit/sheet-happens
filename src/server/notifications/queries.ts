import type { AppLocale } from "@/src/i18n/locales";
import { prisma } from "@/src/server/db/client";
import { buildNotificationContent, type NotificationMetadata } from "./content";

export type MemberNotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  read: boolean;
  createdAt: string;
};

export async function getMemberNotificationSummary(input: {
  memberId: string;
  locale: AppLocale;
  limit?: number;
}) {
  const [records, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { memberId: input.memberId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit ?? 5,
    }),
    prisma.notification.count({ where: { memberId: input.memberId, readAt: null } }),
  ]);

  return {
    notifications: records.map((record) => mapNotification(record, input.locale)),
    unreadCount,
  };
}

export async function getMemberNotifications(input: {
  memberId: string;
  locale: AppLocale;
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
}) {
  const pageSize = Math.min(50, Math.max(5, input.pageSize ?? 20));
  const where = {
    memberId: input.memberId,
    ...(input.unreadOnly ? { readAt: null } : {}),
  };
  const totalItems = await prisma.notification.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(totalPages, Math.max(1, input.page ?? 1));
  const records = await prisma.notification.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    rows: records.map((record) => mapNotification(record, input.locale)),
    page,
    pageSize,
    totalItems,
    totalPages,
  };
}

export async function markNotificationRead(
  memberId: string,
  notificationId: string,
  now = new Date(),
) {
  await prisma.notification.updateMany({
    where: { id: notificationId, memberId, readAt: null },
    data: { readAt: now },
  });
}

export async function markAllNotificationsRead(memberId: string, now = new Date()) {
  const result = await prisma.notification.updateMany({
    where: { memberId, readAt: null },
    data: { readAt: now },
  });
  return result.count;
}

function mapNotification(
  record: {
    id: string;
    type: Parameters<typeof buildNotificationContent>[0];
    metadata: unknown;
    actionUrl: string | null;
    readAt: Date | null;
    createdAt: Date;
  },
  locale: AppLocale,
): MemberNotificationRow {
  const content = buildNotificationContent(record.type, locale, asMetadata(record.metadata));
  return {
    id: record.id,
    type: record.type,
    title: content.title,
    body: content.body,
    actionUrl: record.actionUrl,
    read: Boolean(record.readAt),
    createdAt: record.createdAt.toISOString(),
  };
}

function asMetadata(value: unknown): NotificationMetadata {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as NotificationMetadata)
    : {};
}
