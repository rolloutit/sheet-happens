import { prisma } from "@/src/server/db/client";

import type { ProjectRequestMetadata } from "./projects";

export type ProjectAssignmentMemberStatus = "INVITED" | "ACTIVE" | "INACTIVE" | "DELETED";
export type ProjectAssignmentMemberProfile = "CONTRACTOR" | "EMPLOYEE";
export type ProjectAssignmentProjectStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type ProjectAssignmentInput = {
  validFrom: Date;
  validTo?: Date | null;
  active?: boolean;
  notes?: string | null;
};

export type AssignMemberToProjectInput = ProjectAssignmentInput & {
  projectId: string;
  memberId: string;
  actorMemberId: string;
  requestMetadata?: ProjectRequestMetadata;
};

export type UpdateProjectAssignmentInput = ProjectAssignmentInput & {
  assignmentId: string;
  actorMemberId: string;
  requestMetadata?: ProjectRequestMetadata;
};

export type CloseProjectAssignmentInput = {
  assignmentId: string;
  validTo: Date;
  actorMemberId: string;
  requestMetadata?: ProjectRequestMetadata;
};

export type AdminProjectAssignmentRow = {
  id: string;
  projectId: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  memberStatus: ProjectAssignmentMemberStatus;
  memberProfile: ProjectAssignmentMemberProfile;
  active: boolean;
  validFrom: string;
  validTo: string | null;
  notes: string | null;
};

export type ProjectAssignableMemberRow = {
  id: string;
  name: string;
  email: string;
  status: Extract<ProjectAssignmentMemberStatus, "INVITED" | "ACTIVE">;
  profile: ProjectAssignmentMemberProfile;
};

type ProjectAssignmentDb = {
  $transaction<T>(callback: (tx: ProjectAssignmentTransaction) => Promise<T>): Promise<T>;
  member: {
    findMany(args: {
      where: {
        deletedAt: null;
        status: {
          in: Array<Extract<ProjectAssignmentMemberStatus, "INVITED" | "ACTIVE">>;
        };
      };
      orderBy: Array<Record<string, "asc" | "desc">>;
      select: MemberSelect;
    }): Promise<MemberRecord[]>;
  };
  projectAssignment: {
    findMany(args: {
      where: {
        project: {
          deletedAt: null;
        };
      };
      orderBy: Array<Record<string, "asc" | "desc">>;
      select: ProjectAssignmentListSelect;
    }): Promise<ProjectAssignmentListRecord[]>;
  };
};

type ProjectAssignmentTransaction = {
  project: {
    findUnique(args: {
      where: {
        id: string;
      };
      select: ProjectSelect;
    }): Promise<ProjectRecord | null>;
  };
  member: {
    findUnique(args: {
      where: {
        id: string;
      };
      select: MemberSelect;
    }): Promise<MemberRecord | null>;
  };
  projectAssignment: {
    findUnique(args: {
      where: {
        id: string;
      };
      select: ProjectAssignmentSelect;
    }): Promise<ProjectAssignmentRecord | null>;
    findMany(args: {
      where: {
        memberId: string;
        projectId: string;
      };
      select: ProjectAssignmentOverlapSelect;
    }): Promise<ProjectAssignmentOverlapRecord[]>;
    create(args: {
      data: {
        projectId: string;
        memberId: string;
        active: boolean;
        validFrom: Date;
        validTo: Date | null;
        notes: string | null;
        createdByMemberId: string;
        updatedByMemberId: string;
      };
      select: {
        id: true;
      };
    }): Promise<{ id: string }>;
    update(args: {
      where: {
        id: string;
      };
      data: Partial<{
        active: boolean;
        validFrom: Date;
        validTo: Date | null;
        notes: string | null;
        updatedByMemberId: string;
      }>;
      select: {
        id: true;
      };
    }): Promise<{ id: string }>;
  };
  auditLog: {
    create(args: {
      data: {
        actorMemberId: string;
        action: string;
        targetType: "project_assignment";
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
  status: true;
  deletedAt: true;
};

type ProjectRecord = {
  id: string;
  status: ProjectAssignmentProjectStatus;
  deletedAt: Date | null;
};

type MemberSelect = {
  id: true;
  email: true;
  firstName: true;
  lastName: true;
  displayName: true;
  status: true;
  currentProfile: true;
  deletedAt: true;
};

type MemberRecord = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  status: ProjectAssignmentMemberStatus;
  currentProfile: ProjectAssignmentMemberProfile;
  deletedAt: Date | null;
};

type ProjectAssignmentSelect = {
  id: true;
  projectId: true;
  memberId: true;
  active: true;
  validFrom: true;
  validTo: true;
  notes: true;
};

type ProjectAssignmentRecord = {
  id: string;
  projectId: string;
  memberId: string;
  active: boolean;
  validFrom: Date;
  validTo: Date | null;
  notes: string | null;
};

type ProjectAssignmentOverlapSelect = {
  id: true;
  validFrom: true;
  validTo: true;
};

type ProjectAssignmentOverlapRecord = {
  id: string;
  validFrom: Date;
  validTo: Date | null;
};

type ProjectAssignmentListSelect = ProjectAssignmentSelect & {
  member: {
    select: MemberSelect;
  };
};

type ProjectAssignmentListRecord = ProjectAssignmentRecord & {
  member: MemberRecord;
};

type NormalizedAssignmentInput = {
  validFrom: Date;
  validTo: Date | null;
  active: boolean;
  notes: string | null;
};

type AssignmentChangeSet = {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  data: Partial<NormalizedAssignmentInput>;
};

const projectSelect = {
  id: true,
  status: true,
  deletedAt: true,
} satisfies ProjectSelect;

const memberSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  displayName: true,
  status: true,
  currentProfile: true,
  deletedAt: true,
} satisfies MemberSelect;

const assignmentSelect = {
  id: true,
  projectId: true,
  memberId: true,
  active: true,
  validFrom: true,
  validTo: true,
  notes: true,
} satisfies ProjectAssignmentSelect;

const assignmentOverlapSelect = {
  id: true,
  validFrom: true,
  validTo: true,
} satisfies ProjectAssignmentOverlapSelect;

export class ProjectAssignmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectAssignmentError";
  }
}

export async function listProjectAssignableMembersForAdmin(
  deps: { db?: ProjectAssignmentDb } = {},
): Promise<ProjectAssignableMemberRow[]> {
  const db = deps.db ?? (prisma as unknown as ProjectAssignmentDb);
  const members = await db.member.findMany({
    where: {
      deletedAt: null,
      status: {
        in: ["INVITED", "ACTIVE"],
      },
    },
    orderBy: [{ displayName: "asc" }, { email: "asc" }],
    select: memberSelect,
  });

  return members.map(mapMemberToAssignableRow);
}

export async function listProjectAssignmentsForAdmin(
  deps: { db?: ProjectAssignmentDb } = {},
): Promise<AdminProjectAssignmentRow[]> {
  const db = deps.db ?? (prisma as unknown as ProjectAssignmentDb);
  const assignments = await db.projectAssignment.findMany({
    where: {
      project: {
        deletedAt: null,
      },
    },
    orderBy: [{ active: "desc" }, { validFrom: "desc" }],
    select: {
      ...assignmentSelect,
      member: {
        select: memberSelect,
      },
    },
  });

  return assignments.map(mapAssignmentToAdminRow);
}

export async function assignMemberToProject(
  input: AssignMemberToProjectInput,
  deps: { db?: ProjectAssignmentDb } = {},
) {
  const db = deps.db ?? (prisma as unknown as ProjectAssignmentDb);
  const assignment = normalizeAssignmentInput(input);

  return db.$transaction(async (tx) => {
    await findAssignableProject(tx, input.projectId);
    await findAssignableMember(tx, input.memberId);
    await assertNoAssignmentOverlap(tx, {
      projectId: input.projectId,
      memberId: input.memberId,
      validFrom: assignment.validFrom,
      validTo: assignment.validTo,
    });

    const created = await tx.projectAssignment.create({
      data: {
        projectId: input.projectId,
        memberId: input.memberId,
        ...assignment,
        createdByMemberId: input.actorMemberId,
        updatedByMemberId: input.actorMemberId,
      },
      select: {
        id: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "project_assignment.created",
        targetType: "project_assignment",
        targetId: created.id,
        after: {
          projectId: input.projectId,
          memberId: input.memberId,
          ...serializeAssignmentInput(assignment),
        },
        ...input.requestMetadata,
      },
    });

    return {
      assignmentId: created.id,
    };
  });
}

export async function updateProjectAssignment(
  input: UpdateProjectAssignmentInput,
  deps: { db?: ProjectAssignmentDb } = {},
) {
  const db = deps.db ?? (prisma as unknown as ProjectAssignmentDb);
  const nextAssignment = normalizeAssignmentInput(input);

  return db.$transaction(async (tx) => {
    const currentAssignment = await findAssignment(tx, input.assignmentId);
    await findAssignableProject(tx, currentAssignment.projectId);
    await assertNoAssignmentOverlap(
      tx,
      {
        projectId: currentAssignment.projectId,
        memberId: currentAssignment.memberId,
        validFrom: nextAssignment.validFrom,
        validTo: nextAssignment.validTo,
      },
      currentAssignment.id,
    );

    const changes = getAssignmentChanges(currentAssignment, nextAssignment);

    if (!Object.keys(changes.after).length) {
      return {
        assignmentId: currentAssignment.id,
        changed: false,
      };
    }

    await tx.projectAssignment.update({
      where: {
        id: currentAssignment.id,
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
        action: "project_assignment.updated",
        targetType: "project_assignment",
        targetId: currentAssignment.id,
        before: changes.before,
        after: changes.after,
        ...input.requestMetadata,
      },
    });

    return {
      assignmentId: currentAssignment.id,
      changed: true,
    };
  });
}

export async function closeProjectAssignment(
  input: CloseProjectAssignmentInput,
  deps: { db?: ProjectAssignmentDb } = {},
) {
  const db = deps.db ?? (prisma as unknown as ProjectAssignmentDb);
  const validTo = normalizeDateOnly(input.validTo, "Assignment end date is required.");

  return db.$transaction(async (tx) => {
    const currentAssignment = await findAssignment(tx, input.assignmentId);
    await findAssignableProject(tx, currentAssignment.projectId);

    if (validTo < currentAssignment.validFrom) {
      throw new ProjectAssignmentError("Assignment end date cannot be before the start date.");
    }

    await assertNoAssignmentOverlap(
      tx,
      {
        projectId: currentAssignment.projectId,
        memberId: currentAssignment.memberId,
        validFrom: currentAssignment.validFrom,
        validTo,
      },
      currentAssignment.id,
    );

    await tx.projectAssignment.update({
      where: {
        id: currentAssignment.id,
      },
      data: {
        active: false,
        validTo,
        updatedByMemberId: input.actorMemberId,
      },
      select: {
        id: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorMemberId: input.actorMemberId,
        action: "project_assignment.closed",
        targetType: "project_assignment",
        targetId: currentAssignment.id,
        before: {
          active: currentAssignment.active,
          validTo: serializeAuditValue(currentAssignment.validTo),
        },
        after: {
          active: false,
          validTo: formatDateOnly(validTo),
        },
        ...input.requestMetadata,
      },
    });

    return {
      assignmentId: currentAssignment.id,
    };
  });
}

function normalizeAssignmentInput(input: ProjectAssignmentInput): NormalizedAssignmentInput {
  const validFrom = normalizeDateOnly(input.validFrom, "Assignment start date is required.");
  const validTo = input.validTo
    ? normalizeDateOnly(input.validTo, "Choose a valid assignment end date.")
    : null;
  const notes = input.notes?.trim() || null;

  if (validTo && validTo < validFrom) {
    throw new ProjectAssignmentError("Assignment end date cannot be before the start date.");
  }

  return {
    validFrom,
    validTo,
    active: input.active ?? true,
    notes,
  };
}

async function findAssignableProject(tx: ProjectAssignmentTransaction, projectId: string) {
  const project = await tx.project.findUnique({
    where: {
      id: projectId,
    },
    select: projectSelect,
  });

  if (!project || project.deletedAt || project.status === "ARCHIVED") {
    throw new ProjectAssignmentError("Project does not exist or is archived.");
  }

  return project;
}

async function findAssignableMember(tx: ProjectAssignmentTransaction, memberId: string) {
  const member = await tx.member.findUnique({
    where: {
      id: memberId,
    },
    select: memberSelect,
  });

  if (!member || member.deletedAt || member.status === "DELETED") {
    throw new ProjectAssignmentError("Member does not exist.");
  }

  if (member.status !== "INVITED" && member.status !== "ACTIVE") {
    throw new ProjectAssignmentError("Only invited or active members can be assigned to projects.");
  }

  return member;
}

async function findAssignment(tx: ProjectAssignmentTransaction, assignmentId: string) {
  const assignment = await tx.projectAssignment.findUnique({
    where: {
      id: assignmentId,
    },
    select: assignmentSelect,
  });

  if (!assignment) {
    throw new ProjectAssignmentError("Project assignment does not exist.");
  }

  return assignment;
}

async function assertNoAssignmentOverlap(
  tx: ProjectAssignmentTransaction,
  input: {
    projectId: string;
    memberId: string;
    validFrom: Date;
    validTo: Date | null;
  },
  excludedAssignmentId?: string,
) {
  const existingAssignments = await tx.projectAssignment.findMany({
    where: {
      memberId: input.memberId,
      projectId: input.projectId,
    },
    select: assignmentOverlapSelect,
  });

  const overlappingAssignment = existingAssignments.find((assignment) => {
    if (assignment.id === excludedAssignmentId) return false;
    return assignmentRangesOverlap(input, assignment);
  });

  if (overlappingAssignment) {
    throw new ProjectAssignmentError(
      "This member already has a project assignment in the selected date range.",
    );
  }
}

function assignmentRangesOverlap(
  left: { validFrom: Date; validTo: Date | null },
  right: { validFrom: Date; validTo: Date | null },
) {
  const leftEnd = left.validTo?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightEnd = right.validTo?.getTime() ?? Number.POSITIVE_INFINITY;

  return left.validFrom.getTime() <= rightEnd && right.validFrom.getTime() <= leftEnd;
}

function getAssignmentChanges(
  current: ProjectAssignmentRecord,
  next: NormalizedAssignmentInput,
): AssignmentChangeSet {
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  const data: Partial<NormalizedAssignmentInput> = {};

  for (const key of Object.keys(next) as Array<keyof NormalizedAssignmentInput>) {
    collectAssignmentChange(key, current, next, before, after, data);
  }

  return {
    before,
    after,
    data,
  };
}

function collectAssignmentChange<K extends keyof NormalizedAssignmentInput>(
  key: K,
  current: ProjectAssignmentRecord,
  next: NormalizedAssignmentInput,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  data: Partial<NormalizedAssignmentInput>,
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

function mapMemberToAssignableRow(member: MemberRecord): ProjectAssignableMemberRow {
  return {
    id: member.id,
    name: getMemberName(member),
    email: member.email,
    status: member.status as ProjectAssignableMemberRow["status"],
    profile: member.currentProfile,
  };
}

function mapAssignmentToAdminRow(
  assignment: ProjectAssignmentListRecord,
): AdminProjectAssignmentRow {
  return {
    id: assignment.id,
    projectId: assignment.projectId,
    memberId: assignment.memberId,
    memberName: getMemberName(assignment.member),
    memberEmail: assignment.member.email,
    memberStatus: assignment.member.status,
    memberProfile: assignment.member.currentProfile,
    active: assignment.active,
    validFrom: formatDateOnly(assignment.validFrom),
    validTo: assignment.validTo ? formatDateOnly(assignment.validTo) : null,
    notes: assignment.notes,
  };
}

function getMemberName(
  member: Pick<MemberRecord, "displayName" | "firstName" | "lastName" | "email">,
) {
  return (
    member.displayName.trim() ||
    [member.firstName.trim(), member.lastName.trim()].filter(Boolean).join(" ") ||
    member.email
  );
}

function serializeAssignmentInput(assignment: NormalizedAssignmentInput) {
  return {
    ...assignment,
    validFrom: formatDateOnly(assignment.validFrom),
    validTo: assignment.validTo ? formatDateOnly(assignment.validTo) : null,
  };
}

function serializeAuditValue(value: unknown) {
  return value instanceof Date ? formatDateOnly(value) : value;
}

function normalizeDateOnly(date: Date, message: string) {
  if (Number.isNaN(date.getTime())) {
    throw new ProjectAssignmentError(message);
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}
