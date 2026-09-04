"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";

import { isDateValue, parseDateValue } from "@/src/lib/date-values";
import { formatList, formatMonthLabel } from "@/src/lib/formatting";

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
  resetMemberTotp,
  restoreArchivedMember,
  revokeMemberSessions,
  scheduleMemberProfileTransition,
  resendMemberInvitation,
  revokeMemberInvitation,
  softDeleteMember,
  updateMemberDetails,
} from "@/src/server/users";
import { TrackingModeSwitchError, type TrackingModeConflict } from "@/src/server/time-tracking";
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

type AdminPeopleActionsTranslator = Awaited<ReturnType<typeof getTranslations>>;

function createInviteMemberSchema(t: AdminPeopleActionsTranslator) {
  return z.object({
    email: z.string().trim().email(t("validation.validEmail")),
    firstName: z.string().trim().min(1, t("validation.firstNameRequired")),
    lastName: z.string().trim().min(1, t("validation.lastNameRequired")),
    profile: z.enum(["EMPLOYEE", "CONTRACTOR"], {
      error: t("validation.validProfile"),
    }),
    role: z.enum(["MEMBER", "ADMIN"], {
      error: t("validation.validRole"),
    }),
    defaultCurrencyCode: z
      .string()
      .transform(normalizeCurrencyCode)
      .refine(isSupportedCurrencyCode, t("validation.supportedCurrency")),
    timezone: z
      .string()
      .transform(normalizeTimeZone)
      .refine(isSupportedTimeZone, t("validation.supportedTimezone")),
    locale: z
      .string()
      .transform(normalizeLocale)
      .refine(isSupportedLocale, t("validation.supportedLanguage")),
  });
}

function createUpdateMemberDetailsSchema(t: AdminPeopleActionsTranslator) {
  return z.object({
    memberId: z.string().trim().min(1, t("validation.memberIdMissing")),
    firstName: z.string().trim().min(1, t("validation.firstNameRequired")),
    lastName: z.string().trim().min(1, t("validation.lastNameRequired")),
    displayName: z.string().trim().max(120, t("validation.displayNameMax")),
    defaultCurrencyCode: z
      .string()
      .transform(normalizeCurrencyCode)
      .refine(isSupportedCurrencyCode, t("validation.supportedCurrency")),
    timezone: z
      .string()
      .transform(normalizeTimeZone)
      .refine(isSupportedTimeZone, t("validation.supportedTimezone")),
    locale: z
      .string()
      .transform(normalizeLocale)
      .refine(isSupportedLocale, t("validation.supportedLanguage")),
    defaultTrackingMode: z.enum(["TRACKED", "DECLARED"], {
      error: t("validation.validTrackingMode"),
    }),
  });
}

function createScheduleProfileTransitionSchema(t: AdminPeopleActionsTranslator) {
  return z.object({
    memberId: z.string().trim().min(1, t("validation.memberIdMissing")),
    profile: z.enum(["EMPLOYEE", "CONTRACTOR"], {
      error: t("validation.validProfile"),
    }),
    validFrom: z
      .string()
      .trim()
      .refine(isDateInputValue, t("validation.validEffectiveDate"))
      .transform(parseDateInputValue),
    reason: z.string().trim().max(500, t("validation.reasonMax")),
  });
}

export async function inviteMemberAction(
  _previousState: InviteMemberActionState,
  formData: FormData,
): Promise<InviteMemberActionState> {
  const t = await getTranslations("AdminPeopleActions");
  const parsed = createInviteMemberSchema(t).safeParse({
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
      message: t("errors.fixFields"),
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
      message: t("success.invitationSent", { email: invitation.email }),
    };
  } catch (error) {
    if (error instanceof InvitationConflictError) {
      return getInvitationConflictState(error, t);
    }

    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return {
        status: "error",
        message: error.message,
      };
    }

    return {
      status: "error",
      message: t("errors.invitationFailed"),
    };
  }
}

export async function updateMemberDetailsAction(
  input: UpdateMemberDetailsActionInput,
): Promise<UpdateMemberDetailsActionState> {
  const t = await getTranslations("AdminPeopleActions");
  const parsed = createUpdateMemberDetailsSchema(t).safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.fixFields"),
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
      message: result.changed ? t("success.memberUpdated") : t("success.noChanges"),
    };
  } catch (error) {
    if (error instanceof TrackingModeSwitchError) {
      return {
        status: "error",
        message: await formatTrackingModeSwitchError(error, t),
        fieldErrors: {
          defaultTrackingMode: t("errors.trackingModeSwitchField"),
        },
      };
    }

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
      message: t("errors.memberUpdateFailed"),
    };
  }
}

/**
 * `TrackingModeSwitchError` carries the offending project/month pairs as data rather than a
 * sentence, so the message is assembled here where the reader's locale is available. The member
 * default spans projects, so it names both the project and the month.
 */
async function formatTrackingModeSwitchError(
  error: TrackingModeSwitchError,
  t: AdminPeopleActionsTranslator,
) {
  const locale = await getLocale();
  const items = formatList(listConflictLabels(error.conflicts, locale, t), locale);

  return error.targetMode === "DECLARED"
    ? t("errors.trackingModeSwitchToDeclared", { items })
    : t("errors.trackingModeSwitchToTracked", { items });
}

function listConflictLabels(
  conflicts: TrackingModeConflict[],
  locale: string,
  t: AdminPeopleActionsTranslator,
) {
  return [
    ...new Set(
      conflicts.map((conflict) =>
        t("errors.trackingModeConflictItem", {
          project: conflict.projectName,
          month: formatMonthLabel(conflict.periodStart, locale),
        }),
      ),
    ),
  ];
}

export async function scheduleProfileTransitionAction(
  input: ScheduleProfileTransitionActionInput,
): Promise<ScheduleProfileTransitionActionState> {
  const t = await getTranslations("AdminPeopleActions");
  const parsed = createScheduleProfileTransitionSchema(t).safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.fixFields"),
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
        ? t("success.profileChanged")
        : t("success.profileTransitionScheduled", { validFrom: result.validFrom }),
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
      message: t("errors.profileTransitionFailed"),
    };
  }
}

export async function resendMemberInviteAction(memberId: string): Promise<AdminPeopleActionState> {
  const t = await getTranslations("AdminPeopleActions");

  return runAdminPeopleAction(async (adminId) => {
    const invitation = await resendMemberInvitation({
      memberId,
      actorMemberId: adminId,
    });

    return t("success.invitationResent", { email: invitation.email });
  });
}

export async function revokeMemberInviteAction(memberId: string): Promise<AdminPeopleActionState> {
  const t = await getTranslations("AdminPeopleActions");

  return runAdminPeopleAction(async (adminId) => {
    await revokeMemberInvitation({
      memberId,
      actorMemberId: adminId,
    });

    return t("success.invitationRevoked");
  });
}

export async function deactivateMemberAction(memberId: string): Promise<AdminPeopleActionState> {
  const t = await getTranslations("AdminPeopleActions");

  return runAdminPeopleAction(async (adminId) => {
    const result = await deactivateMember({
      memberId,
      actorMemberId: adminId,
    });

    return t("success.memberDeactivated", {
      sessions: formatSessionCount(result.revokedSessionCount, t),
    });
  });
}

export async function reactivateMemberAction(memberId: string): Promise<AdminPeopleActionState> {
  const t = await getTranslations("AdminPeopleActions");

  return runAdminPeopleAction(async (adminId) => {
    await reactivateMember({
      memberId,
      actorMemberId: adminId,
    });

    return t("success.memberReactivated");
  });
}

export async function restoreArchivedMemberAction(
  memberId: string,
): Promise<AdminPeopleActionState> {
  const t = await getTranslations("AdminPeopleActions");

  return runAdminPeopleAction(async (adminId) => {
    const result = await restoreArchivedMember({
      memberId,
      actorMemberId: adminId,
    });

    return result.invitationSent
      ? t("success.memberRestoredWithInvitation", { email: result.email })
      : t("success.memberRestored");
  });
}

export async function softDeleteMemberAction(memberId: string): Promise<AdminPeopleActionState> {
  const t = await getTranslations("AdminPeopleActions");

  return runAdminPeopleAction(async (adminId) => {
    const result = await softDeleteMember({
      memberId,
      actorMemberId: adminId,
    });

    return t("success.memberArchived", {
      sessions: formatSessionCount(result.revokedSessionCount, t),
      invitations: formatInvitationCount(result.revokedInvitationCount, t),
    });
  });
}

export async function revokeMemberSessionsAction(
  memberId: string,
): Promise<AdminPeopleActionState> {
  const t = await getTranslations("AdminPeopleActions");

  return runAdminPeopleAction(async (adminId) => {
    const result = await revokeMemberSessions({
      memberId,
      actorMemberId: adminId,
    });

    return t("success.sessionsRevoked", {
      sessions: formatSessionCount(result.revokedSessionCount, t),
    });
  });
}

export async function resetMemberTotpAction(memberId: string): Promise<AdminPeopleActionState> {
  const t = await getTranslations("AdminPeopleActions");

  return runAdminPeopleAction(async (adminId) => {
    const result = await resetMemberTotp({
      memberId,
      actorMemberId: adminId,
    });

    const resetMessage = result.hadTotp
      ? t("success.authenticatorReset")
      : t("success.noAuthenticator");

    return t("success.authenticatorResetResult", {
      resetMessage,
      sessions: formatSessionCount(result.revokedSessionCount, t),
    });
  });
}

export async function changeMemberRoleAction(
  memberId: string,
  role: "ADMIN" | "MEMBER",
): Promise<AdminPeopleActionState> {
  const t = await getTranslations("AdminPeopleActions");

  return runAdminPeopleAction(async (adminId) => {
    await changeMemberRole({
      memberId,
      actorMemberId: adminId,
      role,
    });

    return t("success.roleChanged", {
      role: role === "ADMIN" ? t("roles.admin") : t("roles.member"),
    });
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

function getInvitationConflictState(
  error: InvitationConflictError,
  t: AdminPeopleActionsTranslator,
): InviteMemberActionState {
  if (error.code === "PENDING_INVITATION") {
    return {
      status: "error",
      message: t("errors.fixFields"),
      fieldErrors: {
        email: t("validation.emailPendingInvitation"),
      },
    };
  }

  if (error.code === "EXISTING_MEMBER") {
    return {
      status: "error",
      message: t("errors.fixFields"),
      fieldErrors: {
        email: t("validation.emailAlreadyMember"),
      },
    };
  }

  return {
    status: "error",
    message: t("errors.invitationConflict"),
  };
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
  const t = await getTranslations("AdminPeopleActions");

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
      message: t("errors.memberActionFailed"),
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
    field === "locale" ||
    field === "defaultTrackingMode"
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

function formatSessionCount(count: number, t: Awaited<ReturnType<typeof getTranslations>>) {
  return t("counts.sessions", { count });
}

function formatInvitationCount(count: number, t: Awaited<ReturnType<typeof getTranslations>>) {
  return t("counts.invitations", { count });
}

/**
 * Date validity for this module's schemas, where a date is always required.
 *
 * Deliberately stricter than the same-named helper in `app/admin/projects` and
 * `app/admin/rates`, which accept `""` to mean "no date". Keeping the difference explicit
 * and local is what stops a future consolidation from quietly making required dates
 * optional, or vice versa.
 */
function isDateInputValue(value: string) {
  return isDateValue(value);
}

/**
 * Turns a validated `YYYY-MM-DD` into the UTC-midnight `Date` the domain layer expects.
 * Only ever reached after `isDateInputValue`, so the non-null assertion holds.
 */
function parseDateInputValue(value: string) {
  return parseDateValue(value)!;
}
