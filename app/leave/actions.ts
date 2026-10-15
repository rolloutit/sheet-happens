"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireActiveAppMemberForAction } from "@/src/server/auth/app-access";
import { AuthorizationError } from "@/src/server/auth/session";
import { createLeave, uploadLeaveAttachment } from "@/src/server/leave";
import type { LeaveActionState } from "./action-state";
import {
  getLeaveRequestMetadata,
  leaveErrorState,
  leaveFormFieldErrors,
  readLeaveFile,
  readLeaveForm,
} from "./leave-action-helpers";

export async function createLeaveAction(
  _previousState: LeaveActionState,
  formData: FormData,
): Promise<LeaveActionState> {
  const t = await getTranslations("Leave");
  const parsed = readLeaveForm(formData);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.checkFields"),
      fieldErrors: leaveFormFieldErrors(parsed.error.issues, t),
    };
  }

  try {
    const { member } = await requireActiveAppMemberForAction();
    if (member.currentProfile !== "EMPLOYEE") {
      throw new AuthorizationError("Employee profile required.");
    }

    const file = parsed.data.type === "SICK" ? await readLeaveFile(formData) : null;
    await createLeave({
      ...parsed.data,
      memberId: member.id,
      file,
      requestMetadata: await getLeaveRequestMetadata(),
    });

    revalidatePath("/leave");
    revalidatePath("/admin/leave");
    return { status: "success", message: t("form.created") };
  } catch (error) {
    return leaveErrorState(error, t, "create");
  }
}

export async function uploadLeaveAttachmentAction(
  _previousState: LeaveActionState,
  formData: FormData,
): Promise<LeaveActionState> {
  const t = await getTranslations("Leave");
  const leaveId = z.string().uuid().safeParse(formData.get("leaveId"));
  const file = await readLeaveFile(formData);

  if (!leaveId.success) return { status: "error", message: t("errors.notFound") };
  if (!file) {
    const message = t("errors.attachmentRequired");
    return { status: "error", message, fieldErrors: { file: message } };
  }

  try {
    const { member } = await requireActiveAppMemberForAction();
    const result = await uploadLeaveAttachment({
      leaveId: leaveId.data,
      viewer: { memberId: member.id, isAdmin: member.role === "ADMIN" },
      file,
      requestMetadata: await getLeaveRequestMetadata(),
    });

    revalidatePath("/leave");
    revalidatePath("/admin/leave");
    return {
      status: "success",
      message: result.replaced ? t("attachment.replaced") : t("attachment.uploaded"),
    };
  } catch (error) {
    return leaveErrorState(error, t, "attachment upload");
  }
}
