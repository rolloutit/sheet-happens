"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { requireAdminAppMemberForAction } from "@/src/server/auth/app-access";
import { AuthenticationError, AuthorizationError } from "@/src/server/auth/session";
import {
  ManualReminderError,
  sendManualWeeklyReminder,
} from "@/src/server/notifications/manual-reminder";

export type ReminderActionState = { status: "idle" | "success" | "error"; message: string };

export async function sendFlaggedMemberReminderAction(
  _state: ReminderActionState,
  formData: FormData,
): Promise<ReminderActionState> {
  const t = await getTranslations("Dashboard.admin.flagged");

  try {
    const { member } = await requireAdminAppMemberForAction();
    const requestHeaders = await headers();
    await sendManualWeeklyReminder({
      actorMemberId: member.id,
      memberId: String(formData.get("memberId") ?? ""),
      weekStart: String(formData.get("weekStart") ?? ""),
      requestMetadata: {
        requestId: requestHeaders.get("x-request-id"),
        ipAddress:
          requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          requestHeaders.get("x-real-ip"),
        userAgent: requestHeaders.get("user-agent"),
      },
    });
    revalidatePath("/dashboard");
    return { status: "success", message: t("reminderSent") };
  } catch (error) {
    if (error instanceof ManualReminderError) {
      return { status: "error", message: t(`reminderErrors.${error.code}`) };
    }
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return { status: "error", message: t("reminderErrors.unauthorized") };
    }
    return { status: "error", message: t("reminderErrors.failed") };
  }
}
