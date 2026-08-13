"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireAdminAppMemberForAction } from "@/src/server/auth/app-access";
import { AuthenticationError, AuthorizationError } from "@/src/server/auth/session";
import { Prisma } from "@/src/server/db/generated/client";
import {
  deletePayslip,
  PAYSLIP_MAX_BYTES,
  PayslipError,
  uploadPayslip,
} from "@/src/server/payslips";
import { ObjectStorageConfigurationError } from "@/src/server/storage";
import { parseDateOnly } from "@/src/server/time-tracking";
import type { AdminPayslipActionState } from "./action-state";

const uploadPayslipSchema = z.object({
  employeeMemberId: z.string().uuid(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-01$/),
});

export async function uploadPayslipAction(
  _previousState: AdminPayslipActionState,
  formData: FormData,
): Promise<AdminPayslipActionState> {
  const t = await getTranslations("Payslips");
  const parsed = uploadPayslipSchema.safeParse({
    employeeMemberId: formData.get("employeeMemberId"),
    periodStart: formData.get("periodStart"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues.some((issue) => issue.path[0] === "employeeMemberId")
        ? t("errors.employeeRequired")
        : t("errors.monthRequired"),
    };
  }

  const file = formData.get("payslipFile");

  if (!(file instanceof File) || file.size <= 0) {
    return { status: "error", message: t("errors.fileRequired") };
  }

  if (file.size > PAYSLIP_MAX_BYTES) {
    return { status: "error", message: t("errors.fileTooLarge") };
  }

  try {
    const { member } = await requireAdminAppMemberForAction();
    const result = await uploadPayslip({
      employeeMemberId: parsed.data.employeeMemberId,
      actorMemberId: member.id,
      periodStart: parseDateOnly(parsed.data.periodStart, "Choose a valid month."),
      file: {
        bytes: Buffer.from(await file.arrayBuffer()),
        originalFilename: file.name || "payslip.pdf",
        contentType:
          file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
            ? "application/pdf"
            : file.type,
        byteSize: file.size,
      },
      requestMetadata: await getRequestMetadata(),
    });

    revalidatePath("/admin/payslips");
    revalidatePath("/payslips");

    return {
      status: "success",
      message: result.replaced ? t("admin.upload.replaced") : t("admin.upload.success"),
      replaced: result.replaced,
    };
  } catch (error) {
    console.error("[payslips] upload failed", error);
    return {
      status: "error",
      message: getPayslipErrorMessage(error, t, "upload"),
    };
  }
}

export async function deletePayslipAction(input: {
  payslipId: string;
}): Promise<AdminPayslipActionState> {
  const t = await getTranslations("Payslips");

  if (!z.string().uuid().safeParse(input.payslipId).success) {
    return { status: "error", message: t("errors.deleteFailed") };
  }

  try {
    const { member } = await requireAdminAppMemberForAction();
    await deletePayslip({
      payslipId: input.payslipId,
      actorMemberId: member.id,
      isAdmin: true,
      requestMetadata: await getRequestMetadata(),
    });

    revalidatePath("/admin/payslips");
    revalidatePath("/payslips");
    return { status: "success", message: t("admin.delete.success") };
  } catch (error) {
    console.error("[payslips] delete failed", error);
    return {
      status: "error",
      message: getPayslipErrorMessage(error, t, "delete"),
    };
  }
}

async function getRequestMetadata() {
  const requestHeaders = await headers();

  return {
    ipAddress: requestHeaders.get("x-forwarded-for"),
    userAgent: requestHeaders.get("user-agent"),
  };
}

function getPayslipErrorMessage(
  error: unknown,
  t: Awaited<ReturnType<typeof getTranslations>>,
  operation: "upload" | "delete",
) {
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
    return t("errors.notAllowed");
  }

  if (error instanceof ObjectStorageConfigurationError) {
    return t("errors.storageMissing");
  }

  if (error instanceof PayslipError) {
    if (error.message === "Employee profile required.") return t("errors.employeeRequired");
    if (error.message === "Payslip PDF is required.") return t("errors.fileRequired");
    if (error.message === "Payslip PDF is too large.") return t("errors.fileTooLarge");
    if (error.message === "Payslip must be a PDF.") return t("errors.pdfRequired");
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return t(`errors.${operation}Failed`);
  }

  return t(`errors.${operation}Failed`);
}
