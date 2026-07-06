"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminAppMemberForAction } from "@/src/server/auth/app-access";
import { AuthenticationError, AuthorizationError } from "@/src/server/auth/session";
import {
  isSupportedCurrencyCode,
  isSupportedLocale,
  isSupportedTimeZone,
  normalizeCurrencyCode,
  normalizeLocale,
  normalizeTimeZone,
} from "@/src/lib/member-preferences";
import {
  changeMemberRole,
  deactivateMember,
  InvitationConflictError,
  inviteMember,
  MemberDetailsError,
  MemberLifecycleError,
  MemberProfileTransitionError,
  reactivateMember,
  revokeMemberSessions,
  scheduleMemberProfileTransition,
  resendMemberInvitation,
  revokeMemberInvitation,
  updateMemberDetails,
} from "@/src/server/users";
import type {
  AdminPeopleActionState,
  InviteMemberActionState,
  InviteMemberField,
  ScheduleProfileTransitionActionInput,
  ScheduleProfileTransitionActionState,
  ScheduleProfileTransitionField,
  UpdateMemberDetailsActionInput,
  UpdateMemberDetailsActionState,
  UpdateMemberDetailsField,
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
    .transform(normalizeCurrencyCode)
    .refine(isSupportedCurrencyCode, "Choose a supported currency."),
  timezone: z
    .string()
    .transform(normalizeTimeZone)
    .refine(isSupportedTimeZone, "Choose a supported timezone."),
  locale: z
    .string()
    .transform(normalizeLocale)
    .refine(isSupportedLocale, "Choose a supported language."),
});

const updateMemberDetailsSchema = z.object({
  memberId: z.string().trim().min(1, "Member id is missing."),
  firstName: z.string().trim().min(1, "First name is required."),
  lastName: z.string().trim().min(1, "Last name is required."),
  displayName: z.string().trim().max(120, "Display name must be 120 characters or less."),
  defaultCurrencyCode: z
    .string()
    .transform(normalizeCurrencyCode)
    .refine(isSupportedCurrencyCode, "Choose a supported currency."),
  timezone: z
    .string()
    .transform(normalizeTimeZone)
    .refine(isSupportedTimeZone, "Choose a supported timezone."),
  locale: z
    .string()
    .transform(normalizeLocale)
    .refine(isSupportedLocale, "Choose a supported language."),
});

const scheduleProfileTransitionSchema = z.object({
  memberId: z.string().trim().min(1, "Member id is missing."),
  profile: z.enum(["EMPLOYEE", "CONTRACTOR"], {
    error: "Choose a valid profile.",
  }),
  validFrom: z
    .string()
    .trim()
    .refine(isDateInputValue, "Choose a valid effective date.")
    .transform(parseDateInputValue),
  reason: z.string().trim().max(500, "Reason must be 500 characters or less."),
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

export async function updateMemberDetailsAction(
  input: UpdateMemberDetailsActionInput,
): Promise<UpdateMemberDetailsActionState> {
  const parsed = updateMemberDetailsSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted fields and try again.",
      fieldErrors: getUpdateMemberDetailsFieldErrors(parsed.error),
    };
  }

  try {
    const { member: admin } = await requireAdminAppMemberForAction();
    const result = await updateMemberDetails({
      ...parsed.data,
      actorMemberId: admin.id,
    });

    revalidatePath("/admin/people");

    return {
      status: "success",
      message: result.changed ? "Member details updated." : "No changes to save.",
    };
  } catch (error) {
    if (
      error instanceof MemberDetailsError ||
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
      message: "The member details could not be updated. Try again later.",
    };
  }
}

export async function scheduleProfileTransitionAction(
  input: ScheduleProfileTransitionActionInput,
): Promise<ScheduleProfileTransitionActionState> {
  const parsed = scheduleProfileTransitionSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted fields and try again.",
      fieldErrors: getScheduleProfileTransitionFieldErrors(parsed.error),
    };
  }

  try {
    const { member: admin } = await requireAdminAppMemberForAction();
    const result = await scheduleMemberProfileTransition({
      ...parsed.data,
      actorMemberId: admin.id,
    });

    revalidatePath("/admin/people");

    return {
      status: "success",
      message: result.immediate
        ? "Profile changed."
        : `Profile transition scheduled for ${result.validFrom}.`,
    };
  } catch (error) {
    if (
      error instanceof MemberProfileTransitionError ||
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
      message: "The profile transition could not be scheduled. Try again later.",
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

function getUpdateMemberDetailsFieldErrors(
  error: z.ZodError,
): UpdateMemberDetailsActionState["fieldErrors"] {
  const fieldErrors: UpdateMemberDetailsActionState["fieldErrors"] = {};

  for (const issue of error.issues) {
    const field = issue.path.at(0);

    if (isUpdateMemberDetailsField(field) && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}

function getScheduleProfileTransitionFieldErrors(
  error: z.ZodError,
): ScheduleProfileTransitionActionState["fieldErrors"] {
  const fieldErrors: ScheduleProfileTransitionActionState["fieldErrors"] = {};

  for (const issue of error.issues) {
    const field = issue.path.at(0);

    if (isScheduleProfileTransitionField(field) && !fieldErrors[field]) {
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
      error instanceof MemberDetailsError ||
      error instanceof MemberLifecycleError ||
      error instanceof MemberProfileTransitionError ||
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

function isUpdateMemberDetailsField(field: unknown): field is UpdateMemberDetailsField {
  return (
    field === "firstName" ||
    field === "lastName" ||
    field === "displayName" ||
    field === "defaultCurrencyCode" ||
    field === "timezone" ||
    field === "locale"
  );
}

function isScheduleProfileTransitionField(field: unknown): field is ScheduleProfileTransitionField {
  return field === "profile" || field === "validFrom" || field === "reason";
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

function isDateInputValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = parseDateInputValue(value);
  return !Number.isNaN(date.valueOf()) && formatDateInputValue(date) === value;
}

function parseDateInputValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}
