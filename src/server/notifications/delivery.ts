import type { AppLocale } from "@/src/i18n/locales";
import { resolveLocale } from "@/src/i18n/locales";
import type { NotificationType } from "@/src/server/db/generated/enums";
import type { Prisma } from "@/src/server/db/generated/client";
import { prisma } from "@/src/server/db/client";
import { getEmailDeliveryMode, mailer } from "@/src/server/email/mailer";
import { buildNotificationContent, type NotificationMetadata } from "./content";

const READ_NOTIFICATION_RETENTION = 15;
const MAX_DELIVERY_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [5 * 60_000, 30 * 60_000, 2 * 3_600_000, 12 * 3_600_000, 24 * 3_600_000];

export type NotificationRecipient = {
  memberId: string;
  email: string;
  locale: string;
};

export async function enqueueNotification(input: {
  recipient: NotificationRecipient;
  type: NotificationType;
  idempotencyKey: string;
  metadata: NotificationMetadata;
  actionUrl?: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  createdAt?: Date;
}) {
  const createdAt = input.createdAt ?? new Date();

  await prisma.$transaction(async (tx) => {
    if (input.inAppEnabled) {
      await tx.notification.upsert({
        where: { idempotencyKey: `in-app:${input.idempotencyKey}` },
        create: {
          memberId: input.recipient.memberId,
          type: input.type,
          idempotencyKey: `in-app:${input.idempotencyKey}`,
          actionUrl: input.actionUrl,
          metadata: input.metadata as Prisma.InputJsonValue,
          createdAt,
        },
        update: {},
      });

      const retained = await tx.notification.findMany({
        where: { memberId: input.recipient.memberId, readAt: { not: null } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: READ_NOTIFICATION_RETENTION,
        select: { id: true },
      });
      if (retained.length > 0) {
        await tx.notification.deleteMany({ where: { id: { in: retained.map(({ id }) => id) } } });
      }
    }

    if (input.emailEnabled) {
      await tx.notificationDelivery.upsert({
        where: { idempotencyKey: `email:${input.idempotencyKey}` },
        create: {
          memberId: input.recipient.memberId,
          email: input.recipient.email,
          type: input.type,
          idempotencyKey: `email:${input.idempotencyKey}`,
          metadata: {
            ...input.metadata,
            actionUrl: input.actionUrl ?? null,
            locale: resolveNotificationLocale(input.recipient.locale),
          },
          createdAt,
          nextAttemptAt: createdAt,
        },
        update: {},
      });
    }
  });
}

export async function processQueuedNotificationEmails(input: { now?: Date; limit?: number } = {}) {
  const now = input.now ?? new Date();
  const deliveries = await prisma.notificationDelivery.findMany({
    where: {
      status: { in: ["QUEUED", "FAILED"] },
      attemptCount: { lt: MAX_DELIVERY_ATTEMPTS },
      nextAttemptAt: { lte: now },
    },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
    take: input.limit ?? 100,
    include: { member: { select: { locale: true } } },
  });

  let sent = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    const metadata = asMetadata(delivery.metadata);
    const locale = resolveNotificationLocale(delivery.member?.locale ?? metadata.locale);
    const content = buildNotificationContent(delivery.type, locale, metadata);
    const actionUrl = resolveActionUrl(metadata.actionUrl);

    try {
      await mailer.send({
        to: delivery.email,
        subject: content.emailSubject,
        text: `${content.body}${actionUrl ? `\n\n${actionUrl}` : ""}`,
        html: `<p>${escapeHtml(content.body)}</p>${actionUrl ? `<p><a href="${escapeHtml(actionUrl)}">${locale === "hu" ? "Megnyitás" : "Open Sheet Happens"}</a></p>` : ""}`,
      });
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "SENT",
          attemptCount: { increment: 1 },
          lastAttemptAt: now,
          sentAt: now,
          provider: getEmailDeliveryMode(),
          error: null,
        },
      });
      sent += 1;
    } catch (error) {
      const nextAttempt = delivery.attemptCount + 1;
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "FAILED",
          attemptCount: nextAttempt,
          lastAttemptAt: now,
          nextAttemptAt: new Date(
            now.getTime() + (RETRY_DELAYS_MS[nextAttempt - 1] ?? 24 * 3_600_000),
          ),
          provider: getEmailDeliveryMode(),
          error:
            error instanceof Error ? error.message.slice(0, 2_000) : "Unknown email delivery error",
        },
      });
      failed += 1;
    }
  }

  return { processed: deliveries.length, sent, failed };
}

function resolveNotificationLocale(value: unknown): AppLocale {
  return resolveLocale(value) ?? "hu";
}

function resolveActionUrl(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL;
  return baseUrl ? new URL(value, baseUrl).toString() : value;
}

function asMetadata(value: unknown): NotificationMetadata {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as NotificationMetadata)
    : {};
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
