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
  acceptInvoiceForAdmin,
  approveTimesheetForAdmin,
  approveTimesheetsForAdmin,
  markTimesheetPaidForAdmin,
  rejectInvoiceForAdmin,
  rejectTimesheetForAdmin,
  TimesheetReviewError,
  type TimesheetReviewRequestMetadata,
} from "@/src/server/timesheets";

const timesheetIdSchema = z.string().uuid();
const bulkApproveTimesheetsSchema = z.object({
  timesheetIds: z.array(timesheetIdSchema).min(1).max(100),
  returnTo: z.string().max(2000).optional(),
});

const rejectTimesheetSchema = z.object({
  timesheetId: timesheetIdSchema,
  reason: z.string().trim().min(3).max(2000),
});

const reviewInvoiceSchema = z.object({
  timesheetId: timesheetIdSchema,
  invoiceId: z.string().uuid(),
});

const rejectInvoiceSchema = reviewInvoiceSchema.extend({
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

export async function bulkApproveTimesheetsReviewAction(formData: FormData) {
  const parsed = bulkApproveTimesheetsSchema.safeParse({
    timesheetIds: formData.getAll("timesheetIds"),
    returnTo: formData.get("returnTo") ?? undefined,
  });
  const returnTo = getSafeTimesheetListPath(
    parsed.success ? parsed.data.returnTo : formData.get("returnTo"),
  );

  if (!parsed.success) {
    redirect(withListResult(returnTo, "invalid") as Route);
  }

  let result = "bulkApproved";
  let approvedCount = 0;

  try {
    const { member: admin } = await requireAdminAppMemberForAction();
    const approval = await approveTimesheetsForAdmin({
      timesheetIds: parsed.data.timesheetIds,
      actorMemberId: admin.id,
      requestMetadata: await getTimesheetReviewRequestMetadata(),
    });

    approvedCount = approval.approvedCount;
    revalidateTimesheetReviewPaths(approval.timesheetIds);
  } catch (error) {
    result = mapBulkTimesheetReviewActionError(error);
  }

  redirect(withListResult(returnTo, result, approvedCount) as Route);
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

export async function acceptInvoiceReviewAction(formData: FormData) {
  const parsed = reviewInvoiceSchema.safeParse({
    timesheetId: formData.get("timesheetId"),
    invoiceId: formData.get("invoiceId"),
  });

  if (!parsed.success) {
    redirect("/admin/timesheets?result=invalid" as Route);
  }

  const { timesheetId, invoiceId } = parsed.data;
  let result = "invoiceAccepted";

  try {
    const { member: admin } = await requireAdminAppMemberForAction();

    await acceptInvoiceForAdmin({
      timesheetId,
      invoiceId,
      actorMemberId: admin.id,
      requestMetadata: await getTimesheetReviewRequestMetadata(),
    });

    revalidateTimesheetReviewPaths(timesheetId);
  } catch (error) {
    result = mapTimesheetReviewActionError(error);
  }

  redirect(`/admin/timesheets/${timesheetId}?result=${result}` as Route);
}

export async function rejectInvoiceReviewAction(formData: FormData) {
  const parsed = rejectInvoiceSchema.safeParse({
    timesheetId: formData.get("timesheetId"),
    invoiceId: formData.get("invoiceId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    const fallbackTimesheetId = formData.get("timesheetId");
    const redirectTarget =
      typeof fallbackTimesheetId === "string" &&
      timesheetIdSchema.safeParse(fallbackTimesheetId).success
        ? `/admin/timesheets/${fallbackTimesheetId}?result=invoiceReasonRequired`
        : "/admin/timesheets?result=invalid";

    redirect(redirectTarget as Route);
  }

  const { timesheetId, invoiceId, reason } = parsed.data;
  let result = "invoiceRejected";

  try {
    const { member: admin } = await requireAdminAppMemberForAction();

    await rejectInvoiceForAdmin({
      timesheetId,
      invoiceId,
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

export async function markTimesheetPaidReviewAction(formData: FormData) {
  const parsed = timesheetIdSchema.safeParse(formData.get("timesheetId"));

  if (!parsed.success) {
    redirect("/admin/timesheets?result=invalid" as Route);
  }

  const timesheetId = parsed.data;
  let result = "paid";

  try {
    const { member: admin } = await requireAdminAppMemberForAction();

    await markTimesheetPaidForAdmin({
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

async function getTimesheetReviewRequestMetadata(): Promise<TimesheetReviewRequestMetadata> {
  const requestHeaders = await headers();

  return {
    ipAddress: requestHeaders.get("x-forwarded-for"),
    userAgent: requestHeaders.get("user-agent"),
  };
}

function revalidateTimesheetReviewPaths(timesheetId: string | string[]) {
  revalidatePath("/admin/timesheets");
  for (const id of Array.isArray(timesheetId) ? timesheetId : [timesheetId]) {
    revalidatePath(`/admin/timesheets/${id}`);
  }
  revalidatePath("/timesheets");
  revalidatePath("/time");
}

function mapBulkTimesheetReviewActionError(error: unknown) {
  if (
    error instanceof TimesheetReviewError &&
    (error.message.includes("submitted timesheets") || error.message.includes("not found"))
  ) {
    console.error("[admin-timesheets] bulk approval rejected due to stale selection", error);
    return "bulkChanged";
  }

  return mapTimesheetReviewActionError(error);
}

function getSafeTimesheetListPath(value: FormDataEntryValue | null | undefined) {
  if (typeof value !== "string") return "/admin/timesheets";

  try {
    const url = new URL(value, "https://sheet-happens.invalid");
    if (url.origin !== "https://sheet-happens.invalid" || url.pathname !== "/admin/timesheets") {
      return "/admin/timesheets";
    }

    return `${url.pathname}${url.search}`;
  } catch {
    return "/admin/timesheets";
  }
}

function withListResult(path: string, result: string, approvedCount?: number) {
  const url = new URL(path, "https://sheet-happens.invalid");
  url.searchParams.set("result", result);

  if (approvedCount) {
    url.searchParams.set("count", String(approvedCount));
  } else {
    url.searchParams.delete("count");
  }

  return `${url.pathname}?${url.searchParams.toString()}`;
}

function mapTimesheetReviewActionError(error: unknown) {
  console.error("[admin-timesheets] review action failed", error);

  if (error instanceof TimesheetReviewError) {
    if (error.message === "Timesheet not found.") return "notFound";
    if (error.message === "Invoice not found.") return "invoiceNotFound";
    if (error.message === "Accepted invoice not found.") return "acceptedInvoiceNotFound";
    if (error.message === "Rejection reason is required.") return "reasonRequired";
    if (error.message === "Invoice rejection reason is required.") return "invoiceReasonRequired";
    if (error.message.includes("accepted timesheets")) return "notAccepted";
    if (error.message.includes("Cancellation invoice must be paired"))
      return "invoicePackageIncomplete";
    if (error.message.includes("requires a cancellation invoice"))
      return "invoicePackageIncomplete";
    if (error.message.includes("approved")) return "notSubmitted";
    if (error.message.includes("rejected")) return "notSubmitted";
    if (error.message.includes("uploaded invoices")) return "notInvoiced";
    if (error.message.includes("uploaded invoice")) return "notInvoiced";
    if (error.message.includes("current timesheet revision")) return "invoiceRevisionChanged";
  }

  if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
    return "notAllowed";
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return "databaseUnavailable";
  }

  return "failed";
}
