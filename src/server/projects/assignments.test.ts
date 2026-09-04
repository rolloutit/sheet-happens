import { describe, expect, it, vi } from "vitest";

import { TrackingModeSwitchError, type TrackingMode } from "@/src/server/time-tracking";
import {
  assignMemberToProject,
  bulkAssignMembersToProjects,
  closeProjectAssignment,
  listProjectAssignableMembersForAdmin,
  listProjectAssignmentsForAdmin,
  ProjectAssignmentError,
  updateProjectAssignment,
} from "./assignments";

type TestProject = {
  id: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  deletedAt: Date | null;
};

type TestMember = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  status: "INVITED" | "ACTIVE" | "INACTIVE" | "DELETED";
  currentProfile: "CONTRACTOR" | "EMPLOYEE";
  defaultTrackingMode: TrackingMode;
  deletedAt: Date | null;
};

type TestAssignment = {
  id: string;
  projectId: string;
  memberId: string;
  active: boolean;
  validFrom: Date;
  validTo: Date | null;
  trackingMode: TrackingMode | null;
  notes: string | null;
  member: {
    defaultTrackingMode: TrackingMode;
  };
};

const baseProject: TestProject = {
  id: "project-1",
  status: "ACTIVE",
  deletedAt: null,
};

const invitedMember: TestMember = {
  id: "member-1",
  email: "contractor@example.com",
  firstName: "Contractor",
  lastName: "Example",
  displayName: "Contractor Example",
  status: "INVITED",
  currentProfile: "CONTRACTOR",
  defaultTrackingMode: "TRACKED",
  deletedAt: null,
};

const baseAssignment: TestAssignment = {
  id: "assignment-1",
  projectId: "project-1",
  memberId: "member-1",
  active: true,
  validFrom: new Date("2026-07-01T00:00:00.000Z"),
  validTo: null,
  trackingMode: null,
  notes: null,
  member: {
    defaultTrackingMode: "TRACKED",
  },
};

function createAssignmentDb(
  overrides: {
    project?: TestProject | null;
    member?: TestMember | null;
    assignment?: TestAssignment | null;
    overlaps?: Array<Pick<TestAssignment, "id" | "validFrom" | "validTo">>;
    overlapsByPair?: Record<string, Array<Pick<TestAssignment, "id" | "validFrom" | "validTo">>>;
    members?: TestMember[];
    assignments?: Array<
      TestAssignment & {
        member: TestMember;
      }
    >;
    entries?: Array<{ projectId: string; localDate: Date; project: { name: string } }>;
    declarations?: Array<{ projectId: string; periodStart: Date; project: { name: string } }>;
    locks?: Array<{ periodStart: Date }>;
  } = {},
) {
  const tx = {
    project: {
      findUnique: vi.fn().mockResolvedValue(overrides.project ?? baseProject),
    },
    member: {
      findUnique: vi.fn().mockResolvedValue(overrides.member ?? invitedMember),
    },
    projectAssignment: {
      findUnique: vi.fn().mockResolvedValue(overrides.assignment ?? baseAssignment),
      findMany: vi.fn(
        async (args: { where: { memberId: string; projectId: string } }) =>
          overrides.overlapsByPair?.[`${args.where.memberId}:${args.where.projectId}`] ??
          overrides.overlaps ??
          [],
      ),
      create: vi.fn().mockResolvedValue({ id: "assignment-created" }),
      update: vi.fn().mockResolvedValue({ id: "assignment-1" }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
    timeEntry: {
      findMany: vi.fn().mockResolvedValue(overrides.entries ?? []),
    },
    monthlyHourDeclaration: {
      findMany: vi.fn().mockResolvedValue(overrides.declarations ?? []),
    },
    periodLock: {
      findMany: vi.fn().mockResolvedValue(overrides.locks ?? []),
    },
  };

  return {
    tx,
    db: {
      $transaction: vi.fn((callback) => callback(tx)),
      member: {
        findMany: vi.fn().mockResolvedValue(overrides.members ?? []),
      },
      projectAssignment: {
        findMany: vi.fn().mockResolvedValue(overrides.assignments ?? []),
      },
    },
  };
}

describe("project assignment services", () => {
  it("lists invited and active members as assignable", async () => {
    const { db } = createAssignmentDb({
      members: [
        invitedMember,
        {
          ...invitedMember,
          id: "member-2",
          email: "employee@example.com",
          displayName: "Employee Example",
          status: "ACTIVE",
          currentProfile: "EMPLOYEE",
        },
      ],
    });

    await expect(listProjectAssignableMembersForAdmin({ db })).resolves.toEqual([
      {
        id: "member-1",
        name: "Contractor Example",
        email: "contractor@example.com",
        status: "INVITED",
        profile: "CONTRACTOR",
      },
      {
        id: "member-2",
        name: "Employee Example",
        email: "employee@example.com",
        status: "ACTIVE",
        profile: "EMPLOYEE",
      },
    ]);
  });

  it("maps project assignments for the admin view", async () => {
    const { db } = createAssignmentDb({
      assignments: [
        {
          ...baseAssignment,
          validTo: new Date("2026-12-31T00:00:00.000Z"),
          notes: "Main client work",
          member: invitedMember,
        },
      ],
    });

    await expect(listProjectAssignmentsForAdmin({ db })).resolves.toEqual([
      {
        id: "assignment-1",
        projectId: "project-1",
        memberId: "member-1",
        memberName: "Contractor Example",
        memberEmail: "contractor@example.com",
        memberStatus: "INVITED",
        memberProfile: "CONTRACTOR",
        active: true,
        validFrom: "2026-07-01",
        validTo: "2026-12-31",
        trackingMode: null,
        memberDefaultTrackingMode: "TRACKED",
        effectiveTrackingMode: "TRACKED",
        trackingModeSource: "MEMBER_DEFAULT",
        notes: "Main client work",
      },
    ]);
  });

  it("assigns invited members and stores ownership plus audit data", async () => {
    const { db, tx } = createAssignmentDb();

    const result = await assignMemberToProject(
      {
        projectId: "project-1",
        memberId: "member-1",
        validFrom: new Date("2026-08-10T15:45:00.000Z"),
        validTo: null,
        active: true,
        notes: "Initial onboarding",
        actorMemberId: "admin-1",
        requestMetadata: {
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        },
      },
      { db },
    );

    expect(result).toEqual({ assignmentId: "assignment-created" });
    expect(tx.projectAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project-1",
          memberId: "member-1",
          active: true,
          validFrom: new Date("2026-08-10T00:00:00.000Z"),
          validTo: null,
          notes: "Initial onboarding",
          createdByMemberId: "admin-1",
          updatedByMemberId: "admin-1",
        }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "project_assignment.created",
          actorMemberId: "admin-1",
          targetType: "project_assignment",
          targetId: "assignment-created",
          after: expect.objectContaining({
            projectId: "project-1",
            memberId: "member-1",
            validFrom: "2026-08-10",
          }),
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        }),
      }),
    );
  });

  it("bulk assigns non-overlapping pairs and skips duplicates", async () => {
    const { db, tx } = createAssignmentDb({
      overlapsByPair: {
        "member-1:project-1": [
          {
            id: "assignment-existing",
            validFrom: new Date("2026-08-01T00:00:00.000Z"),
            validTo: null,
          },
        ],
      },
    });

    const result = await bulkAssignMembersToProjects(
      {
        projectIds: ["project-1"],
        memberIds: ["member-1", "member-2", "member-2"],
        validFrom: new Date("2026-08-10T15:45:00.000Z"),
        validTo: null,
        active: true,
        notes: "Bulk onboarding",
        actorMemberId: "admin-1",
        requestMetadata: {
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        },
      },
      { db },
    );

    expect(result).toEqual({
      assignmentIds: ["assignment-created"],
      createdCount: 1,
      skippedDuplicateCount: 1,
      skippedDuplicates: [
        {
          memberId: "member-1",
          projectId: "project-1",
        },
      ],
    });
    expect(tx.projectAssignment.create).toHaveBeenCalledTimes(1);
    expect(tx.projectAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project-1",
          memberId: "member-2",
          validFrom: new Date("2026-08-10T00:00:00.000Z"),
          notes: "Bulk onboarding",
          createdByMemberId: "admin-1",
          updatedByMemberId: "admin-1",
        }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "project_assignment.created",
          after: expect.objectContaining({
            bulk: true,
            projectId: "project-1",
            memberId: "member-2",
          }),
        }),
      }),
    );
  });

  it("rejects inactive members for new assignments", async () => {
    const { db, tx } = createAssignmentDb({
      member: {
        ...invitedMember,
        status: "INACTIVE",
      },
    });

    await expect(
      assignMemberToProject(
        {
          projectId: "project-1",
          memberId: "member-1",
          validFrom: new Date("2026-08-10T00:00:00.000Z"),
          actorMemberId: "admin-1",
        },
        { db },
      ),
    ).rejects.toBeInstanceOf(ProjectAssignmentError);

    expect(tx.projectAssignment.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("rejects overlapping assignments for the same member and project", async () => {
    const { db, tx } = createAssignmentDb({
      overlaps: [
        {
          id: "assignment-existing",
          validFrom: new Date("2026-08-01T00:00:00.000Z"),
          validTo: new Date("2026-08-31T00:00:00.000Z"),
        },
      ],
    });

    await expect(
      assignMemberToProject(
        {
          projectId: "project-1",
          memberId: "member-1",
          validFrom: new Date("2026-08-15T00:00:00.000Z"),
          validTo: new Date("2026-09-01T00:00:00.000Z"),
          actorMemberId: "admin-1",
        },
        { db },
      ),
    ).rejects.toBeInstanceOf(ProjectAssignmentError);

    expect(tx.projectAssignment.create).not.toHaveBeenCalled();
  });

  it("updates assignment fields and writes an audit diff", async () => {
    const { db, tx } = createAssignmentDb();

    const result = await updateProjectAssignment(
      {
        assignmentId: "assignment-1",
        validFrom: new Date("2026-07-01T00:00:00.000Z"),
        validTo: new Date("2026-12-31T00:00:00.000Z"),
        active: false,
        notes: "Ended after phase 1",
        actorMemberId: "admin-1",
      },
      { db },
    );

    expect(result).toEqual({ assignmentId: "assignment-1", changed: true });
    expect(tx.projectAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "assignment-1",
        },
        data: expect.objectContaining({
          validTo: new Date("2026-12-31T00:00:00.000Z"),
          active: false,
          notes: "Ended after phase 1",
          updatedByMemberId: "admin-1",
        }),
      }),
    );
    expect(tx.projectAssignment.update.mock.calls[0][0].data).not.toHaveProperty("validFrom");
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "project_assignment.updated",
          before: expect.objectContaining({
            validTo: null,
            active: true,
            notes: null,
          }),
          after: expect.objectContaining({
            validTo: "2026-12-31",
            active: false,
            notes: "Ended after phase 1",
          }),
        }),
      }),
    );
  });

  it("stores a tracking mode override and leaves the member default alone", async () => {
    const { db, tx } = createAssignmentDb();

    await updateProjectAssignment(
      {
        assignmentId: "assignment-1",
        validFrom: new Date("2026-07-01T00:00:00.000Z"),
        validTo: null,
        active: true,
        trackingMode: "DECLARED",
        notes: null,
        actorMemberId: "admin-1",
      },
      { db },
    );

    expect(tx.projectAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          trackingMode: "DECLARED",
        }),
      }),
    );
  });

  it("refuses a switch to declared while an open month still holds tracked entries", async () => {
    const { db, tx } = createAssignmentDb({
      entries: [
        {
          projectId: "project-1",
          localDate: new Date("2026-09-03T00:00:00.000Z"),
          project: { name: "Nimbus" },
        },
      ],
    });

    const error = await updateProjectAssignment(
      {
        assignmentId: "assignment-1",
        validFrom: new Date("2026-07-01T00:00:00.000Z"),
        validTo: null,
        active: true,
        trackingMode: "DECLARED",
        notes: null,
        actorMemberId: "admin-1",
      },
      { db },
    ).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(TrackingModeSwitchError);
    expect((error as TrackingModeSwitchError).conflicts).toEqual([
      {
        kind: "TRACKED_ENTRIES",
        projectId: "project-1",
        projectName: "Nimbus",
        periodStart: "2026-09-01",
        count: 1,
      },
    ]);
    expect(tx.projectAssignment.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("allows a switch when the month holding entries is already locked", async () => {
    const { db, tx } = createAssignmentDb({
      entries: [
        {
          projectId: "project-1",
          localDate: new Date("2026-08-11T00:00:00.000Z"),
          project: { name: "Nimbus" },
        },
      ],
      locks: [{ periodStart: new Date("2026-08-01T00:00:00.000Z") }],
    });

    await expect(
      updateProjectAssignment(
        {
          assignmentId: "assignment-1",
          validFrom: new Date("2026-07-01T00:00:00.000Z"),
          validTo: null,
          active: true,
          trackingMode: "DECLARED",
          notes: null,
          actorMemberId: "admin-1",
        },
        { db },
      ),
    ).resolves.toEqual({ assignmentId: "assignment-1", changed: true });
    expect(tx.projectAssignment.update).toHaveBeenCalled();
  });

  /**
   * Pinning the inherited mode as an explicit override changes provenance, not what the member may
   * record, so the guard must not read it as a switch and refuse it.
   */
  it("does not run the guard when only the override provenance changes", async () => {
    const { db, tx } = createAssignmentDb({
      entries: [
        {
          projectId: "project-1",
          localDate: new Date("2026-09-03T00:00:00.000Z"),
          project: { name: "Nimbus" },
        },
      ],
    });

    await expect(
      updateProjectAssignment(
        {
          assignmentId: "assignment-1",
          validFrom: new Date("2026-07-01T00:00:00.000Z"),
          validTo: null,
          active: true,
          trackingMode: "TRACKED",
          notes: null,
          actorMemberId: "admin-1",
        },
        { db },
      ),
    ).resolves.toEqual({ assignmentId: "assignment-1", changed: true });
    expect(tx.timeEntry.findMany).not.toHaveBeenCalled();
  });

  it("closes assignments by setting an end date and inactive state", async () => {
    const { db, tx } = createAssignmentDb();

    const result = await closeProjectAssignment(
      {
        assignmentId: "assignment-1",
        validTo: new Date("2026-08-20T12:00:00.000Z"),
        actorMemberId: "admin-1",
      },
      { db },
    );

    expect(result).toEqual({ assignmentId: "assignment-1" });
    expect(tx.projectAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          active: false,
          validTo: new Date("2026-08-20T00:00:00.000Z"),
          updatedByMemberId: "admin-1",
        },
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "project_assignment.closed",
          before: {
            active: true,
            validTo: null,
          },
          after: {
            active: false,
            validTo: "2026-08-20",
          },
        }),
      }),
    );
  });
});
