import type { NotificationType } from "@/src/server/db/generated/enums";
import { prisma } from "@/src/server/db/client";

export const configurableNotificationTypes = [
  "WEEKLY_HOURS_REMINDER",
  "MONTHLY_INVOICE_REMINDER",
  "TIMESHEET_SUBMITTED",
  "TIMESHEET_APPROVED",
  "TIMESHEET_REJECTED",
  "INVOICE_UPLOADED",
  "INVOICE_REJECTED",
  "INVOICE_ACCEPTED",
  "TIMESHEET_PAID",
  "PAYSLIP_AVAILABLE",
  "TIME_ENTRY_ADMIN_MODIFIED",
  "LEAVE_MONTH_END_REMINDER",
] as const satisfies readonly NotificationType[];

export type ConfigurableNotificationType = (typeof configurableNotificationTypes)[number];

export type NotificationRuleValue = {
  type: ConfigurableNotificationType;
  emailEnabled: boolean;
  inAppEnabled: boolean;
};

export type NotificationConfigurationValue = {
  companyTimezone: string;
  weeklyWeekday: number;
  weeklyTime: string;
  invoiceInitialDelayHours: number;
  invoiceRepeatIntervalHours: number;
  rules: NotificationRuleValue[];
};

export const notificationConfigurationDefaults: NotificationConfigurationValue = {
  companyTimezone: "Europe/Budapest",
  weeklyWeekday: 5,
  weeklyTime: "16:00",
  invoiceInitialDelayHours: 72,
  invoiceRepeatIntervalHours: 24,
  rules: configurableNotificationTypes.map((type) => ({
    type,
    emailEnabled: true,
    inAppEnabled: true,
  })),
};

export class NotificationConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotificationConfigurationError";
  }
}

export async function getNotificationConfiguration(): Promise<NotificationConfigurationValue> {
  const [configuration, storedRules] = await Promise.all([
    prisma.notificationConfiguration.findUnique({ where: { id: "system" } }),
    prisma.notificationRule.findMany({
      where: { type: { in: [...configurableNotificationTypes] } },
    }),
  ]);
  const rulesByType = new Map(storedRules.map((rule) => [rule.type, rule]));

  return {
    companyTimezone:
      configuration?.companyTimezone ?? notificationConfigurationDefaults.companyTimezone,
    weeklyWeekday: configuration?.weeklyWeekday ?? notificationConfigurationDefaults.weeklyWeekday,
    weeklyTime: configuration?.weeklyTime ?? notificationConfigurationDefaults.weeklyTime,
    invoiceInitialDelayHours:
      configuration?.invoiceInitialDelayHours ??
      notificationConfigurationDefaults.invoiceInitialDelayHours,
    invoiceRepeatIntervalHours:
      configuration?.invoiceRepeatIntervalHours ??
      notificationConfigurationDefaults.invoiceRepeatIntervalHours,
    rules: configurableNotificationTypes.map((type) => {
      const stored = rulesByType.get(type);
      return {
        type,
        emailEnabled: stored?.emailEnabled ?? true,
        inAppEnabled: stored?.inAppEnabled ?? true,
      };
    }),
  };
}

export async function updateNotificationConfiguration(input: {
  actorMemberId: string;
  value: NotificationConfigurationValue;
  requestMetadata?: {
    requestId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
}) {
  validateNotificationConfiguration(input.value);

  await prisma.$transaction(async (tx) => {
    const before = await tx.notificationConfiguration.findUnique({ where: { id: "system" } });
    await tx.notificationConfiguration.upsert({
      where: { id: "system" },
      create: {
        id: "system",
        companyTimezone: input.value.companyTimezone,
        weeklyWeekday: input.value.weeklyWeekday,
        weeklyTime: input.value.weeklyTime,
        invoiceInitialDelayHours: input.value.invoiceInitialDelayHours,
        invoiceRepeatIntervalHours: input.value.invoiceRepeatIntervalHours,
        updatedByMemberId: input.actorMemberId,
      },
      update: {
        companyTimezone: input.value.companyTimezone,
        weeklyWeekday: input.value.weeklyWeekday,
        weeklyTime: input.value.weeklyTime,
        invoiceInitialDelayHours: input.value.invoiceInitialDelayHours,
        invoiceRepeatIntervalHours: input.value.invoiceRepeatIntervalHours,
        updatedByMemberId: input.actorMemberId,
      },
    });

    for (const rule of input.value.rules) {
      await tx.notificationRule.upsert({
        where: { type: rule.type },
        create: { ...rule, updatedByMemberId: input.actorMemberId },
        update: {
          emailEnabled: rule.emailEnabled,
          inAppEnabled: rule.inAppEnabled,
          updatedByMemberId: input.actorMemberId,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "notification.settings_updated",
        targetType: "notification_configuration",
        targetId: "system",
        before: before
          ? {
              companyTimezone: before.companyTimezone,
              weeklyWeekday: before.weeklyWeekday,
              weeklyTime: before.weeklyTime,
              invoiceInitialDelayHours: before.invoiceInitialDelayHours,
              invoiceRepeatIntervalHours: before.invoiceRepeatIntervalHours,
            }
          : undefined,
        after: input.value,
        requestId: input.requestMetadata?.requestId,
        ipAddress: input.requestMetadata?.ipAddress,
        userAgent: input.requestMetadata?.userAgent,
      },
    });
  });
}

export function validateNotificationConfiguration(value: NotificationConfigurationValue) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value.companyTimezone }).format();
  } catch {
    throw new NotificationConfigurationError("Choose a valid company timezone.");
  }

  if (
    !Number.isInteger(value.weeklyWeekday) ||
    value.weeklyWeekday < 1 ||
    value.weeklyWeekday > 7
  ) {
    throw new NotificationConfigurationError("Choose a valid weekly reminder day.");
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.weeklyTime)) {
    throw new NotificationConfigurationError("Choose a valid weekly reminder time.");
  }
  if (
    !Number.isInteger(value.invoiceInitialDelayHours) ||
    value.invoiceInitialDelayHours < 1 ||
    value.invoiceInitialDelayHours > 24 * 90
  ) {
    throw new NotificationConfigurationError(
      "Invoice reminder delay must be between 1 hour and 90 days.",
    );
  }
  if (
    !Number.isInteger(value.invoiceRepeatIntervalHours) ||
    value.invoiceRepeatIntervalHours < 1 ||
    value.invoiceRepeatIntervalHours > 24 * 30
  ) {
    throw new NotificationConfigurationError(
      "Invoice reminder interval must be between 1 hour and 30 days.",
    );
  }

  const rules = new Map(value.rules.map((rule) => [rule.type, rule]));
  if (rules.size !== configurableNotificationTypes.length) {
    throw new NotificationConfigurationError("Every notification rule must be configured once.");
  }
  for (const type of configurableNotificationTypes) {
    if (!rules.has(type)) {
      throw new NotificationConfigurationError("Every notification rule must be configured once.");
    }
  }
}
