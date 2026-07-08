import { prisma } from "@/src/server/db/client";
import {
  DEFAULT_PROJECT_COLOR_TOKEN,
  isProjectColorToken,
  type ProjectColorToken,
} from "@/src/lib/project-colors";

export type ProjectLifecycleStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type ProjectInput = {
  name: string;
  slug?: string;
  colorToken?: ProjectColorToken;
  startsOn?: Date | null;
  endsOn?: Date | null;
  isInternal?: boolean;
  notes?: string | null;
};

export type CreateProjectInput = ProjectInput & {
  actorMemberId: string;
  requestMetadata?: ProjectRequestMetadata;
};

export type UpdateProjectInput = ProjectInput & {
  projectId: string;
  actorMemberId: string;
  requestMetadata?: ProjectRequestMetadata;
};

export type ChangeProjectStatusInput = {
  projectId: string;
  status: Exclude<ProjectLifecycleStatus, "ARCHIVED">;
  actorMemberId: string;
  requestMetadata?: ProjectRequestMetadata;
};

export type ArchiveProjectInput = {
  projectId: string;
  actorMemberId: string;
  requestMetadata?: ProjectRequestMetadata;
};

export type ProjectRequestMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type AdminProjectRow = {
  id: string;
  name: string;
  slug: string;
  colorToken: ProjectColorToken;
  status: ProjectLifecycleStatus;
  startsOn: string | null;
  endsOn: string | null;
  isInternal: boolean;
  notes: string | null;
  assignmentCount: number;
  groupCount: number;
  groups: AdminProjectGroupSummary[];
  updatedAt: string;
};

export type AdminProjectGroupSummary = {
  id: string;
  name: string;
  slug: string;
};

type ProjectManagementDb = {
  $transaction<T>(callback: (tx: ProjectManagementTransaction) => Promise<T>): Promise<T>;
  project: {
    findMany(args: {
      where: { deletedAt: null };
      orderBy: Array<Record<string, "asc" | "desc">>;
      select: ProjectListSelect;
    }): Promise<ProjectListRecord[]>;
  };
};

type ProjectManagementTransaction = {
  project: {
    findUnique(args: {
      where: { id?: string; slug?: string };
      select: ProjectSelect;
    }): Promise<ProjectRecord | null>;
    create(args: {
      data: {
        name: string;
        slug: string;
        colorToken: ProjectColorToken;
        status: ProjectLifecycleStatus;
        startsOn: Date | null;
        endsOn: Date | null;
        isInternal: boolean;
        notes: string | null;
        createdByMemberId: string;
        updatedByMemberId: string;
      };
      select: { id: true; slug: true };
    }): Promise<{ id: string; slug: string }>;
    update(args: {
      where: { id: string };
      data: Partial<{
        name: string;
        slug: string;
        colorToken: ProjectColorToken;
        status: ProjectLifecycleStatus;
        startsOn: Date | null;
        endsOn: Date | null;
        isInternal: boolean;
        notes: string | null;
        deletedAt: Date | null;
        updatedByMemberId: string;
      }>;
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  auditLog: {
    create(args: {
      data: {
        actorMemberId: string;
        action: string;
        targetType: "project";
        targetId: string;
        before?: Record<string, unknown>;
        after?: Record<string, unknown>;
        ipAddress?: string | null;
        userAgent?: string | null;
      };
    }): Promise<unknown>;
  };
};

type ProjectSelect = {
  id: true;
  name: true;
  slug: true;
  colorToken: true;
  status: true;
  startsOn: true;
  endsOn: true;
  isInternal: true;
  notes: true;
  deletedAt: true;
};

type ProjectRecord = {
  id: string;
  name: string;
  slug: string;
  colorToken: ProjectColorToken;
  status: ProjectLifecycleStatus;
  startsOn: Date | null;
  endsOn: Date | null;
  isInternal: boolean;
  notes: string | null;
  deletedAt: Date | null;
};

type ProjectListSelect = ProjectSelect & {
  updatedAt: true;
  groupProjects: {
    orderBy: {
      projectGroup: {
        name: "asc";
      };
    };
    select: {
      projectGroup: {
        select: ProjectGroupSummarySelect;
      };
    };
  };
  _count: {
    select: {
      assignments: true;
    };
  };
};

type ProjectListRecord = ProjectRecord & {
  updatedAt: Date;
  groupProjects: Array<{
    projectGroup: ProjectGroupSummaryRecord;
  }>;
  _count: {
    assignments: number;
  };
};

type ProjectGroupSummarySelect = {
  id: true;
  name: true;
  slug: true;
  deletedAt: true;
};

type ProjectGroupSummaryRecord = {
  id: string;
  name: string;
  slug: string;
  deletedAt: Date | null;
};

type NormalizedProjectInput = {
  name: string;
  slug: string;
  colorToken: ProjectColorToken;
  startsOn: Date | null;
  endsOn: Date | null;
  isInternal: boolean;
  notes: string | null;
};

type ProjectChangeSet = {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  data: Partial<NormalizedProjectInput>;
};

const projectSelect = {
  id: true,
  name: true,
  slug: true,
  colorToken: true,
  status: true,
  startsOn: true,
  endsOn: true,
  isInternal: true,
  notes: true,
  deletedAt: true,
} satisfies ProjectSelect;

export class ProjectManagementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectManagementError";
  }
}

export async function listProjectsForAdmin(
  deps: { db?: ProjectManagementDb } = {},
): Promise<AdminProjectRow[]> {
  const db = deps.db ?? (prisma as unknown as ProjectManagementDb);
  const projects = await db.project.findMany({
    where: {
      deletedAt: null,
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: {
      ...projectSelect,
      updatedAt: true,
      groupProjects: {
        orderBy: {
          projectGroup: {
            name: "asc",
          },
        },
        select: {
          projectGroup: {
            select: {
              id: true,
              name: true,
              slug: true,
              deletedAt: true,
            },
          },
        },
      },
      _count: {
        select: {
          assignments: true,
        },
      },
    },
  });

  return projects.map(mapProjectToAdminRow);
}

export async function createProject(
  input: CreateProjectInput,
  deps: { db?: ProjectManagementDb } = {},
) {
  const db = deps.db ?? (prisma as unknown as ProjectManagementDb);
  const project = normalizeProjectInput(input);

  return db.$transaction(async (tx) => {
    await assertSlugAvailable(tx, project.slug);

    const created = await tx.project.create({
      data: {
        ...project,
        status: "ACTIVE",
        createdByMemberId: input.actorMemberId,
        updatedByMemberId: input.actorMemberId,
      },
      select: {
        id: true,
        slug: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "project.created",
        targetType: "project",
        targetId: created.id,
        after: serializeProjectInput(project),
        ...input.requestMetadata,
      },
    });

    return created;
  });
}

export async function updateProject(
  input: UpdateProjectInput,
  deps: { db?: ProjectManagementDb } = {},
) {
  const db = deps.db ?? (prisma as unknown as ProjectManagementDb);
  const nextProject = normalizeProjectInput(input);

  return db.$transaction(async (tx) => {
    const currentProject = await findMutableProject(tx, input.projectId);

    if (nextProject.slug !== currentProject.slug) {
      await assertSlugAvailable(tx, nextProject.slug, currentProject.id);
    }

    const changes = getProjectChanges(currentProject, nextProject);

    if (!Object.keys(changes.after).length) {
      return {
        projectId: currentProject.id,
        changed: false,
      };
    }

    await tx.project.update({
      where: {
        id: currentProject.id,
      },
      data: {
        ...changes.data,
        updatedByMemberId: input.actorMemberId,
      },
      select: {
        id: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "project.updated",
        targetType: "project",
        targetId: currentProject.id,
        before: changes.before,
        after: changes.after,
        ...input.requestMetadata,
      },
    });

    return {
      projectId: currentProject.id,
      changed: true,
    };
  });
}

export async function changeProjectStatus(
  input: ChangeProjectStatusInput,
  deps: { db?: ProjectManagementDb } = {},
) {
  const db = deps.db ?? (prisma as unknown as ProjectManagementDb);

  return db.$transaction(async (tx) => {
    const project = await findMutableProject(tx, input.projectId);

    if (project.status === input.status) {
      return {
        projectId: project.id,
        changed: false,
      };
    }

    await tx.project.update({
      where: {
        id: project.id,
      },
      data: {
        status: input.status,
        updatedByMemberId: input.actorMemberId,
      },
      select: {
        id: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "project.status_changed",
        targetType: "project",
        targetId: project.id,
        before: {
          status: project.status,
        },
        after: {
          status: input.status,
        },
        ...input.requestMetadata,
      },
    });

    return {
      projectId: project.id,
      changed: true,
    };
  });
}

export async function archiveProject(
  input: ArchiveProjectInput,
  deps: { db?: ProjectManagementDb; now?: () => Date } = {},
) {
  const db = deps.db ?? (prisma as unknown as ProjectManagementDb);
  const now = deps.now?.() ?? new Date();

  return db.$transaction(async (tx) => {
    const project = await findProject(tx, input.projectId);

    if (project.deletedAt || project.status === "ARCHIVED") {
      throw new ProjectManagementError("This project is already archived.");
    }

    await tx.project.update({
      where: {
        id: project.id,
      },
      data: {
        status: "ARCHIVED",
        deletedAt: now,
        updatedByMemberId: input.actorMemberId,
      },
      select: {
        id: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "project.archived",
        targetType: "project",
        targetId: project.id,
        before: {
          status: project.status,
          deletedAt: project.deletedAt,
        },
        after: {
          status: "ARCHIVED",
          deletedAt: now,
        },
        ...input.requestMetadata,
      },
    });

    return {
      projectId: project.id,
    };
  });
}

function normalizeProjectInput(input: ProjectInput): NormalizedProjectInput {
  const name = input.name.trim();
  const slug = normalizeProjectSlug(input.slug || name);
  const colorToken = input.colorToken ?? DEFAULT_PROJECT_COLOR_TOKEN;
  const startsOn = input.startsOn ? toDateOnly(input.startsOn) : null;
  const endsOn = input.endsOn ? toDateOnly(input.endsOn) : null;
  const notes = input.notes?.trim() || null;

  if (!name) {
    throw new ProjectManagementError("Project name is required.");
  }

  if (!slug) {
    throw new ProjectManagementError("Project slug is required.");
  }

  if (!isProjectColorToken(colorToken)) {
    throw new ProjectManagementError("Project color is not supported.");
  }

  if (startsOn && endsOn && endsOn < startsOn) {
    throw new ProjectManagementError("Project end date cannot be before the start date.");
  }

  return {
    name,
    slug,
    colorToken,
    startsOn,
    endsOn,
    isInternal: Boolean(input.isInternal),
    notes,
  };
}

function normalizeProjectSlug(value: string) {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function assertSlugAvailable(
  tx: ProjectManagementTransaction,
  slug: string,
  currentProjectId?: string,
) {
  const existingProject = await tx.project.findUnique({
    where: {
      slug,
    },
    select: projectSelect,
  });

  if (existingProject && existingProject.id !== currentProjectId) {
    throw new ProjectManagementError("A project with this slug already exists.");
  }
}

async function findProject(tx: ProjectManagementTransaction, projectId: string) {
  const project = await tx.project.findUnique({
    where: {
      id: projectId,
    },
    select: projectSelect,
  });

  if (!project) {
    throw new ProjectManagementError("Project does not exist.");
  }

  return project;
}

async function findMutableProject(tx: ProjectManagementTransaction, projectId: string) {
  const project = await findProject(tx, projectId);

  if (project.deletedAt || project.status === "ARCHIVED") {
    throw new ProjectManagementError("Archived projects cannot be changed.");
  }

  return project;
}

function getProjectChanges(current: ProjectRecord, next: NormalizedProjectInput): ProjectChangeSet {
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  const data: Partial<NormalizedProjectInput> = {};

  for (const key of Object.keys(next) as Array<keyof NormalizedProjectInput>) {
    collectProjectChange(key, current, next, before, after, data);
  }

  return {
    before,
    after,
    data,
  };
}

function collectProjectChange<K extends keyof NormalizedProjectInput>(
  key: K,
  current: ProjectRecord,
  next: NormalizedProjectInput,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  data: Partial<NormalizedProjectInput>,
) {
  const currentValue = current[key];
  const nextValue = next[key];
  const changed =
    currentValue instanceof Date && nextValue instanceof Date
      ? formatDateOnly(currentValue) !== formatDateOnly(nextValue)
      : currentValue !== nextValue;

  if (!changed) return;

  before[key] = serializeAuditValue(currentValue);
  after[key] = serializeAuditValue(nextValue);
  data[key] = nextValue;
}

function mapProjectToAdminRow(project: ProjectListRecord): AdminProjectRow {
  const groups = project.groupProjects
    .map((groupProject) => groupProject.projectGroup)
    .filter((group) => !group.deletedAt)
    .map((group) => ({
      id: group.id,
      name: group.name,
      slug: group.slug,
    }));

  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    colorToken: project.colorToken,
    status: project.status,
    startsOn: project.startsOn ? formatDateOnly(project.startsOn) : null,
    endsOn: project.endsOn ? formatDateOnly(project.endsOn) : null,
    isInternal: project.isInternal,
    notes: project.notes,
    assignmentCount: project._count.assignments,
    groupCount: groups.length,
    groups,
    updatedAt: project.updatedAt.toISOString(),
  };
}

function serializeAuditValue(value: unknown) {
  return value instanceof Date ? formatDateOnly(value) : value;
}

function serializeProjectInput(project: NormalizedProjectInput) {
  return {
    ...project,
    startsOn: project.startsOn ? formatDateOnly(project.startsOn) : null,
    endsOn: project.endsOn ? formatDateOnly(project.endsOn) : null,
  };
}

function toDateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}
