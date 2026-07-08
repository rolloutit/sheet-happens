import { describe, expect, it, vi } from "vitest";

import {
  addProjectToGroup,
  archiveProjectGroup,
  createProjectGroup,
  listProjectGroupsForAdmin,
  ProjectGroupManagementError,
  removeProjectFromGroup,
  updateProjectGroup,
} from "./groups";

type TestProjectGroup = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  deletedAt: Date | null;
};

type TestProject = {
  id: string;
  name: string;
  slug: string;
  colorToken: "teal" | "amber";
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  isInternal: boolean;
  deletedAt: Date | null;
};

type TestProjectGroupProject = {
  projectGroupId: string;
  projectId: string;
};

const baseGroup: TestProjectGroup = {
  id: "group-1",
  name: "Client Work",
  slug: "client-work",
  description: "Billable delivery projects",
  active: true,
  deletedAt: null,
};

const baseProject: TestProject = {
  id: "project-1",
  name: "Client Portal",
  slug: "client-portal",
  colorToken: "teal",
  status: "ACTIVE",
  isInternal: false,
  deletedAt: null,
};

const baseLink: TestProjectGroupProject = {
  projectGroupId: "group-1",
  projectId: "project-1",
};

function createProjectGroupDb(
  overrides: {
    group?: TestProjectGroup | null;
    slugGroup?: TestProjectGroup | null;
    project?: TestProject | null;
    link?: TestProjectGroupProject | null;
    groups?: Array<
      TestProjectGroup & {
        updatedAt: Date;
        projects: Array<{
          project: TestProject;
        }>;
      }
    >;
  } = {},
) {
  const tx = {
    projectGroup: {
      findUnique: vi.fn(async (args: { where: { id?: string; slug?: string } }) => {
        if (args.where.slug) return overrides.slugGroup ?? null;
        if (args.where.id) return overrides.group ?? baseGroup;
        return null;
      }),
      create: vi.fn().mockResolvedValue({ id: "group-created", slug: "client-work" }),
      update: vi.fn().mockResolvedValue({ id: "group-1" }),
    },
    project: {
      findUnique: vi.fn().mockResolvedValue(overrides.project ?? baseProject),
    },
    projectGroupProject: {
      findUnique: vi.fn().mockResolvedValue(overrides.link ?? null),
      create: vi.fn().mockResolvedValue(baseLink),
      delete: vi.fn().mockResolvedValue(baseLink),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
  };

  return {
    tx,
    db: {
      $transaction: vi.fn((callback) => callback(tx)),
      projectGroup: {
        findMany: vi.fn().mockResolvedValue(overrides.groups ?? []),
      },
    },
  };
}

describe("project group management services", () => {
  it("maps project groups for the admin view", async () => {
    const { db } = createProjectGroupDb({
      groups: [
        {
          ...baseGroup,
          updatedAt: new Date("2026-07-12T11:15:00.000Z"),
          projects: [
            {
              project: baseProject,
            },
            {
              project: {
                ...baseProject,
                id: "project-archived",
                name: "Archived Project",
                slug: "archived-project",
                colorToken: "amber",
                deletedAt: new Date("2026-07-11T10:00:00.000Z"),
              },
            },
          ],
        },
      ],
    });

    await expect(listProjectGroupsForAdmin({ db })).resolves.toEqual([
      {
        id: "group-1",
        name: "Client Work",
        slug: "client-work",
        description: "Billable delivery projects",
        active: true,
        projectCount: 1,
        projects: [
          {
            id: "project-1",
            name: "Client Portal",
            slug: "client-portal",
            colorToken: "teal",
            status: "ACTIVE",
            isInternal: false,
          },
        ],
        updatedAt: "2026-07-12T11:15:00.000Z",
      },
    ]);
  });

  it("creates a project group with normalized slug and audit data", async () => {
    const { db, tx } = createProjectGroupDb();

    const result = await createProjectGroup(
      {
        name: " Client Work ",
        slug: "",
        description: " Delivery ",
        active: true,
        actorMemberId: "admin-1",
        requestMetadata: {
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        },
      },
      { db },
    );

    expect(result).toEqual({ id: "group-created", slug: "client-work" });
    expect(tx.projectGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: "Client Work",
          slug: "client-work",
          description: "Delivery",
          active: true,
        },
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "project_group.created",
          actorMemberId: "admin-1",
          targetType: "project_group",
          targetId: "group-created",
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        }),
      }),
    );
  });

  it("rejects duplicate project group slugs", async () => {
    const { db, tx } = createProjectGroupDb({
      slugGroup: baseGroup,
    });

    await expect(
      createProjectGroup(
        {
          name: "Client Work",
          actorMemberId: "admin-1",
        },
        { db },
      ),
    ).rejects.toBeInstanceOf(ProjectGroupManagementError);

    expect(tx.projectGroup.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("updates changed group fields and writes an audit diff", async () => {
    const { db, tx } = createProjectGroupDb();

    const result = await updateProjectGroup(
      {
        projectGroupId: "group-1",
        name: "Client Delivery",
        slug: "client-delivery",
        description: "Updated",
        active: false,
        actorMemberId: "admin-1",
      },
      { db },
    );

    expect(result).toEqual({ projectGroupId: "group-1", changed: true });
    expect(tx.projectGroup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "group-1",
        },
        data: {
          name: "Client Delivery",
          slug: "client-delivery",
          description: "Updated",
          active: false,
        },
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "project_group.updated",
          before: expect.objectContaining({
            name: "Client Work",
            slug: "client-work",
            description: "Billable delivery projects",
            active: true,
          }),
          after: expect.objectContaining({
            name: "Client Delivery",
            slug: "client-delivery",
            description: "Updated",
            active: false,
          }),
        }),
      }),
    );
  });

  it("archives project groups as a soft delete", async () => {
    const { db, tx } = createProjectGroupDb();
    const now = new Date("2026-07-20T10:30:00.000Z");

    const result = await archiveProjectGroup(
      {
        projectGroupId: "group-1",
        actorMemberId: "admin-1",
      },
      { db, now: () => now },
    );

    expect(result).toEqual({ projectGroupId: "group-1" });
    expect(tx.projectGroup.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          active: false,
          deletedAt: now,
        },
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "project_group.archived",
          targetType: "project_group",
          targetId: "group-1",
        }),
      }),
    );
  });

  it("adds and removes projects from groups with audit records", async () => {
    const { db, tx } = createProjectGroupDb();

    await expect(
      addProjectToGroup(
        {
          projectGroupId: "group-1",
          projectId: "project-1",
          actorMemberId: "admin-1",
        },
        { db },
      ),
    ).resolves.toEqual({
      projectGroupId: "group-1",
      projectId: "project-1",
      changed: true,
    });

    expect(tx.projectGroupProject.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          projectGroupId: "group-1",
          projectId: "project-1",
        },
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "project_group.project_added",
          targetId: "group-1:project-1",
        }),
      }),
    );

    tx.projectGroupProject.findUnique.mockResolvedValueOnce(baseLink);

    await expect(
      removeProjectFromGroup(
        {
          projectGroupId: "group-1",
          projectId: "project-1",
          actorMemberId: "admin-1",
        },
        { db },
      ),
    ).resolves.toEqual({
      projectGroupId: "group-1",
      projectId: "project-1",
      changed: true,
    });

    expect(tx.projectGroupProject.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectGroupId_projectId: {
            projectGroupId: "group-1",
            projectId: "project-1",
          },
        },
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "project_group.project_removed",
          targetId: "group-1:project-1",
        }),
      }),
    );
  });
});
