"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { requireActiveAppMemberForAction } from "@/src/server/auth/app-access";
import { AuthenticationError, AuthorizationError } from "@/src/server/auth/session";
import {
  createTimeEntry,
  deleteTimeEntry,
  markInactiveProjectWeek,
  parseDateOnly,
  startRunningTimer,
  stopRunningTimer,
  TimeTrackingDateError,
  TimeTrackingError,
  unmarkInactiveProjectWeek,
  updateTimeEntry,
  type TimeTrackingRequestMetadata,
} from "@/src/server/time-tracking";

import type {
  CreateTimeEntryActionInput,
  DeleteTimeEntryActionInput,
  InactiveProjectWeekActionInput,
  StartRunningTimerActionInput,
  TimeEntryFormField,
  TimeTrackingActionState,
  UpdateTimeEntryActionInput,
} from "./actions.types";

const timingSchema = {
  timingMode: z.enum(["DURATION", "INTERVAL"]).optional(),
  durationMinutes: z.number().int().positive("Duration must be greater than zero.").optional(),
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

export async function createTimeEntryAction(
  input: CreateTimeEntryActionInput,
): Promise<TimeTrackingActionState> {
  const parsed = createTimeEntrySchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted fields and try again.",
      fieldErrors: getEntryFieldErrors(parsed.error),
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
      message: "Time entry saved.",
    };
  } catch (error) {
    return mapTimeTrackingActionError(error, "The time entry could not be saved.");
  }
}

export async function updateTimeEntryAction(
  input: UpdateTimeEntryActionInput,
): Promise<TimeTrackingActionState> {
  const parsed = updateTimeEntrySchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted fields and try again.",
      fieldErrors: getEntryFieldErrors(parsed.error),
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
      message: "Time entry updated.",
    };
  } catch (error) {
    return mapTimeTrackingActionError(error, "The time entry could not be updated.");
  }
}

export async function deleteTimeEntryAction(
  input: DeleteTimeEntryActionInput,
): Promise<TimeTrackingActionState> {
  const parsed = deleteTimeEntrySchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: "The time entry could not be deleted.",
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
      message: "Time entry deleted.",
    };
  } catch (error) {
    return mapTimeTrackingActionError(error, "The time entry could not be deleted.");
  }
}

export async function startRunningTimerAction(
  input: StartRunningTimerActionInput,
): Promise<TimeTrackingActionState> {
  const parsed = startRunningTimerSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted fields and try again.",
      fieldErrors: getEntryFieldErrors(parsed.error),
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
      message: "Timer started.",
    };
  } catch (error) {
    return mapTimeTrackingActionError(error, "The timer could not be started.");
  }
}

export async function stopRunningTimerAction(): Promise<TimeTrackingActionState> {
  try {
    const { member } = await requireActiveAppMemberForAction();
    await stopRunningTimer({
      memberId: member.id,
      actorMemberId: member.id,
      requestMetadata: await getTimeTrackingRequestMetadata(),
    });

    revalidatePath("/time");

    return {
      status: "success",
      message: "Timer stopped and saved.",
    };
  } catch (error) {
    return mapTimeTrackingActionError(error, "The timer could not be stopped.");
  }
}

export async function markInactiveProjectWeekAction(
  input: InactiveProjectWeekActionInput,
): Promise<TimeTrackingActionState> {
  const parsed = inactiveWeekSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: "The inactive week could not be saved.",
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
      message: "Project marked inactive for this week.",
    };
  } catch (error) {
    return mapTimeTrackingActionError(error, "The inactive week could not be saved.");
  }
}

export async function unmarkInactiveProjectWeekAction(
  input: InactiveProjectWeekActionInput,
): Promise<TimeTrackingActionState> {
  const parsed = inactiveWeekSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: "The inactive week could not be removed.",
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
      message: "Inactive week removed.",
    };
  } catch (error) {
    return mapTimeTrackingActionError(error, "The inactive week could not be removed.");
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

function mapTimeTrackingActionError(error: unknown, fallback: string): TimeTrackingActionState {
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
    return {
      status: "error",
      message: error.message,
    };
  }

  if (error instanceof TimeTrackingError || error instanceof TimeTrackingDateError) {
    return {
      status: "error",
      message: error.message,
    };
  }

  return {
    status: "error",
    message: fallback,
  };
}

function isDateInputValue(value: string) {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
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
