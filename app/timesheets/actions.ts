"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireActiveAppMemberForAction } from "@/src/server/auth/app-access";
import { AuthenticationError, AuthorizationError } from "@/src/server/auth/session";
import { Prisma } from "@/src/server/db/generated/client";
import {
  parseTimesheetMonthParam,
  submitContractorTimesheet,
  TimesheetSubmissionError,
  type TimesheetSubmissionRequestMetadata,
} from "@/src/server/timesheets";

export type TimesheetActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

type TimesheetActionsTranslator = Awaited<ReturnType<typeof getTranslations>>;

const submitTimesheetSchema = z.object({
  periodStart: z.string().trim().min(1),
});

const submissionErrorKeys: Record<string, string> = {
  "Member not found.": "errors.memberNotFound",
  "Contractor profile required.": "errors.contractorRequired",
  "This month is already locked by a submitted timesheet.": "errors.monthLocked",
  "This month is not open for submission.": "errors.monthNotOpen",
  "No time entries exist for this month.": "errors.noEntries",
  "Timesheet has entries already locked by another timesheet.": "errors.entriesAlreadyLocked",
  "Timesheet has entries without a project assignment.": "errors.missingProjectAssignment",
  "Timesheet has entries with invalid durations.": "errors.invalidDurations",
  "Timesheet has entries with missing descriptions.": "errors.missingDescriptions",
  "Missing rates for one or more entries.": "errors.missingRates",
  "Timesheet month contains multiple currencies.": "errors.mixedCurrency",
  "Timesheet source entries changed during submission. Try again.": "errors.entriesChanged",
};

export async function submitTimesheetAction(input: {
  periodStart: string;
}): Promise<TimesheetActionState> {
  const t = await getTranslations("TimesheetActions");
  const parsed = submitTimesheetSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.invalidMonth"),
    };
  }

  const periodStart = parseTimesheetMonthParam(parsed.data.periodStart.slice(0, 7));

  if (!periodStart) {
    return {
      status: "error",
      message: t("errors.invalidMonth"),
    };
  }

  try {
    const { member } = await requireActiveAppMemberForAction();

    if (member.currentProfile !== "CONTRACTOR") {
      throw new AuthorizationError("Contractor profile required.");
    }

    await submitContractorTimesheet({
      memberId: member.id,
      actorMemberId: member.id,
      periodStart,
      requestMetadata: await getTimesheetRequestMetadata(),
    });

    revalidatePath("/timesheets");
    revalidatePath("/time");

    return {
      status: "success",
      message: t("success.submitted"),
    };
  } catch (error) {
    return mapTimesheetActionError(error, t);
  }
}

async function getTimesheetRequestMetadata(): Promise<TimesheetSubmissionRequestMetadata> {
  const requestHeaders = await headers();

  return {
    ipAddress: requestHeaders.get("x-forwarded-for"),
    userAgent: requestHeaders.get("user-agent"),
  };
}

function mapTimesheetActionError(
  error: unknown,
  t: TimesheetActionsTranslator,
): TimesheetActionState {
  console.error("[timesheets] action failed", error);

  if (error instanceof TimesheetSubmissionError) {
    const key = submissionErrorKeys[error.message] ?? "errors.submitFailed";

    return {
      status: "error",
      message: t(key),
    };
  }

  if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
    return {
      status: "error",
      message: t("errors.notAllowed"),
    };
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: "error",
      message: t("errors.databaseUnavailable"),
    };
  }

  return {
    status: "error",
    message: t("errors.submitFailed"),
  };
}
