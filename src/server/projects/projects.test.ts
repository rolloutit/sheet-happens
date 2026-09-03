import { describe, expect, it, vi } from "vitest";

import {
  archiveProject,
  buildProjectWhere,
  changeProjectStatus,
  createProject,
  listProjectDirectoryForAdmin,
  listProjectsForAdmin,
  normalizeProjectFilters,
  ProjectManagementError,
  updateProject,
} from "./projects";

type TestProject = {
  id: string;
  name: string;
  slug: string;
  colorToken: "teal" | "cyan" | "amber";
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  startsOn: Date | null;
  endsOn: Date | null;
  isInternal: boolean;
  notes: string | null;
  deletedAt: Date | null;
};

const baseProject: TestProject = {
  id: "project-1",
  name: "Existing Project",
  slug: "existing-project",
  colorToken: "teal",
  status: "ACTIVE",
  startsOn: new Date("2026-07-01T00:00:00.000Z"),
  endsOn: null,
  isInternal: false,
  notes: null,
  deletedAt: null,
};

function createProjectDb(
  overrides: {
    project?: TestProject | null;
    slugProject?: TestProject | null;
    counts?: number[];
    projects?: Array<
      TestProject & {
        updatedAt: Date;
        groupProjects: Array<{
          projectGroup: {
            id: string;
            name: string;
            slug: string;
            deletedAt: Date | null;
          };
        }>;
        _count: {
          assignments: number;
        };
      }
    >;
  } = {},
) {
  const tx = {
    project: {
      findUnique: vi.fn(async (args: { where: { id?: string; slug?: string } }) => {
        if (args.where.slug) return overrides.slugProject ?? null;
        if (args.where.id) return overrides.project ?? baseProject;
        return null;
      }),
      create: vi.fn().mockResolvedValue({ id: "project-created", slug: "client-portal" }),
      update: vi.fn().mockResolvedValue({ id: "project-1" }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
  };

  return {
    tx,
    db: {
      $transaction: vi.fn((callback) => callback(tx)),
      project: {
        count: vi.fn().mockImplementation(() => Promise.resolve(overrides.counts?.shift() ?? 0)),
        findMany: vi.fn().mockResolvedValue(overrides.projects ?? []),
      },
    },
  };
}

describe("project management services", () => {
  it("creates a project with required ownership fields and an audit snapshot", async () => {
    const { db, tx } = createProjectDb();

    const result = await createProject(
      {
        name: " Client Portal ",
        slug: "Client Portal",
        colorToken: "amber",
        startsOn: new Date("2026-08-09T13:45:00.000Z"),
        isInternal: true,
        notes: " Launch work ",
        actorMemberId: "admin-1",
        requestMetadata: {
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        },
      },
      { db },
    );

    expect(tx.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Client Portal",
          slug: "client-portal",
          colorToken: "amber",
          status: "ACTIVE",
          startsOn: new Date("2026-08-09T00:00:00.000Z"),
          endsOn: null,
          isInternal: true,
          notes: "Launch work",
          createdByMemberId: "admin-1",
          updatedByMemberId: "admin-1",
        }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "project.created",
          actorMemberId: "admin-1",
          targetId: "project-created",
          targetType: "project",
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
          after: expect.objectContaining({
            slug: "client-portal",
            colorToken: "amber",
            startsOn: "2026-08-09",
          }),
        }),
      }),
    );
    expect(result).toEqual({ id: "project-created", slug: "client-portal" });
  });

  it("rejects duplicate project slugs", async () => {
    const { db, tx } = createProjectDb({
      slugProject: baseProject,
    });

    await expect(
      createProject(
        {
          name: "Existing Project",
          actorMemberId: "admin-1",
        },
        { db },
      ),
    ).rejects.toBeInstanceOf(ProjectManagementError);

    expect(tx.project.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("updates changed fields and writes an audit diff", async () => {
    const { db, tx } = createProjectDb();

    const result = await updateProject(
      {
        projectId: "project-1",
        name: "Existing Project Renamed",
        slug: "existing-project-renamed",
        colorToken: "cyan",
        startsOn: new Date("2026-07-01T12:00:00.000Z"),
        endsOn: null,
        isInternal: true,
        notes: "Updated scope",
        actorMemberId: "admin-1",
      },
      { db },
    );

    expect(result).toEqual({ projectId: "project-1", changed: true });
    expect(tx.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "project-1",
        },
        data: expect.objectContaining({
          name: "Existing Project Renamed",
          slug: "existing-project-renamed",
          colorToken: "cyan",
          isInternal: true,
          notes: "Updated scope",
          updatedByMemberId: "admin-1",
        }),
      }),
    );
    expect(tx.project.update.mock.calls[0][0].data).not.toHaveProperty("startsOn");
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "project.updated",
          before: expect.objectContaining({
            name: "Existing Project",
            slug: "existing-project",
            colorToken: "teal",
            isInternal: false,
            notes: null,
          }),
          after: expect.objectContaining({
            name: "Existing Project Renamed",
            slug: "existing-project-renamed",
            colorToken: "cyan",
            isInternal: true,
            notes: "Updated scope",
          }),
        }),
      }),
    );
  });

  it("skips update and audit work when the project input is unchanged", async () => {
    const { db, tx } = createProjectDb();

    const result = await updateProject(
      {
        projectId: "project-1",
        name: "Existing Project",
        slug: "existing-project",
        colorToken: "teal",
        startsOn: new Date("2026-07-01T00:00:00.000Z"),
        endsOn: null,
        isInternal: false,
        notes: null,
        actorMemberId: "admin-1",
      },
      { db },
    );

    expect(result).toEqual({ projectId: "project-1", changed: false });
    expect(tx.project.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("changes active state and stores the actor", async () => {
    const { db, tx } = createProjectDb();

    const result = await changeProjectStatus(
      {
        projectId: "project-1",
        status: "INACTIVE",
        actorMemberId: "admin-1",
      },
      { db },
    );

    expect(result).toEqual({ projectId: "project-1", changed: true });
    expect(tx.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: "INACTIVE",
          updatedByMemberId: "admin-1",
        },
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "project.status_changed",
          before: {
            status: "ACTIVE",
          },
          after: {
            status: "INACTIVE",
          },
        }),
      }),
    );
  });

  it("archives projects as a soft delete and stores the actor", async () => {
    const { db, tx } = createProjectDb();
    const now = new Date("2026-07-20T10:30:00.000Z");

    const result = await archiveProject(
      {
        projectId: "project-1",
        actorMemberId: "admin-1",
      },
      {
        db,
        now: () => now,
      },
    );

    expect(result).toEqual({ projectId: "project-1" });
    expect(tx.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: "ARCHIVED",
          deletedAt: now,
          updatedByMemberId: "admin-1",
        },
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "project.archived",
          before: {
            status: "ACTIVE",
            deletedAt: null,
          },
          after: {
            status: "ARCHIVED",
            deletedAt: now,
          },
        }),
      }),
    );
  });

  it("maps projects for the admin directory", async () => {
    const { db } = createProjectDb({
      projects: [
        {
          ...baseProject,
          endsOn: new Date("2026-12-31T00:00:00.000Z"),
          updatedAt: new Date("2026-07-12T10:15:00.000Z"),
          groupProjects: [
            {
              projectGroup: {
                id: "group-1",
                name: "Client Work",
                slug: "client-work",
                deletedAt: null,
              },
            },
            {
              projectGroup: {
                id: "group-archived",
                name: "Archived Group",
                slug: "archived-group",
                deletedAt: new Date("2026-07-10T10:00:00.000Z"),
              },
            },
          ],
          _count: {
            assignments: 3,
          },
        },
      ],
    });

    await expect(listProjectsForAdmin({ db })).resolves.toEqual([
      {
        id: "project-1",
        name: "Existing Project",
        slug: "existing-project",
        colorToken: "teal",
        status: "ACTIVE",
        startsOn: "2026-07-01",
        endsOn: "2026-12-31",
        isInternal: false,
        notes: null,
        assignmentCount: 3,
        groupCount: 1,
        groups: [
          {
            id: "group-1",
            name: "Client Work",
            slug: "client-work",
          },
        ],
        updatedAt: "2026-07-12T10:15:00.000Z",
      },
    ]);
  });

  it("normalizes project directory filters", () => {
    expect(
      normalizeProjectFilters({
        q: "  Anna  ",
        status: "ACTIVE",
        type: "external",
        timeline: "current",
        group: "ungrouped",
        assignment: "assigned",
        page: "3",
        pageSize: "500",
      }),
    ).toEqual({
      query: "Anna",
      status: "ACTIVE",
      type: "external",
      timelines: ["current"],
      groups: ["ungrouped"],
      assignment: "assigned",
      page: 3,
      pageSize: 100,
    });

    expect(
      normalizeProjectFilters({
        status: "ARCHIVED",
        type: "client",
        timeline: "old",
        assignment: "all",
        page: "-1",
        pageSize: "0",
      }),
    ).toMatchObject({
      status: "",
      type: "",
      timelines: [],
      assignment: "",
      page: 1,
      pageSize: 20,
    });
  });

  /**
   * Timeline and group take several values. Neither is a plain column: each timeline is its
   * own date comparison, and `ungrouped` is the absence of a group rather than one of them,
   * so both fold into an `OR` instead of an `in`.
   */
  it("matches any of several timelines", () => {
    const where = buildProjectWhere(
      normalizeProjectFilters({ timeline: ["future", "ended"] }),
      new Date("2026-07-26T00:00:00.000Z"),
    );

    expect(where.AND).toEqual(
      expect.arrayContaining([
        {
          OR: [
            { startsOn: { gt: new Date("2026-07-26T00:00:00.000Z") } },
            { endsOn: { lt: new Date("2026-07-26T00:00:00.000Z") } },
          ],
        },
      ]),
    );
  });

  it("matches any of several groups, ungrouped included", () => {
    const where = buildProjectWhere(
      normalizeProjectFilters({ group: ["ungrouped", "group-1", "group-2"] }),
      new Date("2026-07-26T00:00:00.000Z"),
    );

    expect(where.AND).toEqual(
      expect.arrayContaining([
        {
          OR: [
            { groupProjects: { none: { projectGroup: { deletedAt: null } } } },
            {
              groupProjects: {
                some: {
                  projectGroupId: { in: ["group-1", "group-2"] },
                  projectGroup: { deletedAt: null },
                },
              },
            },
          ],
        },
      ]),
    );
  });

  it("builds relational project search filters", () => {
    const where = buildProjectWhere(
      normalizeProjectFilters({
        q: "Anna",
        status: "ACTIVE",
        type: "external",
        timeline: "current",
        group: "ungrouped",
        assignment: "unassigned",
      }),
      new Date("2026-07-26T00:00:00.000Z"),
    );

    expect(where).toEqual({
      AND: expect.arrayContaining([
        {
          deletedAt: null,
        },
        {
          status: "ACTIVE",
        },
        {
          isInternal: false,
        },
        {
          groupProjects: {
            none: {
              projectGroup: {
                deletedAt: null,
              },
            },
          },
        },
        {
          assignments: {
            none: expect.objectContaining({
              active: true,
              member: expect.objectContaining({
                deletedAt: null,
              }),
            }),
          },
        },
        expect.objectContaining({
          OR: expect.arrayContaining([
            {
              name: {
                contains: "Anna",
                mode: "insensitive",
              },
            },
            {
              assignments: {
                some: {
                  member: expect.objectContaining({
                    OR: expect.arrayContaining([
                      {
                        email: {
                          contains: "Anna",
                          mode: "insensitive",
                        },
                      },
                    ]),
                  }),
                },
              },
            },
          ]),
        }),
      ]),
    });
  });

  it("returns a paginated project directory result with stats", async () => {
    const { db } = createProjectDb({
      counts: [42, 60, 25, 5],
      projects: [
        {
          ...baseProject,
          updatedAt: new Date("2026-07-12T10:15:00.000Z"),
          groupProjects: [],
          _count: {
            assignments: 3,
          },
        },
      ],
    });

    const result = await listProjectDirectoryForAdmin(
      {
        page: "3",
      },
      {
        db,
        today: new Date("2026-07-26T00:00:00.000Z"),
      },
    );

    expect(db.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 40,
        take: 20,
      }),
    );
    expect(result).toMatchObject({
      totalItems: 42,
      totalPages: 3,
      pageStart: 41,
      pageEnd: 41,
      stats: {
        totalProjects: 60,
        activeProjects: 25,
        internalProjects: 5,
      },
      rows: [
        expect.objectContaining({
          id: "project-1",
          name: "Existing Project",
        }),
      ],
    });
  });
});
