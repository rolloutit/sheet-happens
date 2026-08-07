"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { isDateValue } from "@/src/lib/date-values";

import { requireAdminAppMemberForAction } from "@/src/server/auth/app-access";
import { AuthenticationError, AuthorizationError } from "@/src/server/auth/session";
import { Prisma } from "@/src/server/db/generated/client";
import { PROJECT_COLOR_TOKENS } from "@/src/lib/project-colors";
import {
  addProjectToGroup,
  archiveProjectGroup,
  assignMemberToProject,
  archiveProject,
  bulkAssignMembersToProjects,
  changeProjectStatus,
  closeProjectAssignment,
  createProject,
  createProjectGroup,
  ProjectAssignmentError,
  ProjectGroupManagementError,
  ProjectManagementError,
  removeProjectFromGroup,
  updateProjectAssignment,
  updateProjectGroup,
  updateProject,
  type ProjectRequestMetadata,
} from "@/src/server/projects";
import type {
  AddProjectToGroupActionInput,
  AssignProjectMemberActionInput,
  BulkAssignProjectMembersActionInput,
  CloseProjectAssignmentActionInput,
  CreateProjectGroupActionInput,
  ProjectAssignmentActionState,
  ProjectAssignmentFormField,
  ProjectActionState,
  ProjectBulkAssignmentActionState,
  ProjectBulkAssignmentFormField,
  ProjectFormField,
  ProjectGroupActionState,
  ProjectGroupFormField,
  ProjectGroupProjectActionState,
  ProjectGroupProjectFormField,
  RemoveProjectFromGroupActionInput,
  UpdateProjectAssignmentActionInput,
  UpdateProjectGroupActionInput,
  UpdateProjectActionInput,
} from "./actions.types";

type AdminProjectsActionsTranslator = Awaited<ReturnType<typeof getTranslations>>;

function createProjectDateSchema(t: AdminProjectsActionsTranslator) {
  return z.string().trim().refine(isDateInputValue, t("validation.validDate"));
}

function createProjectFormSchema(t: AdminProjectsActionsTranslator) {
  const projectDateSchema = createProjectDateSchema(t);

  return z
    .object({
      name: z.string().trim().min(1, t("validation.projectNameRequired")),
      slug: z.string().trim().max(80, t("validation.slugMax")),
      colorToken: z.enum(PROJECT_COLOR_TOKENS, t("validation.supportedProjectColor")),
      startsOn: projectDateSchema,
      endsOn: projectDateSchema,
      isInternal: z.boolean(),
      notes: z.string().trim().max(1000, t("validation.notesMax")),
    })
    .superRefine((value, context) => {
      if (!value.startsOn || !value.endsOn) return;

      if (value.endsOn < value.startsOn) {
        context.addIssue({
          code: "custom",
          message: t("validation.projectEndBeforeStart"),
          path: ["endsOn"],
        });
      }
    });
}

function createAssignmentBaseSchema(t: AdminProjectsActionsTranslator) {
  return z.object({
    memberId: z.string().trim().min(1, t("validation.chooseMember")),
    validFrom: z
      .string()
      .trim()
      .min(1, t("validation.assignmentStartRequired"))
      .refine(isDateInputValue, t("validation.validStartDate")),
    validTo: createProjectDateSchema(t),
    active: z.boolean(),
    notes: z.string().trim().max(1000, t("validation.notesMax")),
  });
}

function createAssignmentFormSchema(t: AdminProjectsActionsTranslator) {
  return createAssignmentBaseSchema(t).superRefine(validateAssignmentDateRange(t));
}

function createUpdateAssignmentFormSchema(t: AdminProjectsActionsTranslator) {
  return createAssignmentBaseSchema(t)
    .omit({
      memberId: true,
    })
    .superRefine(validateAssignmentDateRange(t));
}

function validateAssignmentDateRange(t: AdminProjectsActionsTranslator) {
  return (value: { validFrom: string; validTo: string }, context: z.RefinementCtx) => {
    if (!value.validTo) return;

    if (value.validTo < value.validFrom) {
      context.addIssue({
        code: "custom",
        message: t("validation.assignmentEndBeforeStart"),
        path: ["validTo"],
      });
    }
  };
}

function createCloseAssignmentSchema(t: AdminProjectsActionsTranslator) {
  return z.object({
    assignmentId: z.string().trim().min(1, t("validation.assignmentIdMissing")),
    validTo: z
      .string()
      .trim()
      .min(1, t("validation.assignmentEndRequired"))
      .refine(isDateInputValue, t("validation.validEndDate")),
  });
}

function createBulkAssignmentFormSchema(t: AdminProjectsActionsTranslator) {
  return z
    .object({
      memberIds: z.array(z.string().trim().min(1)).min(1, t("validation.chooseAtLeastOneMember")),
      projectIds: z.array(z.string().trim().min(1)).min(1, t("validation.chooseAtLeastOneProject")),
      validFrom: z
        .string()
        .trim()
        .min(1, t("validation.assignmentStartRequired"))
        .refine(isDateInputValue, t("validation.validStartDate")),
      validTo: createProjectDateSchema(t),
      active: z.boolean(),
      notes: z.string().trim().max(1000, t("validation.notesMax")),
    })
    .superRefine((value, context) => {
      validateAssignmentDateRange(t)(value, context);

      if (new Set(value.memberIds).size * new Set(value.projectIds).size > 200) {
        context.addIssue({
          code: "custom",
          message: t("validation.bulkAssignmentLimit"),
          path: ["projectIds"],
        });
      }
    });
}

function createProjectGroupFormSchema(t: AdminProjectsActionsTranslator) {
  return z.object({
    name: z.string().trim().min(1, t("validation.groupNameRequired")),
    slug: z.string().trim().max(80, t("validation.slugMax")),
    description: z.string().trim().max(1000, t("validation.descriptionMax")),
    active: z.boolean(),
  });
}

function createProjectGroupProjectSchema(t: AdminProjectsActionsTranslator) {
  return z.object({
    projectGroupId: z.string().trim().min(1, t("validation.projectGroupIdMissing")),
    projectId: z.string().trim().min(1, t("validation.chooseProject")),
  });
}

export async function createProjectAction(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const t = await getTranslations("AdminProjectsActions");
  const parsed = createProjectFormSchema(t).safeParse({
    name: getFormString(formData, "name"),
    slug: getFormString(formData, "slug"),
    colorToken: getFormString(formData, "colorToken"),
    startsOn: getFormString(formData, "startsOn"),
    endsOn: getFormString(formData, "endsOn"),
    isInternal: formData.get("isInternal") === "true",
    notes: getFormString(formData, "notes"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.fixFields"),
      fieldErrors: getProjectFieldErrors(parsed.error),
    };
  }

  try {
    const { member: admin } = await requireAdminAppMemberForAction();
    await createProject({
      ...parsed.data,
      startsOn: parseOptionalDate(parsed.data.startsOn),
      endsOn: parseOptionalDate(parsed.data.endsOn),
      actorMemberId: admin.id,
      requestMetadata: await getProjectRequestMetadata(),
    });

    revalidatePath("/admin/projects");

    return {
      status: "success",
      message: t("success.projectCreated"),
    };
  } catch (error) {
    return mapProjectActionError(error, t("errors.projectCreateFailed"), t);
  }
}

export async function updateProjectAction(
  input: UpdateProjectActionInput,
): Promise<ProjectActionState> {
  const t = await getTranslations("AdminProjectsActions");
  const parsed = createProjectFormSchema(t).safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.fixFields"),
      fieldErrors: getProjectFieldErrors(parsed.error),
    };
  }

  try {
    const { member: admin } = await requireAdminAppMemberForAction();
    const result = await updateProject({
      ...parsed.data,
      projectId: input.projectId,
      startsOn: parseOptionalDate(parsed.data.startsOn),
      endsOn: parseOptionalDate(parsed.data.endsOn),
      actorMemberId: admin.id,
      requestMetadata: await getProjectRequestMetadata(),
    });

    revalidatePath("/admin/projects");

    return {
      status: "success",
      message: result.changed ? t("success.projectUpdated") : t("success.noChanges"),
    };
  } catch (error) {
    return mapProjectActionError(error, t("errors.projectUpdateFailed"), t);
  }
}

export async function setProjectActiveAction(
  projectId: string,
  active: boolean,
): Promise<ProjectActionState> {
  const t = await getTranslations("AdminProjectsActions");

  try {
    const { member: admin } = await requireAdminAppMemberForAction();
    const result = await changeProjectStatus({
      projectId,
      status: active ? "ACTIVE" : "INACTIVE",
      actorMemberId: admin.id,
      requestMetadata: await getProjectRequestMetadata(),
    });

    revalidatePath("/admin/projects");

    return {
      status: "success",
      message: result.changed
        ? active
          ? t("success.projectActivated")
          : t("success.projectDeactivated")
        : t("success.projectStatusUnchanged"),
    };
  } catch (error) {
    return mapProjectActionError(error, t("errors.projectStatusFailed"), t);
  }
}

export async function archiveProjectAction(projectId: string): Promise<ProjectActionState> {
  const t = await getTranslations("AdminProjectsActions");

  try {
    const { member: admin } = await requireAdminAppMemberForAction();
    await archiveProject({
      projectId,
      actorMemberId: admin.id,
      requestMetadata: await getProjectRequestMetadata(),
    });

    revalidatePath("/admin/projects");

    return {
      status: "success",
      message: t("success.projectArchived"),
    };
  } catch (error) {
    return mapProjectActionError(error, t("errors.projectArchiveFailed"), t);
  }
}

export async function assignProjectMemberAction(
  input: AssignProjectMemberActionInput,
): Promise<ProjectAssignmentActionState> {
  const t = await getTranslations("AdminProjectsActions");
  const parsed = createAssignmentFormSchema(t).safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.fixAssignmentFields"),
      fieldErrors: getProjectAssignmentFieldErrors(parsed.error),
    };
  }

  try {
    const { member: admin } = await requireAdminAppMemberForAction();
    await assignMemberToProject({
      ...parsed.data,
      projectId: input.projectId,
      validFrom: parseRequiredDate(parsed.data.validFrom),
      validTo: parseOptionalDate(parsed.data.validTo),
      actorMemberId: admin.id,
      requestMetadata: await getProjectRequestMetadata(),
    });

    revalidatePath("/admin/projects");

    return {
      status: "success",
      message: t("success.memberAssigned"),
    };
  } catch (error) {
    return mapProjectAssignmentActionError(error, t("errors.assignmentCreateFailed"), t);
  }
}

export async function bulkAssignProjectMembersAction(
  input: BulkAssignProjectMembersActionInput,
): Promise<ProjectBulkAssignmentActionState> {
  const t = await getTranslations("AdminProjectsActions");
  const parsed = createBulkAssignmentFormSchema(t).safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.fixBulkAssignmentFields"),
      fieldErrors: getProjectBulkAssignmentFieldErrors(parsed.error),
    };
  }

  try {
    const { member: admin } = await requireAdminAppMemberForAction();
    const result = await bulkAssignMembersToProjects({
      ...parsed.data,
      validFrom: parseRequiredDate(parsed.data.validFrom),
      validTo: parseOptionalDate(parsed.data.validTo),
      actorMemberId: admin.id,
      requestMetadata: await getProjectRequestMetadata(),
    });

    revalidatePath("/admin/projects");
    revalidatePath("/admin/rates");

    if (result.createdCount === 0) {
      return {
        status: "success",
        message: t("success.noBulkAssignmentsCreated"),
        createdCount: 0,
        skippedDuplicateCount: result.skippedDuplicateCount,
      };
    }

    return {
      status: "success",
      message:
        result.skippedDuplicateCount > 0
          ? t("success.bulkAssignmentsCreatedWithSkipped", {
              created: result.createdCount,
              skipped: result.skippedDuplicateCount,
            })
          : t("success.bulkAssignmentsCreated", { count: result.createdCount }),
      createdCount: result.createdCount,
      skippedDuplicateCount: result.skippedDuplicateCount,
    };
  } catch (error) {
    return mapProjectBulkAssignmentActionError(error, t("errors.bulkAssignmentCreateFailed"), t);
  }
}

export async function updateProjectAssignmentAction(
  input: UpdateProjectAssignmentActionInput,
): Promise<ProjectAssignmentActionState> {
  const t = await getTranslations("AdminProjectsActions");
  const parsed = createUpdateAssignmentFormSchema(t).safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.fixAssignmentFields"),
      fieldErrors: getProjectAssignmentFieldErrors(parsed.error),
    };
  }

  try {
    const { member: admin } = await requireAdminAppMemberForAction();
    const result = await updateProjectAssignment({
      ...parsed.data,
      assignmentId: input.assignmentId,
      validFrom: parseRequiredDate(parsed.data.validFrom),
      validTo: parseOptionalDate(parsed.data.validTo),
      actorMemberId: admin.id,
      requestMetadata: await getProjectRequestMetadata(),
    });

    revalidatePath("/admin/projects");

    return {
      status: "success",
      message: result.changed ? t("success.assignmentUpdated") : t("success.noAssignmentChanges"),
    };
  } catch (error) {
    return mapProjectAssignmentActionError(error, t("errors.assignmentUpdateFailed"), t);
  }
}

export async function closeProjectAssignmentAction(
  input: CloseProjectAssignmentActionInput,
): Promise<ProjectAssignmentActionState> {
  const t = await getTranslations("AdminProjectsActions");
  const parsed = createCloseAssignmentSchema(t).safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.fixAssignmentFields"),
      fieldErrors: getProjectAssignmentFieldErrors(parsed.error),
    };
  }

  try {
    const { member: admin } = await requireAdminAppMemberForAction();
    await closeProjectAssignment({
      assignmentId: parsed.data.assignmentId,
      validTo: parseRequiredDate(parsed.data.validTo),
      actorMemberId: admin.id,
      requestMetadata: await getProjectRequestMetadata(),
    });

    revalidatePath("/admin/projects");

    return {
      status: "success",
      message: t("success.assignmentEnded"),
    };
  } catch (error) {
    return mapProjectAssignmentActionError(error, t("errors.assignmentEndFailed"), t);
  }
}

export async function createProjectGroupAction(
  input: CreateProjectGroupActionInput,
): Promise<ProjectGroupActionState> {
  const t = await getTranslations("AdminProjectsActions");
  const parsed = createProjectGroupFormSchema(t).safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.fixGroupFields"),
      fieldErrors: getProjectGroupFieldErrors(parsed.error),
    };
  }

  try {
    const { member: admin } = await requireAdminAppMemberForAction();
    await createProjectGroup({
      ...parsed.data,
      actorMemberId: admin.id,
      requestMetadata: await getProjectRequestMetadata(),
    });

    revalidatePath("/admin/projects");
    revalidatePath("/admin/rates");

    return {
      status: "success",
      message: t("success.groupCreated"),
    };
  } catch (error) {
    return mapProjectGroupActionError(error, t("errors.groupCreateFailed"), t);
  }
}

export async function updateProjectGroupAction(
  input: UpdateProjectGroupActionInput,
): Promise<ProjectGroupActionState> {
  const t = await getTranslations("AdminProjectsActions");
  const parsed = createProjectGroupFormSchema(t).safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.fixGroupFields"),
      fieldErrors: getProjectGroupFieldErrors(parsed.error),
    };
  }

  try {
    const { member: admin } = await requireAdminAppMemberForAction();
    const result = await updateProjectGroup({
      ...parsed.data,
      projectGroupId: input.projectGroupId,
      actorMemberId: admin.id,
      requestMetadata: await getProjectRequestMetadata(),
    });

    revalidatePath("/admin/projects");
    revalidatePath("/admin/rates");

    return {
      status: "success",
      message: result.changed ? t("success.groupUpdated") : t("success.noGroupChanges"),
    };
  } catch (error) {
    return mapProjectGroupActionError(error, t("errors.groupUpdateFailed"), t);
  }
}

export async function archiveProjectGroupAction(
  projectGroupId: string,
): Promise<ProjectGroupActionState> {
  const t = await getTranslations("AdminProjectsActions");

  try {
    const { member: admin } = await requireAdminAppMemberForAction();
    await archiveProjectGroup({
      projectGroupId,
      actorMemberId: admin.id,
      requestMetadata: await getProjectRequestMetadata(),
    });

    revalidatePath("/admin/projects");
    revalidatePath("/admin/rates");

    return {
      status: "success",
      message: t("success.groupArchived"),
    };
  } catch (error) {
    return mapProjectGroupActionError(error, t("errors.groupArchiveFailed"), t);
  }
}

export async function addProjectToGroupAction(
  input: AddProjectToGroupActionInput,
): Promise<ProjectGroupProjectActionState> {
  const t = await getTranslations("AdminProjectsActions");
  const parsed = createProjectGroupProjectSchema(t).safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.fixGroupFields"),
      fieldErrors: getProjectGroupProjectFieldErrors(parsed.error),
    };
  }

  try {
    const { member: admin } = await requireAdminAppMemberForAction();
    const result = await addProjectToGroup({
      ...parsed.data,
      actorMemberId: admin.id,
      requestMetadata: await getProjectRequestMetadata(),
    });

    revalidatePath("/admin/projects");
    revalidatePath("/admin/rates");

    return {
      status: "success",
      message: result.changed
        ? t("success.projectAddedToGroup")
        : t("success.projectAlreadyInGroup"),
    };
  } catch (error) {
    return mapProjectGroupProjectActionError(error, t("errors.addProjectToGroupFailed"), t);
  }
}

export async function removeProjectFromGroupAction(
  input: RemoveProjectFromGroupActionInput,
): Promise<ProjectGroupProjectActionState> {
  const t = await getTranslations("AdminProjectsActions");
  const parsed = createProjectGroupProjectSchema(t).safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: t("errors.fixGroupFields"),
      fieldErrors: getProjectGroupProjectFieldErrors(parsed.error),
    };
  }

  try {
    const { member: admin } = await requireAdminAppMemberForAction();
    const result = await removeProjectFromGroup({
      ...parsed.data,
      actorMemberId: admin.id,
      requestMetadata: await getProjectRequestMetadata(),
    });

    revalidatePath("/admin/projects");
    revalidatePath("/admin/rates");

    return {
      status: "success",
      message: result.changed
        ? t("success.projectRemovedFromGroup")
        : t("success.projectNotInGroup"),
    };
  } catch (error) {
    return mapProjectGroupProjectActionError(error, t("errors.removeProjectFromGroupFailed"), t);
  }
}

function getFormString(formData: FormData, name: ProjectFormField) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
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

function getProjectFieldErrors(error: z.ZodError): ProjectActionState["fieldErrors"] {
  const fieldErrors: ProjectActionState["fieldErrors"] = {};

  for (const issue of error.issues) {
    const field = issue.path.at(0);

    if (isProjectFormField(field) && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}

function getProjectAssignmentFieldErrors(
  error: z.ZodError,
): ProjectAssignmentActionState["fieldErrors"] {
  const fieldErrors: ProjectAssignmentActionState["fieldErrors"] = {};

  for (const issue of error.issues) {
    const field = issue.path.at(0);

    if (isProjectAssignmentFormField(field) && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}

function getProjectBulkAssignmentFieldErrors(
  error: z.ZodError,
): ProjectBulkAssignmentActionState["fieldErrors"] {
  const fieldErrors: ProjectBulkAssignmentActionState["fieldErrors"] = {};

  for (const issue of error.issues) {
    const field = issue.path.at(0);

    if (isProjectBulkAssignmentFormField(field) && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}

function getProjectGroupFieldErrors(error: z.ZodError): ProjectGroupActionState["fieldErrors"] {
  const fieldErrors: ProjectGroupActionState["fieldErrors"] = {};

  for (const issue of error.issues) {
    const field = issue.path.at(0);

    if (isProjectGroupFormField(field) && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}

function getProjectGroupProjectFieldErrors(
  error: z.ZodError,
): ProjectGroupProjectActionState["fieldErrors"] {
  const fieldErrors: ProjectGroupProjectActionState["fieldErrors"] = {};

  for (const issue of error.issues) {
    const field = issue.path.at(0);

    if (isProjectGroupProjectFormField(field) && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  return fieldErrors;
}

function isProjectFormField(field: unknown): field is ProjectFormField {
  return (
    field === "name" ||
    field === "slug" ||
    field === "colorToken" ||
    field === "startsOn" ||
    field === "endsOn" ||
    field === "isInternal" ||
    field === "notes"
  );
}

function isProjectAssignmentFormField(field: unknown): field is ProjectAssignmentFormField {
  return (
    field === "memberId" ||
    field === "validFrom" ||
    field === "validTo" ||
    field === "active" ||
    field === "notes"
  );
}

function isProjectBulkAssignmentFormField(field: unknown): field is ProjectBulkAssignmentFormField {
  return (
    field === "memberIds" ||
    field === "projectIds" ||
    field === "validFrom" ||
    field === "validTo" ||
    field === "active" ||
    field === "notes"
  );
}

function isProjectGroupFormField(field: unknown): field is ProjectGroupFormField {
  return field === "name" || field === "slug" || field === "description" || field === "active";
}

function isProjectGroupProjectFormField(field: unknown): field is ProjectGroupProjectFormField {
  return field === "projectGroupId" || field === "projectId";
}

async function getProjectRequestMetadata(): Promise<ProjectRequestMetadata> {
  const requestHeaders = await headers();

  return {
    ipAddress: requestHeaders.get("x-forwarded-for"),
    userAgent: requestHeaders.get("user-agent"),
  };
}

function mapProjectGroupActionError(
  error: unknown,
  fallback: string,
  t: AdminProjectsActionsTranslator,
): ProjectGroupActionState {
  const result = mapProjectActionError(error, fallback, t);

  return {
    status: result.status,
    message: result.message,
  };
}

function mapProjectGroupProjectActionError(
  error: unknown,
  fallback: string,
  t: AdminProjectsActionsTranslator,
): ProjectGroupProjectActionState {
  const result = mapProjectActionError(error, fallback, t);

  return {
    status: result.status,
    message: result.message,
  };
}

function mapProjectAssignmentActionError(
  error: unknown,
  fallback: string,
  t: AdminProjectsActionsTranslator,
): ProjectAssignmentActionState {
  const result = mapProjectActionError(error, fallback, t);

  return {
    status: result.status,
    message: result.message,
  };
}

function mapProjectBulkAssignmentActionError(
  error: unknown,
  fallback: string,
  t: AdminProjectsActionsTranslator,
): ProjectBulkAssignmentActionState {
  const result = mapProjectActionError(error, fallback, t);

  return {
    status: result.status,
    message: result.message,
  };
}

function mapProjectActionError(
  error: unknown,
  fallback: string,
  t: AdminProjectsActionsTranslator,
): ProjectActionState {
  console.error("[admin/projects] action failed", error);

  if (
    error instanceof ProjectManagementError ||
    error instanceof ProjectAssignmentError ||
    error instanceof ProjectGroupManagementError ||
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
      message: mapKnownPrismaProjectError(error, fallback, t),
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

function mapKnownPrismaProjectError(
  error: Prisma.PrismaClientKnownRequestError,
  fallback: string,
  t: AdminProjectsActionsTranslator,
) {
  switch (error.code) {
    case "P2002":
      if ([t("errors.groupCreateFailed"), t("errors.groupUpdateFailed")].includes(fallback)) {
        return t("errors.groupSlugExists");
      }
      return t("errors.projectSlugExists");
    case "P2003":
      return t("errors.projectLinkFailed");
    case "P2021":
    case "P2022":
      return t("errors.projectsUnavailable");
    case "P2025":
      return t("errors.projectMissing");
    default:
      return fallback;
  }
}
