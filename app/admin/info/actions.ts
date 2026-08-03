"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireAdminAppMemberForAction } from "@/src/server/auth/app-access";
import { AuthenticationError, AuthorizationError } from "@/src/server/auth/session";
import {
  HELP_WELCOME_INFO_PAGE_SLUG,
  publishInfoPage,
  type InfoPageRequestMetadata,
} from "@/src/server/info-pages";

export type AdminInfoActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Partial<Record<"title" | "bodyMarkdown", string>>;
  value?: {
    title: string;
    bodyMarkdown: string;
    version: number;
    updatedAt: string;
  };
};

type AdminInfoActionsTranslator = Awaited<ReturnType<typeof getTranslations>>;

function createPublishInfoPageSchema(t: AdminInfoActionsTranslator) {
  return z.object({
    slug: z.literal(HELP_WELCOME_INFO_PAGE_SLUG),
    title: z
      .string()
      .trim()
      .min(1, t("validation.titleRequired"))
      .max(120, t("validation.titleMax")),
    bodyMarkdown: z
      .string()
      .trim()
      .min(1, t("validation.bodyRequired"))
      .max(20000, t("validation.bodyMax")),
  });
}

export async function publishHelpWelcomeInfoPageAction(
  _previousState: AdminInfoActionState,
  formData: FormData,
): Promise<AdminInfoActionState> {
  const t = await getTranslations("AdminInfoActions");
  const parsed = createPublishInfoPageSchema(t).safeParse({
    slug: String(formData.get("slug") ?? ""),
    title: String(formData.get("title") ?? ""),
    bodyMarkdown: String(formData.get("bodyMarkdown") ?? ""),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.fixFields"),
      fieldErrors: getPublishInfoPageFieldErrors(parsed.error),
    };
  }

  try {
    const { member: admin } = await requireAdminAppMemberForAction();
    const result = await publishInfoPage({
      ...parsed.data,
      actorMemberId: admin.id,
      requestMetadata: await getRequestMetadata(),
    });

    revalidatePath("/help");
    revalidatePath("/admin/info");

    return {
      status: "success",
      message: t("success.published"),
      value: {
        title: result.title,
        bodyMarkdown: result.bodyMarkdown,
        version: result.version,
        updatedAt: result.updatedAt.toISOString(),
      },
    };
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return {
        status: "error",
        message: error.message,
      };
    }

    return {
      status: "error",
      message: t("errors.publishFailed"),
    };
  }
}

function getPublishInfoPageFieldErrors(error: z.ZodError) {
  const fieldErrors: AdminInfoActionState["fieldErrors"] = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if ((field === "title" || field === "bodyMarkdown") && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}

async function getRequestMetadata(): Promise<InfoPageRequestMetadata> {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");

  return {
    requestId: requestHeaders.get("x-request-id"),
    ipAddress: forwardedFor?.split(",")[0]?.trim() || null,
    userAgent: requestHeaders.get("user-agent"),
  };
}
