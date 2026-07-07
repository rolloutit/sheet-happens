"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { requireAdminAppMemberForAction } from "@/src/server/auth/app-access";
import { AuthenticationError, AuthorizationError } from "@/src/server/auth/session";
import { Prisma } from "@/src/server/db/generated/client";
import {
  archiveProject,
  changeProjectStatus,
  createProject,
  ProjectManagementError,
  updateProject,
  type ProjectRequestMetadata,
} from "@/src/server/projects";
import type {
  ProjectActionState,
  ProjectFormField,
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

async function getProjectRequestMetadata(): Promise<ProjectRequestMetadata> {
  const requestHeaders = await headers();

  return {
    ipAddress: requestHeaders.get("x-forwarded-for"),
    userAgent: requestHeaders.get("user-agent"),
  };
}

function mapProjectActionError(error: unknown, fallback: string): ProjectActionState {
  console.error("[admin/projects] action failed", error);

  if (
    error instanceof ProjectManagementError ||
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
