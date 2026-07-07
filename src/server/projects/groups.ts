import { prisma } from "@/src/server/db/client";

export type ProjectGroupInput = {
  name: string;
  slug?: string;
  description?: string | null;
  active?: boolean;
};

export type CreateProjectGroupInput = ProjectGroupInput & {
  actorMemberId: string;
  requestMetadata?: ProjectGroupRequestMetadata;
};

export type UpdateProjectGroupInput = ProjectGroupInput & {
  projectGroupId: string;
  actorMemberId: string;
  requestMetadata?: ProjectGroupRequestMetadata;
};

export type ArchiveProjectGroupInput = {
  projectGroupId: string;
  actorMemberId: string;
  requestMetadata?: ProjectGroupRequestMetadata;
};

export type AddProjectToGroupInput = {
  projectGroupId: string;
  projectId: string;
  actorMemberId: string;
  requestMetadata?: ProjectGroupRequestMetadata;
};

export type RemoveProjectFromGroupInput = AddProjectToGroupInput;

export type ProjectGroupRequestMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type ProjectGroupProjectStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type AdminProjectGroupProjectRow = {
  id: string;
  name: string;
  slug: string;
  status: ProjectGroupProjectStatus;
  isInternal: boolean;
};

export type AdminProjectGroupRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  projectCount: number;
  projects: AdminProjectGroupProjectRow[];
  updatedAt: string;
};

type ProjectGroupManagementDb = {
  $transaction<T>(callback: (tx: ProjectGroupManagementTransaction) => Promise<T>): Promise<T>;
  projectGroup: {
    findMany(args: {
      where: { deletedAt: null };
      orderBy: Array<Record<string, "asc" | "desc">>;
      select: ProjectGroupListSelect;
    }): Promise<ProjectGroupListRecord[]>;
  };
};

type ProjectGroupManagementTransaction = {
  projectGroup: {
    findUnique(args: {
      where: { id?: string; slug?: string };
      select: ProjectGroupSelect;
    }): Promise<ProjectGroupRecord | null>;
    create(args: {
      data: {
        name: string;
        slug: string;
        description: string | null;
        active: boolean;
      };
      select: { id: true; slug: true };
    }): Promise<{ id: string; slug: string }>;
    update(args: {
      where: { id: string };
      data: Partial<{
        name: string;
        slug: string;
        description: string | null;
        active: boolean;
        deletedAt: Date | null;
      }>;
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  project: {
    findUnique(args: {
      where: { id: string };
      select: ProjectForGroupSelect;
    }): Promise<ProjectForGroupRecord | null>;
  };
  projectGroupProject: {
    findUnique(args: {
      where: {
        projectGroupId_projectId: {
          projectGroupId: string;
          projectId: string;
        };
      };
      select: ProjectGroupProjectSelect;
    }): Promise<ProjectGroupProjectRecord | null>;
    create(args: {
      data: {
        projectGroupId: string;
        projectId: string;
      };
      select: ProjectGroupProjectSelect;
    }): Promise<ProjectGroupProjectRecord>;
    delete(args: {
      where: {
        projectGroupId_projectId: {
          projectGroupId: string;
          projectId: string;
        };
      };
      select: ProjectGroupProjectSelect;
    }): Promise<ProjectGroupProjectRecord>;
  };
  auditLog: {
    create(args: {
      data: {
        actorMemberId: string;
        action: string;
        targetType: "project_group" | "project_group_project";
        targetId: string;
        before?: Record<string, unknown>;
        after?: Record<string, unknown>;
        ipAddress?: string | null;
        userAgent?: string | null;
      };
    }): Promise<unknown>;
  };
};

type ProjectGroupSelect = {
  id: true;
  name: true;
  slug: true;
  description: true;
  active: true;
  deletedAt: true;
};

type ProjectGroupRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  deletedAt: Date | null;
};

type ProjectGroupListSelect = ProjectGroupSelect & {
  updatedAt: true;
  projects: {
    orderBy: {
      project: {
        name: "asc";
      };
    };
    select: {
      project: {
        select: ProjectForGroupSelect;
      };
    };
  };
};

type ProjectGroupListRecord = ProjectGroupRecord & {
  updatedAt: Date;
  projects: Array<{
    project: ProjectForGroupRecord;
  }>;
};

type ProjectForGroupSelect = {
  id: true;
  name: true;
  slug: true;
  status: true;
  isInternal: true;
  deletedAt: true;
};

type ProjectForGroupRecord = {
  id: string;
  name: string;
  slug: string;
  status: ProjectGroupProjectStatus;
  isInternal: boolean;
  deletedAt: Date | null;
};

type ProjectGroupProjectSelect = {
  projectGroupId: true;
  projectId: true;
};

type ProjectGroupProjectRecord = {
  projectGroupId: string;
  projectId: string;
};

type NormalizedProjectGroupInput = {
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
};

type ProjectGroupChangeSet = {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  data: Partial<NormalizedProjectGroupInput>;
};

const projectGroupSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  active: true,
  deletedAt: true,
} satisfies ProjectGroupSelect;

const projectForGroupSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  isInternal: true,
  deletedAt: true,
} satisfies ProjectForGroupSelect;

const projectGroupProjectSelect = {
  projectGroupId: true,
  projectId: true,
} satisfies ProjectGroupProjectSelect;

export class ProjectGroupManagementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectGroupManagementError";
  }
}

export async function listProjectGroupsForAdmin(
  deps: { db?: ProjectGroupManagementDb } = {},
): Promise<AdminProjectGroupRow[]> {
  const db = deps.db ?? (prisma as unknown as ProjectGroupManagementDb);
  const groups = await db.projectGroup.findMany({
    where: {
      deletedAt: null,
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      ...projectGroupSelect,
      updatedAt: true,
      projects: {
        orderBy: {
          project: {
            name: "asc",
          },
        },
        select: {
          project: {
            select: projectForGroupSelect,
          },
        },
      },
    },
  });

  return groups.map(mapProjectGroupToAdminRow);
}

export async function createProjectGroup(
  input: CreateProjectGroupInput,
  deps: { db?: ProjectGroupManagementDb } = {},
) {
  const db = deps.db ?? (prisma as unknown as ProjectGroupManagementDb);
  const group = normalizeProjectGroupInput(input);

  return db.$transaction(async (tx) => {
    await assertGroupSlugAvailable(tx, group.slug);

    const created = await tx.projectGroup.create({
      data: group,
      select: {
        id: true,
        slug: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "project_group.created",
        targetType: "project_group",
        targetId: created.id,
        after: group,
        ...input.requestMetadata,
      },
    });

    return created;
  });
}

export async function updateProjectGroup(
  input: UpdateProjectGroupInput,
  deps: { db?: ProjectGroupManagementDb } = {},
) {
  const db = deps.db ?? (prisma as unknown as ProjectGroupManagementDb);
  const nextGroup = normalizeProjectGroupInput(input);

  return db.$transaction(async (tx) => {
    const currentGroup = await findMutableProjectGroup(tx, input.projectGroupId);

    if (nextGroup.slug !== currentGroup.slug) {
      await assertGroupSlugAvailable(tx, nextGroup.slug, currentGroup.id);
    }

    const changes = getProjectGroupChanges(currentGroup, nextGroup);

    if (!Object.keys(changes.after).length) {
      return {
        projectGroupId: currentGroup.id,
        changed: false,
      };
    }

    await tx.projectGroup.update({
      where: {
        id: currentGroup.id,
      },
      data: changes.data,
      select: {
        id: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "project_group.updated",
        targetType: "project_group",
        targetId: currentGroup.id,
        before: changes.before,
        after: changes.after,
        ...input.requestMetadata,
      },
    });

    return {
      projectGroupId: currentGroup.id,
      changed: true,
    };
  });
}

export async function archiveProjectGroup(
  input: ArchiveProjectGroupInput,
  deps: { db?: ProjectGroupManagementDb; now?: () => Date } = {},
) {
  const db = deps.db ?? (prisma as unknown as ProjectGroupManagementDb);
  const now = deps.now?.() ?? new Date();

  return db.$transaction(async (tx) => {
    const group = await findProjectGroup(tx, input.projectGroupId);

    if (group.deletedAt) {
      throw new ProjectGroupManagementError("This project group is already archived.");
    }

    await tx.projectGroup.update({
      where: {
        id: group.id,
      },
      data: {
        active: false,
        deletedAt: now,
      },
      select: {
        id: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "project_group.archived",
        targetType: "project_group",
        targetId: group.id,
        before: {
          active: group.active,
          deletedAt: group.deletedAt,
        },
        after: {
          active: false,
          deletedAt: now.toISOString(),
        },
        ...input.requestMetadata,
      },
    });

    return {
      projectGroupId: group.id,
    };
  });
}

export async function addProjectToGroup(
  input: AddProjectToGroupInput,
  deps: { db?: ProjectGroupManagementDb } = {},
) {
  const db = deps.db ?? (prisma as unknown as ProjectGroupManagementDb);

  return db.$transaction(async (tx) => {
    const group = await findMutableProjectGroup(tx, input.projectGroupId);
    const project = await findLinkableProject(tx, input.projectId);
    const existingLink = await findProjectGroupLink(tx, group.id, project.id);

    if (existingLink) {
      return {
        projectGroupId: group.id,
        projectId: project.id,
        changed: false,
      };
    }

    const created = await tx.projectGroupProject.create({
      data: {
        projectGroupId: group.id,
        projectId: project.id,
      },
      select: projectGroupProjectSelect,
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "project_group.project_added",
        targetType: "project_group_project",
        targetId: getProjectGroupProjectAuditId(created),
        after: created,
        ...input.requestMetadata,
      },
    });

    return {
      projectGroupId: group.id,
      projectId: project.id,
      changed: true,
    };
  });
}

export async function removeProjectFromGroup(
  input: RemoveProjectFromGroupInput,
  deps: { db?: ProjectGroupManagementDb } = {},
) {
  const db = deps.db ?? (prisma as unknown as ProjectGroupManagementDb);

  return db.$transaction(async (tx) => {
    const group = await findMutableProjectGroup(tx, input.projectGroupId);
    const project = await findLinkableProject(tx, input.projectId);
    const existingLink = await findProjectGroupLink(tx, group.id, project.id);

    if (!existingLink) {
      return {
        projectGroupId: group.id,
        projectId: project.id,
        changed: false,
      };
    }

    const deleted = await tx.projectGroupProject.delete({
      where: {
        projectGroupId_projectId: {
          projectGroupId: group.id,
          projectId: project.id,
        },
      },
      select: projectGroupProjectSelect,
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "project_group.project_removed",
        targetType: "project_group_project",
        targetId: getProjectGroupProjectAuditId(deleted),
        before: deleted,
        ...input.requestMetadata,
      },
    });

    return {
      projectGroupId: group.id,
      projectId: project.id,
      changed: true,
    };
  });
}

function normalizeProjectGroupInput(input: ProjectGroupInput): NormalizedProjectGroupInput {
  const name = input.name.trim();
  const slug = normalizeProjectGroupSlug(input.slug || name);
  const description = input.description?.trim() || null;

  if (!name) {
    throw new ProjectGroupManagementError("Project group name is required.");
  }

  if (!slug) {
    throw new ProjectGroupManagementError("Project group slug is required.");
  }

  return {
    name,
    slug,
    description,
    active: input.active ?? true,
  };
}

function normalizeProjectGroupSlug(value: string) {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function assertGroupSlugAvailable(
  tx: ProjectGroupManagementTransaction,
  slug: string,
  currentProjectGroupId?: string,
) {
  const existingGroup = await tx.projectGroup.findUnique({
    where: {
      slug,
    },
    select: projectGroupSelect,
  });

  if (existingGroup && existingGroup.id !== currentProjectGroupId) {
    throw new ProjectGroupManagementError("A project group with this slug already exists.");
  }
}

async function findProjectGroup(tx: ProjectGroupManagementTransaction, projectGroupId: string) {
  const group = await tx.projectGroup.findUnique({
    where: {
      id: projectGroupId,
    },
    select: projectGroupSelect,
  });

  if (!group) {
    throw new ProjectGroupManagementError("Project group does not exist.");
  }

  return group;
}

async function findMutableProjectGroup(
  tx: ProjectGroupManagementTransaction,
  projectGroupId: string,
) {
  const group = await findProjectGroup(tx, projectGroupId);

  if (group.deletedAt) {
    throw new ProjectGroupManagementError("Archived project groups cannot be changed.");
  }

  return group;
}

async function findLinkableProject(tx: ProjectGroupManagementTransaction, projectId: string) {
  const project = await tx.project.findUnique({
    where: {
      id: projectId,
    },
    select: projectForGroupSelect,
  });

  if (!project || project.deletedAt || project.status === "ARCHIVED") {
    throw new ProjectGroupManagementError("Project does not exist or is archived.");
  }

  return project;
}

async function findProjectGroupLink(
  tx: ProjectGroupManagementTransaction,
  projectGroupId: string,
  projectId: string,
) {
  return tx.projectGroupProject.findUnique({
    where: {
      projectGroupId_projectId: {
        projectGroupId,
        projectId,
      },
    },
    select: projectGroupProjectSelect,
  });
}

function getProjectGroupChanges(
  current: ProjectGroupRecord,
  next: NormalizedProjectGroupInput,
): ProjectGroupChangeSet {
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  const data: Partial<NormalizedProjectGroupInput> = {};

  for (const key of Object.keys(next) as Array<keyof NormalizedProjectGroupInput>) {
    collectProjectGroupChange(key, current, next, before, after, data);
  }

  return {
    before,
    after,
    data,
  };
}

function collectProjectGroupChange<K extends keyof NormalizedProjectGroupInput>(
  key: K,
  current: ProjectGroupRecord,
  next: NormalizedProjectGroupInput,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  data: Partial<NormalizedProjectGroupInput>,
) {
  if (current[key] === next[key]) return;

  before[key] = current[key];
  after[key] = next[key];
  data[key] = next[key];
}

function mapProjectGroupToAdminRow(group: ProjectGroupListRecord): AdminProjectGroupRow {
  const projects = group.projects
    .map((groupProject) => groupProject.project)
    .filter((project) => !project.deletedAt)
    .map((project) => ({
      id: project.id,
      name: project.name,
      slug: project.slug,
      status: project.status,
      isInternal: project.isInternal,
    }));

  return {
    id: group.id,
    name: group.name,
    slug: group.slug,
    description: group.description,
    active: group.active,
    projectCount: projects.length,
    projects,
    updatedAt: group.updatedAt.toISOString(),
  };
}

function getProjectGroupProjectAuditId(link: ProjectGroupProjectRecord) {
  return `${link.projectGroupId}:${link.projectId}`;
}
