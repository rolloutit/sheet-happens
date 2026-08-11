"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { isDateValue } from "@/src/lib/date-values";

import { DAILY_HARD_LIMIT_MINUTES } from "@/src/lib/time-entry-limits";
import { requireActiveAppMemberForAction } from "@/src/server/auth/app-access";
import { AuthenticationError, AuthorizationError } from "@/src/server/auth/session";
import {
  copyPreviousDayEntries,
  createTimeEntry,
  deleteTimeEntry,
  deleteTimeEntryDraft,
  duplicatePreviousWeek,
  markInactiveProjectWeek,
  parseDateOnly,
  saveTimeEntryDraft,
  startRunningTimer,
  stopRunningTimer,
  TimeTrackingDateError,
  TimeTrackingError,
  unmarkInactiveProjectWeek,
  updateTimeEntry,
  type CopyTimeEntriesResult,
  type TimeTrackingRequestMetadata,
} from "@/src/server/time-tracking";

import type {
  ClearTimeEntryDraftActionInput,
  CopyPreviousDayEntriesActionInput,
  CreateTimeEntryActionInput,
  DeleteTimeEntryActionInput,
  DuplicatePreviousWeekActionInput,
  InactiveProjectWeekActionInput,
  SaveTimeEntryDraftActionInput,
  StartRunningTimerActionInput,
  TimeEntryFormField,
  TimeTrackingActionState,
  UpdateTimeEntryActionInput,
} from "./actions.types";

type TimeTrackingActionsTranslator = Awaited<ReturnType<typeof getTranslations>>;

const timingSchema = {
  timingMode: z.enum(["DURATION", "INTERVAL"]).optional(),
  durationMinutes: z
    .number()
    .int()
    .positive("Duration must be greater than zero.")
    .max(DAILY_HARD_LIMIT_MINUTES, "Daily total cannot exceed 24 hours.")
    .optional(),
  startTime: z
    .string()
    .trim()
    .refine(isTimeInputValue, "Choose a valid start time.")
    .nullable()
    .optional(),
  endTime: z
    .string()
    .trim()
    .refine(isTimeInputValue, "Choose a valid end time.")
    .nullable()
    .optional(),
};

const createTimeEntrySchema = z
  .object({
    projectId: z.string().trim().min(1, "Choose a project."),
    localDate: z.string().trim().refine(isDateInputValue, "Choose a valid date."),
    description: z
      .string()
      .trim()
      .min(1, "Description is required.")
      .max(1000, "Description must be 1000 characters or less."),
    source: z.enum(["GRID", "FORM"]).optional(),
    ...timingSchema,
  })
  .superRefine((value, context) => validateTimeEntryTiming(value, context, true));

const updateTimeEntrySchema = z
  .object({
    timeEntryId: z.string().trim().min(1, "Time entry id is missing."),
    projectId: z.string().trim().min(1, "Choose a project.").optional(),
    localDate: z.string().trim().refine(isDateInputValue, "Choose a valid date.").optional(),
    description: z
      .string()
      .trim()
      .min(1, "Description is required.")
      .max(1000, "Description must be 1000 characters or less.")
      .optional(),
    ...timingSchema,
  })
  .superRefine((value, context) => validateTimeEntryTiming(value, context, false));

const deleteTimeEntrySchema = z.object({
  timeEntryId: z.string().trim().min(1, "Time entry id is missing."),
});

const inactiveWeekSchema = z.object({
  projectId: z.string().trim().min(1, "Choose a project."),
  weekStartDate: z.string().trim().refine(isDateInputValue, "Choose a valid week."),
  note: z.string().trim().max(500, "Note must be 500 characters or less.").optional(),
});

const startRunningTimerSchema = z.object({
  projectId: z.string().trim().min(1, "Choose a project."),
  description: z
    .string()
    .trim()
    .min(1, "Description is required.")
    .max(1000, "Description must be 1000 characters or less."),
});

const copyPreviousDayEntriesSchema = z.object({
  targetDate: z.string().trim().refine(isDateInputValue, "Choose a valid target date."),
});

const duplicatePreviousWeekSchema = z.object({
  weekStartDate: z.string().trim().refine(isDateInputValue, "Choose a valid week."),
});

const timeEntryDraftPayloadSchema = z.object({
  kind: z.literal("time-entry-form"),
  version: z.literal(1),
  source: z.enum(["GRID", "FORM"]),
  projectId: z.string().trim().min(1, "Choose a project."),
  localDate: z.string().trim().refine(isDateInputValue, "Choose a valid date."),
  timingMode: z.enum(["DURATION", "INTERVAL"]),
  durationText: z.string().trim().max(64, "Duration is too long."),
  startTime: z.string().trim().refine(isTimeInputValue, "Choose a valid start time."),
  endTime: z.string().trim().refine(isTimeInputValue, "Choose a valid end time."),
  description: z.string().trim().max(1000, "Description must be 1000 characters or less."),
  prefill: z.boolean().optional(),
});

const timeEntryDraftSchema = z.object({
  draftKey: z.string().trim().min(1).max(80),
  payload: timeEntryDraftPayloadSchema,
});

const clearTimeEntryDraftSchema = z.object({
  draftKey: z.string().trim().min(1).max(80),
});

export async function createTimeEntryAction(
  input: CreateTimeEntryActionInput,
): Promise<TimeTrackingActionState> {
  const t = await getTranslations("TimeTrackingActions");
  const parsed = createTimeEntrySchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.fixFields"),
      fieldErrors: translateEntryFieldErrors(getEntryFieldErrors(parsed.error), t),
    };
  }

  try {
    const { member } = await requireActiveAppMemberForAction();
    await createTimeEntry({
      ...parsed.data,
      localDate: parseDateOnly(parsed.data.localDate),
      memberId: member.id,
      actorMemberId: member.id,
      requestMetadata: await getTimeTrackingRequestMetadata(),
    });

    revalidatePath("/time");

    return {
      status: "success",
      message: t("success.timeEntrySaved"),
    };
  } catch (error) {
    return mapTimeTrackingActionError(error, t("errors.timeEntrySaveFailed"), t);
  }
}

export async function updateTimeEntryAction(
  input: UpdateTimeEntryActionInput,
): Promise<TimeTrackingActionState> {
  const t = await getTranslations("TimeTrackingActions");
  const parsed = updateTimeEntrySchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.fixFields"),
      fieldErrors: translateEntryFieldErrors(getEntryFieldErrors(parsed.error), t),
    };
  }

  try {
    const { member } = await requireActiveAppMemberForAction();
    await updateTimeEntry({
      ...parsed.data,
      localDate: parsed.data.localDate ? parseDateOnly(parsed.data.localDate) : undefined,
      memberId: member.id,
      actorMemberId: member.id,
      requestMetadata: await getTimeTrackingRequestMetadata(),
    });

    revalidatePath("/time");

    return {
      status: "success",
      message: t("success.timeEntryUpdated"),
    };
  } catch (error) {
    return mapTimeTrackingActionError(error, t("errors.timeEntryUpdateFailed"), t);
  }
}

export async function deleteTimeEntryAction(
  input: DeleteTimeEntryActionInput,
): Promise<TimeTrackingActionState> {
  const t = await getTranslations("TimeTrackingActions");
  const parsed = deleteTimeEntrySchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.timeEntryDeleteFailed"),
    };
  }

  try {
    const { member } = await requireActiveAppMemberForAction();
    await deleteTimeEntry({
      timeEntryId: parsed.data.timeEntryId,
      memberId: member.id,
      actorMemberId: member.id,
      requestMetadata: await getTimeTrackingRequestMetadata(),
    });

    revalidatePath("/time");

    return {
      status: "success",
      message: t("success.timeEntryDeleted"),
    };
  } catch (error) {
    return mapTimeTrackingActionError(error, t("errors.timeEntryDeleteFailed"), t);
  }
}

export async function startRunningTimerAction(
  input: StartRunningTimerActionInput,
): Promise<TimeTrackingActionState> {
  const t = await getTranslations("TimeTrackingActions");
  const parsed = startRunningTimerSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.fixFields"),
      fieldErrors: translateEntryFieldErrors(getEntryFieldErrors(parsed.error), t),
    };
  }

  try {
    const { member } = await requireActiveAppMemberForAction();
    await startRunningTimer({
      ...parsed.data,
      memberId: member.id,
      actorMemberId: member.id,
      requestMetadata: await getTimeTrackingRequestMetadata(),
    });

    revalidatePath("/time");

    return {
      status: "success",
      message: t("success.timerStarted"),
    };
  } catch (error) {
    return mapTimeTrackingActionError(error, t("errors.timerStartFailed"), t);
  }
}

export async function stopRunningTimerAction(): Promise<TimeTrackingActionState> {
  const t = await getTranslations("TimeTrackingActions");

  try {
    const { member } = await requireActiveAppMemberForAction();
    const result = await stopRunningTimer({
      memberId: member.id,
      actorMemberId: member.id,
      requestMetadata: await getTimeTrackingRequestMetadata(),
    });

    revalidatePath("/time");

    if ("discarded" in result) {
      return {
        status: "error",
        message: t("errors.timerDiscardedDailyLimit"),
      };
    }

    return {
      status: "success",
      message: t("success.timerStopped"),
    };
  } catch (error) {
    return mapTimeTrackingActionError(error, t("errors.timerStopFailed"), t);
  }
}

export async function copyPreviousDayEntriesAction(
  input: CopyPreviousDayEntriesActionInput,
): Promise<TimeTrackingActionState> {
  const t = await getTranslations("TimeTrackingActions");
  const parsed = copyPreviousDayEntriesSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("fields.validTargetDate"),
    };
  }

  try {
    const { member } = await requireActiveAppMemberForAction();
    const result = await copyPreviousDayEntries({
      targetDate: parseDateOnly(parsed.data.targetDate),
      memberId: member.id,
      actorMemberId: member.id,
      requestMetadata: await getTimeTrackingRequestMetadata(),
    });

    revalidatePath("/time");

    return {
      status: "success",
      message: formatCopyResultMessage(result, "previousDay", t),
    };
  } catch (error) {
    return mapTimeTrackingActionError(error, t("errors.previousDayCopyFailed"), t);
  }
}

export async function duplicatePreviousWeekAction(
  input: DuplicatePreviousWeekActionInput,
): Promise<TimeTrackingActionState> {
  const t = await getTranslations("TimeTrackingActions");
  const parsed = duplicatePreviousWeekSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("fields.validWeek"),
    };
  }

  try {
    const { member } = await requireActiveAppMemberForAction();
    const result = await duplicatePreviousWeek({
      weekStartDate: parseDateOnly(parsed.data.weekStartDate),
      memberId: member.id,
      actorMemberId: member.id,
      requestMetadata: await getTimeTrackingRequestMetadata(),
    });

    revalidatePath("/time");

    return {
      status: "success",
      message: formatCopyResultMessage(result, "previousWeek", t),
    };
  } catch (error) {
    return mapTimeTrackingActionError(error, t("errors.previousWeekDuplicateFailed"), t);
  }
}

export async function saveTimeEntryDraftAction(
  input: SaveTimeEntryDraftActionInput,
): Promise<TimeTrackingActionState> {
  const t = await getTranslations("TimeTrackingActions");
  const parsed = timeEntryDraftSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.draftSaveFailed"),
    };
  }

  try {
    const { member } = await requireActiveAppMemberForAction();
    await saveTimeEntryDraft({
      draftKey: parsed.data.draftKey,
      payload: parsed.data.payload,
      memberId: member.id,
    });

    return {
      status: "success",
      message: t("success.draftSaved"),
    };
  } catch (error) {
    return mapTimeTrackingActionError(error, t("errors.draftSaveFailed"), t);
  }
}

export async function clearTimeEntryDraftAction(
  input: ClearTimeEntryDraftActionInput,
): Promise<TimeTrackingActionState> {
  const t = await getTranslations("TimeTrackingActions");
  const parsed = clearTimeEntryDraftSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.draftClearFailed"),
    };
  }

  try {
    const { member } = await requireActiveAppMemberForAction();
    await deleteTimeEntryDraft({
      draftKey: parsed.data.draftKey,
      memberId: member.id,
    });

    revalidatePath("/time");

    return {
      status: "success",
      message: t("success.draftDiscarded"),
    };
  } catch (error) {
    return mapTimeTrackingActionError(error, t("errors.draftClearFailed"), t);
  }
}

export async function markInactiveProjectWeekAction(
  input: InactiveProjectWeekActionInput,
): Promise<TimeTrackingActionState> {
  const t = await getTranslations("TimeTrackingActions");
  const parsed = inactiveWeekSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.inactiveWeekSaveFailed"),
    };
  }

  try {
    const { member } = await requireActiveAppMemberForAction();
    await markInactiveProjectWeek({
      ...parsed.data,
      weekStartDate: parseDateOnly(parsed.data.weekStartDate),
      memberId: member.id,
      actorMemberId: member.id,
      requestMetadata: await getTimeTrackingRequestMetadata(),
    });

    revalidatePath("/time");

    return {
      status: "success",
      message: t("success.inactiveWeekSaved"),
    };
  } catch (error) {
    return mapTimeTrackingActionError(error, t("errors.inactiveWeekSaveFailed"), t);
  }
}

export async function unmarkInactiveProjectWeekAction(
  input: InactiveProjectWeekActionInput,
): Promise<TimeTrackingActionState> {
  const t = await getTranslations("TimeTrackingActions");
  const parsed = inactiveWeekSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.inactiveWeekRemoveFailed"),
    };
  }

  try {
    const { member } = await requireActiveAppMemberForAction();
    await unmarkInactiveProjectWeek({
      ...parsed.data,
      weekStartDate: parseDateOnly(parsed.data.weekStartDate),
      memberId: member.id,
      actorMemberId: member.id,
      requestMetadata: await getTimeTrackingRequestMetadata(),
    });

    revalidatePath("/time");

    return {
      status: "success",
      message: t("success.inactiveWeekRemoved"),
    };
  } catch (error) {
    return mapTimeTrackingActionError(error, t("errors.inactiveWeekRemoveFailed"), t);
  }
}

function validateTimeEntryTiming(
  value: {
    timingMode?: "DURATION" | "INTERVAL";
    durationMinutes?: number;
    startTime?: string | null;
    endTime?: string | null;
  },
  context: z.RefinementCtx,
  required: boolean,
) {
  const hasTiming =
    value.timingMode !== undefined ||
    value.durationMinutes !== undefined ||
    value.startTime !== undefined ||
    value.endTime !== undefined;

  if (!required && !hasTiming) return;

  const mode = value.timingMode ?? (value.startTime || value.endTime ? "INTERVAL" : "DURATION");

  if (mode === "INTERVAL") {
    if (!value.startTime) {
      context.addIssue({
        code: "custom",
        path: ["startTime"],
        message: "Start time is required.",
      });
    }

    if (!value.endTime) {
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "End time is required.",
      });
    }

    return;
  }

  if (!value.durationMinutes) {
    context.addIssue({
      code: "custom",
      path: ["durationMinutes"],
      message: "Duration must be greater than zero.",
    });
  }
}

function formatCopyResultMessage(
  result: CopyTimeEntriesResult,
  source: "previousDay" | "previousWeek",
  t: TimeTrackingActionsTranslator,
) {
  if (result.sourceCount === 0) {
    return t(`copy.${source}.noneFound`);
  }

  if (result.createdCount === 0) {
    return t(`copy.${source}.noneCopied`);
  }

  if (result.skippedCount > 0) {
    return t(`copy.${source}.copiedWithSkipped`, {
      created: result.createdCount,
      skipped: result.skippedCount,
    });
  }

  return t(`copy.${source}.copied`, { created: result.createdCount });
}

function getEntryFieldErrors(error: z.ZodError): Partial<Record<TimeEntryFormField, string>> {
  const fieldErrors: Partial<Record<TimeEntryFormField, string>> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (isTimeEntryFormField(field) && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}

function translateEntryFieldErrors(
  fieldErrors: Partial<Record<TimeEntryFormField, string>>,
  t: TimeTrackingActionsTranslator,
): Partial<Record<TimeEntryFormField, string>> {
  const translated: Partial<Record<TimeEntryFormField, string>> = {};

  for (const [field, message] of Object.entries(fieldErrors)) {
    translated[field as TimeEntryFormField] = translateKnownMessage(message, t);
  }

  return translated;
}

function isTimeEntryFormField(field: unknown): field is TimeEntryFormField {
  return (
    field === "projectId" ||
    field === "localDate" ||
    field === "durationMinutes" ||
    field === "description" ||
    field === "startTime" ||
    field === "endTime"
  );
}

function mapTimeTrackingActionError(
  error: unknown,
  fallback: string,
  t: TimeTrackingActionsTranslator,
): TimeTrackingActionState {
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
    return {
      status: "error",
      message: translateKnownMessage(error.message, t),
    };
  }

  if (error instanceof TimeTrackingError || error instanceof TimeTrackingDateError) {
    return {
      status: "error",
      message: translateKnownMessage(error.message, t),
    };
  }

  return {
    status: "error",
    message: fallback,
  };
}

function translateKnownMessage(message: string | undefined, t: TimeTrackingActionsTranslator) {
  if (!message) return t("errors.generic");

  const key = knownMessageKeys[message];
  return key ? t(key) : message;
}

const knownMessageKeys: Record<string, string> = {
  "Choose a project.": "fields.chooseProject",
  "Choose a valid date.": "fields.validDate",
  "Choose a valid target date.": "fields.validTargetDate",
  "Choose a valid week.": "fields.validWeek",
  "Choose a valid start time.": "fields.validStartTime",
  "Choose a valid end time.": "fields.validEndTime",
  "Start time is required.": "fields.startRequired",
  "End time is required.": "fields.endRequired",
  "End time must be after start time.": "fields.endAfterStart",
  "Timer end time must be after start time.": "fields.endAfterStart",
  "Start and end time are required.": "fields.startEndRequired",
  "Duration must be greater than zero.": "fields.durationPositive",
  "Duration is too long.": "fields.durationTooLong",
  "Duration is too large.": "fields.durationTooLarge",
  "Daily total cannot exceed 24 hours.": "fields.dailyTotalTooLarge",
  "Description is required.": "fields.descriptionRequired",
  "Description must be 1000 characters or less.": "fields.descriptionMax",
  "Time entry id is missing.": "fields.timeEntryMissing",
  "Note must be 500 characters or less.": "fields.noteMax",
  "Draft key is invalid.": "fields.draftKeyInvalid",
  "Member not found.": "errors.memberNotFound",
  "Time entry not found.": "errors.timeEntryNotFound",
  "This entry is locked by a submitted timesheet.": "errors.entryLocked",
  "This period is locked by a submitted timesheet.": "errors.periodLocked",
  "This week touches a locked period.": "errors.weekTouchesLockedPeriod",
  "Stop the running timer before starting another one.": "errors.stopTimerFirst",
  "No timer is running.": "errors.noTimerRunning",
  "This project is not active for the selected date.": "errors.projectNotActiveForDate",
  "This project is not assigned for the selected week.": "errors.projectNotAssignedForWeek",
  "Could not format date in timezone.": "errors.dateTimezoneFormatFailed",
};

/**
 * Date validity for this module's schemas, where a date is always required.
 *
 * Deliberately stricter than the same-named helper in `app/admin/projects` and
 * `app/admin/rates`, which accept `""` to mean "no date". Keeping the difference explicit
 * and local is what stops a future consolidation from quietly making required dates
 * optional, or vice versa.
 */
function isDateInputValue(value: string) {
  return isDateValue(value);
}

function isTimeInputValue(value: string) {
  if (!value) return false;
  if (!/^\d{2}:\d{2}$/.test(value)) return false;

  const [hourValue, minuteValue] = value.split(":");
  const hour = Number.parseInt(hourValue ?? "", 10);
  const minute = Number.parseInt(minuteValue ?? "", 10);

  return (
    !Number.isNaN(hour) &&
    !Number.isNaN(minute) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59
  );
}

async function getTimeTrackingRequestMetadata(): Promise<TimeTrackingRequestMetadata> {
  const requestHeaders = await headers();

  return {
    ipAddress: requestHeaders.get("x-forwarded-for"),
    userAgent: requestHeaders.get("user-agent"),
  };
}
