"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { requireAdminAppMemberForAction } from "@/src/server/auth/app-access";
import { AuthenticationError, AuthorizationError } from "@/src/server/auth/session";
import { Prisma } from "@/src/server/db/generated/client";
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

const projectDateSchema = z.string().trim().refine(isDateInputValue, "Choose a valid date.");

const projectFormSchema = z
  .object({
    name: z.string().trim().min(1, "Project name is required."),
    slug: z.string().trim().max(80, "Slug must be 80 characters or less."),
    startsOn: projectDateSchema,
    endsOn: projectDateSchema,
    isInternal: z.boolean(),
    notes: z.string().trim().max(1000, "Notes must be 1000 characters or less."),
  })
  .superRefine((value, context) => {
    if (!value.startsOn || !value.endsOn) return;

    if (value.endsOn < value.startsOn) {
      context.addIssue({
        code: "custom",
        message: "Project end date cannot be before the start date.",
        path: ["endsOn"],
      });
    }
  });

const assignmentBaseSchema = z.object({
  memberId: z.string().trim().min(1, "Choose a member."),
  validFrom: z
    .string()
    .trim()
    .min(1, "Assignment start date is required.")
    .refine(isDateInputValue, "Choose a valid start date."),
  validTo: projectDateSchema,
  active: z.boolean(),
  notes: z.string().trim().max(1000, "Notes must be 1000 characters or less."),
});

const assignmentFormSchema = assignmentBaseSchema.superRefine(validateAssignmentDateRange);

const updateAssignmentFormSchema = assignmentBaseSchema
  .omit({
    memberId: true,
  })
  .superRefine(validateAssignmentDateRange);

function validateAssignmentDateRange(
  value: { validFrom: string; validTo: string },
  context: z.RefinementCtx,
) {
  if (!value.validTo) return;

  if (value.validTo < value.validFrom) {
    context.addIssue({
      code: "custom",
      message: "Assignment end date cannot be before the start date.",
      path: ["validTo"],
    });
  }
}

const closeAssignmentSchema = z.object({
  assignmentId: z.string().trim().min(1, "Assignment id is missing."),
  validTo: z
    .string()
    .trim()
    .min(1, "Assignment end date is required.")
    .refine(isDateInputValue, "Choose a valid end date."),
});

const bulkAssignmentFormSchema = z
  .object({
    memberIds: z.array(z.string().trim().min(1)).min(1, "Choose at least one member."),
    projectIds: z.array(z.string().trim().min(1)).min(1, "Choose at least one project."),
    validFrom: z
      .string()
      .trim()
      .min(1, "Assignment start date is required.")
      .refine(isDateInputValue, "Choose a valid start date."),
    validTo: projectDateSchema,
    active: z.boolean(),
    notes: z.string().trim().max(1000, "Notes must be 1000 characters or less."),
  })
  .superRefine((value, context) => {
    validateAssignmentDateRange(value, context);

    if (new Set(value.memberIds).size * new Set(value.projectIds).size > 200) {
      context.addIssue({
        code: "custom",
        message: "Bulk assignment is limited to 200 member/project pairs.",
        path: ["projectIds"],
      });
    }
  });

const projectGroupFormSchema = z.object({
  name: z.string().trim().min(1, "Group name is required."),
  slug: z.string().trim().max(80, "Slug must be 80 characters or less."),
  description: z.string().trim().max(1000, "Description must be 1000 characters or less."),
  active: z.boolean(),
});

const projectGroupProjectSchema = z.object({
  projectGroupId: z.string().trim().min(1, "Project group id is missing."),
  projectId: z.string().trim().min(1, "Choose a project."),
});

export async function createProjectAction(
  _previousState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const parsed = projectFormSchema.safeParse({
    name: getFormString(formData, "name"),
    slug: getFormString(formData, "slug"),
    startsOn: getFormString(formData, "startsOn"),
    endsOn: getFormString(formData, "endsOn"),
    isInternal: formData.get("isInternal") === "true",
    notes: getFormString(formData, "notes"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted fields and try again.",
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
      message: "Project created.",
    };
  } catch (error) {
    return mapProjectActionError(error, "The project could not be created.");
  }
}

export async function updateProjectAction(
  input: UpdateProjectActionInput,
): Promise<ProjectActionState> {
  const parsed = projectFormSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted fields and try again.",
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
      message: result.changed ? "Project updated." : "No changes to save.",
    };
  } catch (error) {
    return mapProjectActionError(error, "The project could not be updated.");
  }
}

export async function setProjectActiveAction(
  projectId: string,
  active: boolean,
): Promise<ProjectActionState> {
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
          ? "Project activated."
          : "Project deactivated."
        : "Project status was already up to date.",
    };
  } catch (error) {
    return mapProjectActionError(error, "The project status could not be changed.");
  }
}

export async function archiveProjectAction(projectId: string): Promise<ProjectActionState> {
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
      message: "Project archived.",
    };
  } catch (error) {
    return mapProjectActionError(error, "The project could not be archived.");
  }
}

export async function assignProjectMemberAction(
  input: AssignProjectMemberActionInput,
): Promise<ProjectAssignmentActionState> {
  const parsed = assignmentFormSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted assignment fields and try again.",
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
      message: "Member assigned to project.",
    };
  } catch (error) {
    return mapProjectAssignmentActionError(error, "The project assignment could not be created.");
  }
}

export async function bulkAssignProjectMembersAction(
  input: BulkAssignProjectMembersActionInput,
): Promise<ProjectBulkAssignmentActionState> {
  const parsed = bulkAssignmentFormSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted bulk assignment fields and try again.",
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
        message: "No new assignments were created because every selected pair already overlaps.",
        createdCount: 0,
        skippedDuplicateCount: result.skippedDuplicateCount,
      };
    }

    return {
      status: "success",
      message:
        result.skippedDuplicateCount > 0
          ? `${result.createdCount} assignments created. ${result.skippedDuplicateCount} duplicates skipped.`
          : `${result.createdCount} assignments created.`,
      createdCount: result.createdCount,
      skippedDuplicateCount: result.skippedDuplicateCount,
    };
  } catch (error) {
    return mapProjectBulkAssignmentActionError(error, "The bulk assignments could not be created.");
  }
}

export async function updateProjectAssignmentAction(
  input: UpdateProjectAssignmentActionInput,
): Promise<ProjectAssignmentActionState> {
  const parsed = updateAssignmentFormSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted assignment fields and try again.",
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
      message: result.changed ? "Project assignment updated." : "No assignment changes to save.",
    };
  } catch (error) {
    return mapProjectAssignmentActionError(error, "The project assignment could not be updated.");
  }
}

export async function closeProjectAssignmentAction(
  input: CloseProjectAssignmentActionInput,
): Promise<ProjectAssignmentActionState> {
  const parsed = closeAssignmentSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted assignment fields and try again.",
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
      message: "Project assignment ended.",
    };
  } catch (error) {
    return mapProjectAssignmentActionError(error, "The project assignment could not be ended.");
  }
}

export async function createProjectGroupAction(
  input: CreateProjectGroupActionInput,
): Promise<ProjectGroupActionState> {
  const parsed = projectGroupFormSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted group fields and try again.",
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
      message: "Project group created.",
    };
  } catch (error) {
    return mapProjectGroupActionError(error, "The project group could not be created.");
  }
}

export async function updateProjectGroupAction(
  input: UpdateProjectGroupActionInput,
): Promise<ProjectGroupActionState> {
  const parsed = projectGroupFormSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted group fields and try again.",
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
      message: result.changed ? "Project group updated." : "No group changes to save.",
    };
  } catch (error) {
    return mapProjectGroupActionError(error, "The project group could not be updated.");
  }
}

export async function archiveProjectGroupAction(
  projectGroupId: string,
): Promise<ProjectGroupActionState> {
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
      message: "Project group archived.",
    };
  } catch (error) {
    return mapProjectGroupActionError(error, "The project group could not be archived.");
  }
}

export async function addProjectToGroupAction(
  input: AddProjectToGroupActionInput,
): Promise<ProjectGroupProjectActionState> {
  const parsed = projectGroupProjectSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted group fields and try again.",
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
      message: result.changed ? "Project added to group." : "Project was already in this group.",
    };
  } catch (error) {
    return mapProjectGroupProjectActionError(error, "The project could not be added to the group.");
  }
}

export async function removeProjectFromGroupAction(
  input: RemoveProjectFromGroupActionInput,
): Promise<ProjectGroupProjectActionState> {
  const parsed = projectGroupProjectSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Fix the highlighted group fields and try again.",
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
      message: result.changed ? "Project removed from group." : "Project was not in this group.",
    };
  } catch (error) {
    return mapProjectGroupProjectActionError(
      error,
      "The project could not be removed from the group.",
    );
  }
}

function getFormString(formData: FormData, name: ProjectFormField) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
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

function mapProjectGroupActionError(error: unknown, fallback: string): ProjectGroupActionState {
  const result = mapProjectActionError(error, fallback);

  return {
    status: result.status,
    message: result.message,
  };
}

function mapProjectGroupProjectActionError(
  error: unknown,
  fallback: string,
): ProjectGroupProjectActionState {
  const result = mapProjectActionError(error, fallback);

  return {
    status: result.status,
    message: result.message,
  };
}

function mapProjectAssignmentActionError(
  error: unknown,
  fallback: string,
): ProjectAssignmentActionState {
  const result = mapProjectActionError(error, fallback);

  return {
    status: result.status,
    message: result.message,
  };
}

function mapProjectBulkAssignmentActionError(
  error: unknown,
  fallback: string,
): ProjectBulkAssignmentActionState {
  const result = mapProjectActionError(error, fallback);

  return {
    status: result.status,
    message: result.message,
  };
}

function mapProjectActionError(error: unknown, fallback: string): ProjectActionState {
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
      message: mapKnownPrismaProjectError(error, fallback),
    };
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: "error",
      message: "The database is not reachable. Start the dev database and try again.",
    };
  }

  return {
    status: "error",
    message: fallback,
  };
}

function mapKnownPrismaProjectError(error: Prisma.PrismaClientKnownRequestError, fallback: string) {
  switch (error.code) {
    case "P2002":
      if (fallback.includes("group")) {
        return "A project group with this slug already exists.";
      }
      return "A project with this slug already exists.";
    case "P2003":
      return "The project could not be linked to the current admin member. Refresh the page and try again.";
    case "P2021":
    case "P2022":
      return "The project database schema is out of sync. Apply the latest database schema, then try again.";
    case "P2025":
      return "This project no longer exists or was already archived.";
    default:
      return fallback;
  }
}
