"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { isDateValue } from "@/src/lib/date-values";

import { isSupportedCurrencyCode, normalizeCurrencyCode } from "@/src/lib/member-preferences";
import { requireAdminAppMemberForAction } from "@/src/server/auth/app-access";
import { AuthenticationError, AuthorizationError } from "@/src/server/auth/session";
import { Prisma } from "@/src/server/db/generated/client";
import {
  createAssignmentOverrideRate,
  createMemberDefaultRate,
  RateManagementError,
  replaceAssignmentOverrideRateFromDate,
  replaceMemberDefaultRateFromDate,
  type RateRequestMetadata,
} from "@/src/server/rates";
import type {
  CreateAssignmentOverrideRateActionInput,
  CreateMemberDefaultRateActionInput,
  RateActionState,
  RateFormField,
  ReplaceAssignmentOverrideRateActionInput,
  ReplaceMemberDefaultRateActionInput,
} from "./actions.types";

type AdminRatesActionsTranslator = Awaited<ReturnType<typeof getTranslations>>;

function createRateDateSchema(t: AdminRatesActionsTranslator) {
  return z.string().trim().refine(isDateInputValue, t("validation.validDate"));
}

function createRateFormSchema(t: AdminRatesActionsTranslator) {
  return z
    .object({
      validFrom: z
        .string()
        .trim()
        .min(1, t("validation.rateStartRequired"))
        .refine(isDateInputValue, t("validation.validStartDate")),
      validTo: createRateDateSchema(t),
      hourlyRate: z
        .string()
        .trim()
        .min(1, t("validation.hourlyRateRequired"))
        .regex(/^\d+(\.\d{1,2})?$/, t("validation.hourlyRateFormat")),
      currencyCode: z
        .string()
        .transform(normalizeCurrencyCode)
        .refine(isSupportedCurrencyCode, t("validation.supportedCurrency")),
      note: z.string().trim().max(1000, t("validation.noteMax")),
    })
    .superRefine((value, context) => {
      if (!value.validTo) return;

      if (value.validTo <= value.validFrom) {
        context.addIssue({
          code: "custom",
          message: t("validation.rateEndAfterStart"),
          path: ["validTo"],
        });
      }
    });
}

function createRateReplacementFormSchema(t: AdminRatesActionsTranslator) {
  return z.object({
    validFrom: z
      .string()
      .trim()
      .min(1, t("validation.replacementStartRequired"))
      .refine(isDateInputValue, t("validation.validStartDate")),
    hourlyRate: z
      .string()
      .trim()
      .min(1, t("validation.hourlyRateRequired"))
      .regex(/^\d+(\.\d{1,2})?$/, t("validation.hourlyRateFormat")),
    currencyCode: z
      .string()
      .transform(normalizeCurrencyCode)
      .refine(isSupportedCurrencyCode, t("validation.supportedCurrency")),
    note: z.string().trim().max(1000, t("validation.noteMax")),
  });
}

export async function createMemberDefaultRateAction(
  input: CreateMemberDefaultRateActionInput,
): Promise<RateActionState> {
  const t = await getTranslations("AdminRatesActions");
  const parsed = createRateFormSchema(t).safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.fixFields"),
      fieldErrors: getRateFieldErrors(parsed.error),
    };
  }

  try {
    const { member: admin } = await requireAdminAppMemberForAction();
    await createMemberDefaultRate({
      ...parsed.data,
      memberId: input.memberId,
      validFrom: parseRequiredDate(parsed.data.validFrom),
      validTo: parseOptionalDate(parsed.data.validTo),
      actorMemberId: admin.id,
      requestMetadata: await getRateRequestMetadata(),
    });

    revalidatePath("/admin/rates");

    return {
      status: "success",
      message: t("success.memberRateCreated"),
    };
  } catch (error) {
    return mapRateActionError(error, t("errors.memberRateFailed"), t);
  }
}

export async function createAssignmentOverrideRateAction(
  input: CreateAssignmentOverrideRateActionInput,
): Promise<RateActionState> {
  const t = await getTranslations("AdminRatesActions");
  const parsed = createRateFormSchema(t).safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.fixFields"),
      fieldErrors: getRateFieldErrors(parsed.error),
    };
  }

  try {
    const { member: admin } = await requireAdminAppMemberForAction();
    await createAssignmentOverrideRate({
      ...parsed.data,
      projectAssignmentId: input.projectAssignmentId,
      validFrom: parseRequiredDate(parsed.data.validFrom),
      validTo: parseOptionalDate(parsed.data.validTo),
      actorMemberId: admin.id,
      requestMetadata: await getRateRequestMetadata(),
    });

    revalidatePath("/admin/projects");
    revalidatePath("/admin/rates");

    return {
      status: "success",
      message: t("success.assignmentOverrideCreated"),
    };
  } catch (error) {
    return mapRateActionError(error, t("errors.assignmentOverrideFailed"), t);
  }
}

export async function replaceMemberDefaultRateAction(
  input: ReplaceMemberDefaultRateActionInput,
): Promise<RateActionState> {
  const t = await getTranslations("AdminRatesActions");
  const parsed = createRateReplacementFormSchema(t).safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.fixFields"),
      fieldErrors: getRateFieldErrors(parsed.error),
    };
  }

  try {
    const { member: admin } = await requireAdminAppMemberForAction();
    await replaceMemberDefaultRateFromDate({
      ...parsed.data,
      memberId: input.memberId,
      ratePeriodId: input.ratePeriodId,
      validFrom: parseRequiredDate(parsed.data.validFrom),
      actorMemberId: admin.id,
      requestMetadata: await getRateRequestMetadata(),
    });

    revalidatePath("/admin/rates");

    return {
      status: "success",
      message: t("success.memberRateReplaced"),
    };
  } catch (error) {
    return mapRateActionError(error, t("errors.memberRateReplaceFailed"), t);
  }
}

export async function replaceAssignmentOverrideRateAction(
  input: ReplaceAssignmentOverrideRateActionInput,
): Promise<RateActionState> {
  const t = await getTranslations("AdminRatesActions");
  const parsed = createRateReplacementFormSchema(t).safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.fixFields"),
      fieldErrors: getRateFieldErrors(parsed.error),
    };
  }

  try {
    const { member: admin } = await requireAdminAppMemberForAction();
    await replaceAssignmentOverrideRateFromDate({
      ...parsed.data,
      projectAssignmentId: input.projectAssignmentId,
      ratePeriodId: input.ratePeriodId,
      validFrom: parseRequiredDate(parsed.data.validFrom),
      actorMemberId: admin.id,
      requestMetadata: await getRateRequestMetadata(),
    });

    revalidatePath("/admin/projects");
    revalidatePath("/admin/rates");

    return {
      status: "success",
      message: t("success.assignmentOverrideReplaced"),
    };
  } catch (error) {
    return mapRateActionError(error, t("errors.assignmentOverrideReplaceFailed"), t);
  }
}

/**
 * Date validity for this module's schemas, where an empty value means "no date" — clearing
 * a project end date or leaving a rate period open-ended.
 *
 * The `""`-tolerance is the whole reason this wrapper still exists rather than the schemas
 * calling `isDateValue` directly: `app/admin/people` and `app/time` spell the same helper
 * name with the opposite meaning, and folding them together would silently make optional
 * end dates required.
 */
function isDateInputValue(value: string) {
  return value === "" || isDateValue(value);
}

function parseOptionalDate(value: string) {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

function parseRequiredDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function getRateFieldErrors(error: z.ZodError): RateActionState["fieldErrors"] {
  const fieldErrors: RateActionState["fieldErrors"] = {};

  for (const issue of error.issues) {
    const field = issue.path.at(0);

    if (isRateFormField(field) && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}

function isRateFormField(field: unknown): field is RateFormField {
  return (
    field === "validFrom" ||
    field === "validTo" ||
    field === "hourlyRate" ||
    field === "currencyCode" ||
    field === "note"
  );
}

async function getRateRequestMetadata(): Promise<RateRequestMetadata> {
  const requestHeaders = await headers();

  return {
    ipAddress: requestHeaders.get("x-forwarded-for"),
    userAgent: requestHeaders.get("user-agent"),
  };
}

function mapRateActionError(
  error: unknown,
  fallback: string,
  t: AdminRatesActionsTranslator,
): RateActionState {
  console.error("[admin/rates] action failed", error);

  if (
    error instanceof RateManagementError ||
    error instanceof AuthenticationError ||
    error instanceof AuthorizationError
  ) {
    return {
      status: "error",
      message: error.message,
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      status: "error",
      message: mapKnownPrismaRateError(error, fallback, t),
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
    message: fallback,
  };
}

function mapKnownPrismaRateError(
  error: Prisma.PrismaClientKnownRequestError,
  fallback: string,
  t: AdminRatesActionsTranslator,
) {
  switch (error.code) {
    case "P2003":
      return t("errors.rateLinkFailed");
    case "P2021":
    case "P2022":
      return t("errors.ratesUnavailable");
    default:
      return fallback;
  }
}
