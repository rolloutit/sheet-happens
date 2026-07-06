"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminAppMemberForAction } from "@/src/server/auth/app-access";
import { AuthenticationError, AuthorizationError } from "@/src/server/auth/session";
import {
  changeMemberRole,
  deactivateMember,
  InvitationConflictError,
  inviteMember,
  MemberLifecycleError,
  reactivateMember,
  revokeMemberSessions,
  resendMemberInvitation,
  revokeMemberInvitation,
} from "@/src/server/users";
import type {
  AdminPeopleActionState,
  InviteMemberActionState,
  InviteMemberField,
} from "./actions.types";

const inviteMemberSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  firstName: z.string().trim().min(1, "First name is required."),
  lastName: z.string().trim().min(1, "Last name is required."),
  profile: z.enum(["EMPLOYEE", "CONTRACTOR"], {
    error: "Choose a valid profile.",
  }),
  role: z.enum(["MEMBER", "ADMIN"], {
    error: "Choose a valid role.",
  }),
  defaultCurrencyCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code."),
  timezone: z.string().trim().min(1, "Timezone is required."),
  locale: z.string().trim().min(2, "Locale is required."),
});

export async function inviteMemberAction(
  _previousState: InviteMemberActionState,
  formData: FormData,
): Promise<InviteMemberActionState> {
  const parsed = inviteMemberSchema.safeParse({
    email: getFormString(formData, "email"),
    firstName: getFormString(formData, "firstName"),
    lastName: getFormString(formData, "lastName"),
    profile: getFormString(formData, "profile"),
    role: getFormString(formData, "role"),
    defaultCurrencyCode: getFormString(formData, "defaultCurrencyCode"),
    timezone: getFormString(formData, "timezone"),
    locale: getFormString(formData, "locale"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted fields and try again.",
      fieldErrors: getFieldErrors(parsed.error),
    };
  }

  try {
    const { member: admin } = await requireAdminAppMemberForAction();
    const invitation = await inviteMember({
      ...parsed.data,
      invitedByMemberId: admin.id,
    });

    revalidatePath("/admin/people");

    return {
      status: "success",
      message: `Invitation sent to ${invitation.email}.`,
    };
  } catch (error) {
    if (
      error instanceof InvitationConflictError ||
      error instanceof AuthenticationError ||
      error instanceof AuthorizationError
    ) {
      return {
        status: "error",
        message: error.message,
      };
    }

    return {
      status: "error",
      message: "The invitation could not be sent. Try again later.",
    };
  }
}

export async function resendMemberInviteAction(memberId: string): Promise<AdminPeopleActionState> {
  return runAdminPeopleAction(async (adminId) => {
    const invitation = await resendMemberInvitation({
      memberId,
      actorMemberId: adminId,
    });

    return `Invitation resent to ${invitation.email}.`;
  });
}

export async function revokeMemberInviteAction(memberId: string): Promise<AdminPeopleActionState> {
  return runAdminPeopleAction(async (adminId) => {
    await revokeMemberInvitation({
      memberId,
      actorMemberId: adminId,
    });

    return "Invitation revoked.";
  });
}

export async function deactivateMemberAction(memberId: string): Promise<AdminPeopleActionState> {
  return runAdminPeopleAction(async (adminId) => {
    const result = await deactivateMember({
      memberId,
      actorMemberId: adminId,
    });

    return `Member deactivated. ${formatSessionCount(result.revokedSessionCount)} revoked.`;
  });
}

export async function reactivateMemberAction(memberId: string): Promise<AdminPeopleActionState> {
  return runAdminPeopleAction(async (adminId) => {
    await reactivateMember({
      memberId,
      actorMemberId: adminId,
    });

    return "Member reactivated.";
  });
}

export async function revokeMemberSessionsAction(
  memberId: string,
): Promise<AdminPeopleActionState> {
  return runAdminPeopleAction(async (adminId) => {
    const result = await revokeMemberSessions({
      memberId,
      actorMemberId: adminId,
    });

    return `${formatSessionCount(result.revokedSessionCount)} revoked.`;
  });
}

export async function changeMemberRoleAction(
  memberId: string,
  role: "ADMIN" | "MEMBER",
): Promise<AdminPeopleActionState> {
  return runAdminPeopleAction(async (adminId) => {
    await changeMemberRole({
      memberId,
      actorMemberId: adminId,
      role,
    });

    return `Role changed to ${role === "ADMIN" ? "Admin" : "Member"}.`;
  });
}

function getFormString(formData: FormData, name: InviteMemberField) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function getFieldErrors(error: z.ZodError): InviteMemberActionState["fieldErrors"] {
  const fieldErrors: InviteMemberActionState["fieldErrors"] = {};

  for (const issue of error.issues) {
    const field = issue.path.at(0);

    if (isInviteMemberField(field) && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}

async function runAdminPeopleAction(
  action: (adminId: string) => Promise<string>,
): Promise<AdminPeopleActionState> {
  try {
    const { member: admin } = await requireAdminAppMemberForAction();
    const message = await action(admin.id);

    revalidatePath("/admin/people");

    return {
      status: "success",
      message,
    };
  } catch (error) {
    if (
      error instanceof InvitationConflictError ||
      error instanceof MemberLifecycleError ||
      error instanceof AuthenticationError ||
      error instanceof AuthorizationError
    ) {
      return {
        status: "error",
        message: error.message,
      };
    }

    return {
      status: "error",
      message: "The member action could not be completed. Try again later.",
    };
  }
}

function isInviteMemberField(field: unknown): field is InviteMemberField {
  return (
    field === "email" ||
    field === "firstName" ||
    field === "lastName" ||
    field === "profile" ||
    field === "role" ||
    field === "defaultCurrencyCode" ||
    field === "timezone" ||
    field === "locale"
  );
}

function formatSessionCount(count: number) {
  return `${count} session${count === 1 ? "" : "s"}`;
}
