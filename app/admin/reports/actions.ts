"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireAdminAppMemberForAction } from "@/src/server/auth/app-access";
import { AuthenticationError, AuthorizationError } from "@/src/server/auth/session";
import { ReportLinePersistenceError, saveAdminReportLineEdits } from "@/src/server/reports";

export type SaveReportLineEditsActionState =
  { status: "success"; message: string; savedCount: number } | { status: "error"; message: string };

const lineEditSchema = z.object({
  id: z.string().uuid(),
  description: z.string().max(1_000).optional(),
  durationMinutes: z
    .number()
    .int()
    .min(1)
    .max(24 * 60)
    .optional(),
});

const saveSchema = z.object({
  edits: z.array(lineEditSchema).min(1).max(1_000),
  reason: z.string().trim().min(1).max(500),
});

export async function saveReportLineEditsAction(input: {
  edits: unknown;
  reason: unknown;
}): Promise<SaveReportLineEditsActionState> {
  const t = await getTranslations("AdminReports.persistence");
  const parsed = saveSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: t("errors.invalid") };
  }

  try {
    const { member: admin } = await requireAdminAppMemberForAction();
    const requestHeaders = await headers();
    const forwardedFor = requestHeaders.get("x-forwarded-for");
    const result = await saveAdminReportLineEdits({
      actorMemberId: admin.id,
      edits: parsed.data.edits,
      reason: parsed.data.reason,
      requestMetadata: {
        requestId: requestHeaders.get("x-request-id"),
        ipAddress: forwardedFor?.split(",")[0]?.trim() || null,
        userAgent: requestHeaders.get("user-agent"),
      },
    });

    revalidatePath("/admin/reports");
    revalidatePath("/time");

    return {
      status: "success",
      message: t("success", { count: result.savedCount }),
      savedCount: result.savedCount,
    };
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return { status: "error", message: error.message };
    }

    if (error instanceof ReportLinePersistenceError) {
      return { status: "error", message: t(`errors.${error.code}`) };
    }

    return { status: "error", message: t("errors.generic") };
  }
}
