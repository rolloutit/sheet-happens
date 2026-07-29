"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminAppMemberForAction } from "@/src/server/auth/app-access";
import { AuthenticationError, AuthorizationError } from "@/src/server/auth/session";
import { Prisma } from "@/src/server/db/generated/client";
import {
  approveTimesheetForAdmin,
  rejectTimesheetForAdmin,
  TimesheetReviewError,
  type TimesheetReviewRequestMetadata,
} from "@/src/server/timesheets";

const timesheetIdSchema = z.string().uuid();

const rejectTimesheetSchema = z.object({
  timesheetId: timesheetIdSchema,
  reason: z.string().trim().min(3).max(2000),
});

export async function approveTimesheetReviewAction(formData: FormData) {
  const parsed = timesheetIdSchema.safeParse(formData.get("timesheetId"));

  if (!parsed.success) {
    redirect("/admin/timesheets?result=invalid" as Route);
  }

  const timesheetId = parsed.data;
  let result = "approved";

  try {
    const { member: admin } = await requireAdminAppMemberForAction();

    await approveTimesheetForAdmin({
      timesheetId,
      actorMemberId: admin.id,
      requestMetadata: await getTimesheetReviewRequestMetadata(),
    });

    revalidateTimesheetReviewPaths(timesheetId);
  } catch (error) {
    result = mapTimesheetReviewActionError(error);
  }

  redirect(`/admin/timesheets/${timesheetId}?result=${result}` as Route);
}

export async function rejectTimesheetReviewAction(formData: FormData) {
  const parsed = rejectTimesheetSchema.safeParse({
    timesheetId: formData.get("timesheetId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    const fallbackTimesheetId = formData.get("timesheetId");
    const redirectTarget =
      typeof fallbackTimesheetId === "string" &&
      timesheetIdSchema.safeParse(fallbackTimesheetId).success
        ? `/admin/timesheets/${fallbackTimesheetId}?result=reasonRequired`
        : "/admin/timesheets?result=invalid";

    redirect(redirectTarget as Route);
  }

  const { timesheetId, reason } = parsed.data;
  let result = "rejected";

  try {
    const { member: admin } = await requireAdminAppMemberForAction();

    await rejectTimesheetForAdmin({
      timesheetId,
      reason,
      actorMemberId: admin.id,
      requestMetadata: await getTimesheetReviewRequestMetadata(),
    });

    revalidateTimesheetReviewPaths(timesheetId);
  } catch (error) {
    result = mapTimesheetReviewActionError(error);
  }

  redirect(`/admin/timesheets/${timesheetId}?result=${result}` as Route);
}

async function getTimesheetReviewRequestMetadata(): Promise<TimesheetReviewRequestMetadata> {
  const requestHeaders = await headers();

  return {
    ipAddress: requestHeaders.get("x-forwarded-for"),
    userAgent: requestHeaders.get("user-agent"),
  };
}

function revalidateTimesheetReviewPaths(timesheetId: string) {
  revalidatePath("/admin/timesheets");
  revalidatePath(`/admin/timesheets/${timesheetId}`);
  revalidatePath("/timesheets");
  revalidatePath("/time");
}

function mapTimesheetReviewActionError(error: unknown) {
  console.error("[admin-timesheets] review action failed", error);

  if (error instanceof TimesheetReviewError) {
    if (error.message === "Timesheet not found.") return "notFound";
    if (error.message === "Rejection reason is required.") return "reasonRequired";
    if (error.message.includes("approved")) return "notSubmitted";
    if (error.message.includes("rejected")) return "notSubmitted";
  }

  if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
    return "notAllowed";
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return "databaseUnavailable";
  }

  return "failed";
}
