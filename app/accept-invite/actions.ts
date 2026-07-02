"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { AuthenticationError, requireSession } from "@/src/server/auth/session";
import { activateInvitation, InvitationActivationError } from "@/src/server/users";
import type { ActivateInvitationActionState } from "./actions.types";

export async function activateInvitationAction(
  _previousState: ActivateInvitationActionState,
  formData: FormData,
): Promise<ActivateInvitationActionState> {
  const token = getFormString(formData, "token");

  if (!token) {
    return {
      status: "error",
      message: "Invitation token is missing.",
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
      message: "Your Sheet Happens account is active.",
    };
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof InvitationActivationError) {
      return {
        status: "error",
        message: error.message,
      };
    }

    return {
      status: "error",
      message: "The invitation could not be activated. Try again later.",
    };
  }
}

function getFormString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
