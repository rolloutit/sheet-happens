"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { AuthenticationError, requireSession } from "@/src/server/auth/session";
import { activateInvitation, InvitationActivationError } from "@/src/server/users";
import type { ActivateInvitationActionState } from "./actions.types";

export async function activateInvitationAction(
  _previousState: ActivateInvitationActionState,
  formData: FormData,
): Promise<ActivateInvitationActionState> {
  const t = await getTranslations("AcceptInviteActions");
  const token = getFormString(formData, "token");

  if (!token) {
    return {
      status: "error",
      message: t("errors.tokenMissing"),
    };
  }

  try {
    const [session, requestHeaders] = await Promise.all([requireSession(), headers()]);

    await activateInvitation({
      token,
      authUserId: session.user.id,
      actorIpAddress: requestHeaders.get("x-forwarded-for") ?? undefined,
      actorUserAgent: requestHeaders.get("user-agent") ?? undefined,
    });

    revalidatePath("/admin/people");
    revalidatePath("/accept-invite");

    return {
      status: "success",
      message: t("success.active"),
    };
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof InvitationActivationError) {
      return {
        status: "error",
        message: translateActivationError(error.message, t),
      };
    }

    return {
      status: "error",
      message: t("errors.activationFailed"),
    };
  }
}

function getFormString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function translateActivationError(message: string, t: Awaited<ReturnType<typeof getTranslations>>) {
  const key = activationErrorKeys[message];
  return key ? t(key) : message;
}

const activationErrorKeys: Record<string, string> = {
  "Invitation token is invalid.": "errors.invalidToken",
  "Invitation is no longer pending.": "errors.notPending",
  "Invitation has expired.": "errors.expired",
  "Invitation member does not exist.": "errors.memberMissing",
  "Sign in with the invited email address before accepting this invitation.":
    "errors.emailMismatch",
};
