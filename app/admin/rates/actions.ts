"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { isSupportedCurrencyCode, normalizeCurrencyCode } from "@/src/lib/member-preferences";
import { requireAdminAppMemberForAction } from "@/src/server/auth/app-access";
import { AuthenticationError, AuthorizationError } from "@/src/server/auth/session";
import { Prisma } from "@/src/server/db/generated/client";
import {
  createAssignmentOverrideRate,
  createMemberDefaultRate,
  RateManagementError,
  type RateRequestMetadata,
} from "@/src/server/rates";
import type {
  CreateAssignmentOverrideRateActionInput,
  CreateMemberDefaultRateActionInput,
  RateActionState,
  RateFormField,
} from "./actions.types";

const rateDateSchema = z.string().trim().refine(isDateInputValue, "Choose a valid date.");

const rateFormSchema = z
  .object({
    validFrom: z
      .string()
      .trim()
      .min(1, "Rate start date is required.")
      .refine(isDateInputValue, "Choose a valid start date."),
    validTo: rateDateSchema,
    hourlyRate: z
      .string()
      .trim()
      .min(1, "Hourly rate is required.")
      .regex(/^\d+(\.\d{1,2})?$/, "Enter a non-negative amount with up to 2 decimals."),
    currencyCode: z
      .string()
      .transform(normalizeCurrencyCode)
      .refine(isSupportedCurrencyCode, "Choose a supported currency."),
    note: z.string().trim().max(1000, "Note must be 1000 characters or less."),
  })
  .superRefine((value, context) => {
    if (!value.validTo) return;

    if (value.validTo <= value.validFrom) {
      context.addIssue({
        code: "custom",
        message: "Rate end date must be after the start date.",
        path: ["validTo"],
      });
    }
  });

export async function createMemberDefaultRateAction(
  input: CreateMemberDefaultRateActionInput,
): Promise<RateActionState> {
  const parsed = rateFormSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted rate fields and try again.",
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
      message: "Member rate period created.",
    };
  } catch (error) {
    return mapRateActionError(error, "The member rate could not be created.");
  }
}

export async function createAssignmentOverrideRateAction(
  input: CreateAssignmentOverrideRateActionInput,
): Promise<RateActionState> {
  const parsed = rateFormSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted rate fields and try again.",
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
      message: "Assignment override rate period created.",
    };
  } catch (error) {
    return mapRateActionError(error, "The assignment override rate could not be created.");
  }
}

function isDateInputValue(value: string) {
  if (value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
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

function mapRateActionError(error: unknown, fallback: string): RateActionState {
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
      message: mapKnownPrismaRateError(error, fallback),
    };
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: "error",
      message: "The database is not reachable. Try again later or contact support.",
    };
  }

  return {
    status: "error",
    message: fallback,
  };
}

function mapKnownPrismaRateError(error: Prisma.PrismaClientKnownRequestError, fallback: string) {
  switch (error.code) {
    case "P2003":
      return "The rate could not be linked to the selected member or assignment. Refresh and try again.";
    case "P2021":
    case "P2022":
      return "Rates are temporarily unavailable. Try again later or contact support.";
    default:
      return fallback;
  }
}
