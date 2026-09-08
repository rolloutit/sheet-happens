"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireAdminAppMemberForAction } from "@/src/server/auth/app-access";
import { AuthenticationError, AuthorizationError } from "@/src/server/auth/session";
import {
  DeclarationError,
  parseDateOnly,
  saveMonthlyHourDeclaration,
  TimeTrackingDateError,
  type TimeTrackingRequestMetadata,
} from "@/src/server/time-tracking";
import type {
  CorrectDeclaredHoursActionInput,
  CorrectDeclaredHoursActionState,
  CorrectDeclaredHoursField,
} from "./actions.types";

type AdminDeclaredHoursTranslator = Awaited<ReturnType<typeof getTranslations>>;

/**
 * The bounds mirror `app/time/actions.ts` exactly, because both call the same domain function and a
 * figure an admin may enter must not differ from one the member may. The *plausible* bound is the
 * warning in `declarations.ts`; this is only the outer edge of what the column can hold.
 */
function createCorrectDeclaredHoursSchema(t: AdminDeclaredHoursTranslator) {
  return z.object({
    memberId: z.string().uuid(t("validation.member")),
    projectId: z.string().uuid(t("validation.project")),
    periodStart: z.string().regex(/^\d{4}-\d{2}-01$/, t("validation.month")),
    minutes: z
      .number()
      .int()
      .positive(t("validation.minutesPositive"))
      .max(366 * 24 * 60, t("validation.minutesTooLarge")),
    note: z
      .string()
      .trim()
      .min(1, t("validation.noteRequired"))
      .max(1_000, t("validation.noteTooLong")),
    reason: z
      .string()
      .trim()
      .min(1, t("validation.reasonRequired"))
      .max(1_000, t("validation.reasonTooLong")),
  });
}

/**
 * Enter or correct one month's declared figure on a member's behalf.
 *
 * This is the admin half of §17 decision 7, and the reason it needs its own action rather than a
 * flag on the member's: `saveMonthlyHourDeclaration` derives "this is an admin correction" from
 * `actorMemberId !== memberId`, so the member-facing action deliberately passes the signed-in
 * member as both and *cannot* produce a write against someone else. Here the member is named by
 * the request, so admin rights are checked first and the reason is mandatory.
 *
 * The correction records `adminModified*` on both the declaration and its materialized entry, and
 * writes the audit row the notification dispatcher reads as `TIME_ENTRY_ADMIN_MODIFIED` — so the
 * member is told, in the same shape they are told about any other admin edit to their time.
 */
export async function correctDeclaredHoursAction(
  input: CorrectDeclaredHoursActionInput,
): Promise<CorrectDeclaredHoursActionState> {
  const t = await getTranslations("AdminDeclaredHoursActions");
  const parsed = createCorrectDeclaredHoursSchema(t).safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.fixFields"),
      fieldErrors: getFieldErrors(parsed.error),
    };
  }

  try {
    const { member: admin } = await requireAdminAppMemberForAction();

    /*
     * An admin's own declared hours are corrected at their own `/time`, not here.
     *
     * Letting it through would not be harmless: the domain reads `byAdmin` from the two ids
     * differing, so a self-save would silently discard the reason that was just typed and write no
     * `adminModified*` fields — a correction that looks recorded and is not.
     */
    if (parsed.data.memberId === admin.id) {
      return {
        status: "error",
        message: t("errors.ownDeclaration"),
      };
    }

    await saveMonthlyHourDeclaration({
      memberId: parsed.data.memberId,
      actorMemberId: admin.id,
      projectId: parsed.data.projectId,
      periodStart: parseDateOnly(parsed.data.periodStart, t("validation.month")),
      minutes: parsed.data.minutes,
      note: parsed.data.note,
      adminModificationReason: parsed.data.reason,
      requestMetadata: await getDeclaredHoursRequestMetadata(),
    });

    revalidatePath("/admin/declared-hours");
    // The member's own month level reads the same declaration, so it must not serve a stale figure.
    revalidatePath("/time");

    return {
      status: "success",
      message: t("success.corrected"),
    };
  } catch (error) {
    /* Keyed on the code rather than the message: these codes are shared with the member-facing
       path, and the wording an admin needs differs from the one a member needs. */
    if (error instanceof DeclarationError) {
      return {
        status: "error",
        message: t(`declarationErrors.${error.code}`),
      };
    }

    if (error instanceof TimeTrackingDateError) {
      return {
        status: "error",
        message: t("validation.month"),
      };
    }

    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return {
        status: "error",
        message: error.message,
      };
    }

    return {
      status: "error",
      message: t("errors.correctFailed"),
    };
  }
}

async function getDeclaredHoursRequestMetadata(): Promise<TimeTrackingRequestMetadata> {
  const requestHeaders = await headers();

  return {
    ipAddress: requestHeaders.get("x-forwarded-for"),
    userAgent: requestHeaders.get("user-agent"),
    channel: "WEB",
  };
}

function getFieldErrors(error: z.ZodError): CorrectDeclaredHoursActionState["fieldErrors"] {
  const fieldErrors: Partial<Record<CorrectDeclaredHoursField, string>> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (field === "minutes" || field === "note" || field === "reason") {
      fieldErrors[field] ??= issue.message;
    }
  }

  return fieldErrors;
}
