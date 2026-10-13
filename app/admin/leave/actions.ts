"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import type { LeaveActionState } from "@/app/leave/action-state";
import {
  getLeaveRequestMetadata,
  leaveErrorState,
  leaveFormFieldErrors,
  readLeaveFile,
  readLeaveForm,
} from "@/app/leave/leave-action-helpers";
import { requireAdminAppMemberForAction } from "@/src/server/auth/app-access";
import {
  createLeaveForAdmin,
  deleteLeaveForAdmin,
  LeaveError,
  removeLeaveAttachmentForAdmin,
  setLeaveHrProcessed,
  updateLeaveForAdmin,
} from "@/src/server/leave";

const leaveIdSchema = z.string().uuid();

function revalidateLeave() {
  revalidatePath("/admin/leave");
  revalidatePath("/leave");
}

export async function createLeaveAction(
  _previousState: LeaveActionState,
  formData: FormData,
): Promise<LeaveActionState> {
  const t = await getTranslations("Leave");
  const memberId = leaveIdSchema.safeParse(formData.get("memberId"));
  const parsed = readLeaveForm(formData);

  if (!memberId.success || !parsed.success) {
    return {
      status: "error",
      message: t("errors.checkFields"),
      fieldErrors: {
        ...(parsed.success ? {} : leaveFormFieldErrors(parsed.error.issues, t)),
        ...(memberId.success ? {} : { memberId: t("errors.memberRequired") }),
      },
    };
  }

  try {
    const { member } = await requireAdminAppMemberForAction();
    const file = parsed.data.type === "SICK" ? await readLeaveFile(formData) : null;
    await createLeaveForAdmin({
      ...parsed.data,
      memberId: memberId.data,
      actorMemberId: member.id,
      file,
      requestMetadata: await getLeaveRequestMetadata(),
    });

    revalidateLeave();
    return { status: "success", message: t("form.created") };
  } catch (error) {
    // The shared message speaks to an employee recording their own leave; here it is the pick.
    if (error instanceof LeaveError && error.code === "EMPLOYEE_REQUIRED") {
      const message = t("errors.memberNotEmployee");
      return { status: "error", message, fieldErrors: { memberId: message } };
    }
    return leaveErrorState(error, t, "admin create");
  }
}

export async function updateLeaveAction(
  _previousState: LeaveActionState,
  formData: FormData,
): Promise<LeaveActionState> {
  const t = await getTranslations("Leave");
  const leaveId = leaveIdSchema.safeParse(formData.get("leaveId"));
  const parsed = readLeaveForm(formData);

  if (!leaveId.success) return { status: "error", message: t("errors.notFound") };
  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.checkFields"),
      fieldErrors: leaveFormFieldErrors(parsed.error.issues, t),
    };
  }

  try {
    const { member } = await requireAdminAppMemberForAction();
    await updateLeaveForAdmin({
      ...parsed.data,
      leaveId: leaveId.data,
      actorMemberId: member.id,
      requestMetadata: await getLeaveRequestMetadata(),
    });

    revalidateLeave();
    return { status: "success", message: t("form.updated") };
  } catch (error) {
    return leaveErrorState(error, t, "update");
  }
}

export async function deleteLeaveAction(input: { leaveId: string }): Promise<LeaveActionState> {
  const t = await getTranslations("Leave");
  const leaveId = leaveIdSchema.safeParse(input.leaveId);
  if (!leaveId.success) return { status: "error", message: t("errors.notFound") };

  try {
    const { member } = await requireAdminAppMemberForAction();
    await deleteLeaveForAdmin({
      leaveId: leaveId.data,
      actorMemberId: member.id,
      requestMetadata: await getLeaveRequestMetadata(),
    });

    revalidateLeave();
    return { status: "success", message: t("admin.deleted") };
  } catch (error) {
    return leaveErrorState(error, t, "delete");
  }
}

const hrProcessedSchema = z.object({
  leaveIds: z.array(leaveIdSchema).min(1).max(200),
  processed: z.boolean(),
});

export async function setLeaveHrProcessedAction(input: {
  leaveIds: string[];
  processed: boolean;
}): Promise<LeaveActionState> {
  const t = await getTranslations("Leave");
  const parsed = hrProcessedSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: t("errors.notFound") };

  try {
    const { member } = await requireAdminAppMemberForAction();
    const result = await setLeaveHrProcessed({
      ...parsed.data,
      actorMemberId: member.id,
      requestMetadata: await getLeaveRequestMetadata(),
    });

    revalidateLeave();
    return {
      status: "success",
      message: parsed.data.processed
        ? t("admin.hr.marked", { count: result.changed })
        : t("admin.hr.unmarked", { count: result.changed }),
    };
  } catch (error) {
    return leaveErrorState(error, t, "hr processed");
  }
}

export async function removeLeaveAttachmentAction(input: {
  leaveId: string;
}): Promise<LeaveActionState> {
  const t = await getTranslations("Leave");
  const leaveId = leaveIdSchema.safeParse(input.leaveId);
  if (!leaveId.success) return { status: "error", message: t("errors.notFound") };

  try {
    const { member } = await requireAdminAppMemberForAction();
    await removeLeaveAttachmentForAdmin({
      leaveId: leaveId.data,
      actorMemberId: member.id,
      requestMetadata: await getLeaveRequestMetadata(),
    });

    revalidateLeave();
    return { status: "success", message: t("attachment.removed") };
  } catch (error) {
    return leaveErrorState(error, t, "attachment removal");
  }
}
