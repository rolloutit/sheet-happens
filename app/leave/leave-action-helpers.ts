import { headers } from "next/headers";
import type { getTranslations } from "next-intl/server";
import { z } from "zod";

import { AuthenticationError, AuthorizationError } from "@/src/server/auth/session";
import { LEAVE_NOTE_MAX_LENGTH, LeaveError, type LeaveErrorCode } from "@/src/server/leave";
import { ObjectStorageConfigurationError } from "@/src/server/storage";
import type { LeaveActionState, LeaveFormField } from "./action-state";

type Translate = Awaited<ReturnType<typeof getTranslations>>;

const dateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const leaveFormSchema = z
  .object({
    type: z.enum(["VACATION", "SICK"]),
    startDate: dateValue,
    endDate: dateValue,
    dayPart: z.enum(["FULL", "MORNING", "AFTERNOON"]).default("FULL"),
    note: z
      .string()
      .trim()
      .max(LEAVE_NOTE_MAX_LENGTH)
      .transform((value) => value || null),
  })
  .transform((value) =>
    // A cleared half-day choice on a multi-day range is not an error the user made.
    value.startDate === value.endDate ? value : { ...value, dayPart: "FULL" as const },
  );

export function readLeaveForm(formData: FormData) {
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : undefined;
  };

  return leaveFormSchema.safeParse({
    type: text("type"),
    startDate: text("startDate"),
    endDate: text("endDate") || text("startDate"),
    dayPart: text("dayPart") || undefined,
    note: text("note") ?? "",
  });
}

export function leaveFormFieldErrors(
  issues: z.core.$ZodIssue[],
  t: Translate,
): LeaveActionState["fieldErrors"] {
  const fieldErrors: Partial<Record<LeaveFormField, string>> = {};

  for (const issue of issues) {
    const field = issue.path[0];
    if (field === "type") fieldErrors.type = t("errors.typeRequired");
    if (field === "startDate" || field === "endDate")
      fieldErrors.startDate = t("errors.datesRequired");
    if (field === "note") fieldErrors.note = t("errors.noteTooLong");
  }

  return fieldErrors;
}

/** The uploaded file, or `null` when the input was left empty (browsers still send a 0-byte part). */
export async function readLeaveFile(formData: FormData, key = "file") {
  const file = formData.get(key);
  if (!(file instanceof File) || file.size <= 0) return null;

  return {
    bytes: Buffer.from(await file.arrayBuffer()),
    originalFilename: file.name || "sick-note",
    contentType: file.type,
    byteSize: file.size,
  };
}

export async function getLeaveRequestMetadata() {
  const requestHeaders = await headers();

  return {
    ipAddress: requestHeaders.get("x-forwarded-for"),
    userAgent: requestHeaders.get("user-agent"),
  };
}

const errorKeys: Record<LeaveErrorCode, { key: string; field?: LeaveFormField }> = {
  INVALID_RANGE: { key: "errors.invalidRange", field: "startDate" },
  HALF_DAY_RANGE: { key: "errors.halfDayRange", field: "dayPart" },
  NO_WORKDAYS: { key: "errors.noWorkdays", field: "startDate" },
  BEFORE_CURRENT_MONTH: { key: "errors.beforeCurrentMonth", field: "startDate" },
  TOO_LONG: { key: "errors.tooLong", field: "startDate" },
  OVERLAP: { key: "errors.overlap", field: "startDate" },
  TIME_ENTRIES_ON_DAYS: { key: "errors.timeEntriesOnDays", field: "startDate" },
  EMPLOYEE_REQUIRED: { key: "errors.employeeRequired" },
  NOT_FOUND: { key: "errors.notFound" },
  ATTACHMENT_SICK_ONLY: { key: "errors.attachmentSickOnly", field: "file" },
  ATTACHMENT_REQUIRED: { key: "errors.attachmentRequired", field: "file" },
  ATTACHMENT_TOO_LARGE: { key: "errors.attachmentTooLarge", field: "file" },
  ATTACHMENT_TYPE: { key: "errors.attachmentType", field: "file" },
  SICK_NOTE_ATTACHED: { key: "errors.sickNoteAttached", field: "type" },
};

export function leaveErrorState(error: unknown, t: Translate, scope: string): LeaveActionState {
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
    return { status: "error", message: t("errors.notAllowed") };
  }

  if (error instanceof ObjectStorageConfigurationError) {
    return { status: "error", message: t("errors.storageMissing") };
  }

  if (error instanceof LeaveError) {
    const { key, field } = errorKeys[error.code];
    const message = t(key);
    return { status: "error", message, ...(field ? { fieldErrors: { [field]: message } } : {}) };
  }

  console.error(`[leave] ${scope} failed`, error);
  return { status: "error", message: t("errors.saveFailed") };
}
