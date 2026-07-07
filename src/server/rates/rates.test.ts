import { describe, expect, it, vi } from "vitest";

import {
  createAssignmentOverrideRate,
  createMemberDefaultRate,
  listAssignmentRatesForAdmin,
  listMemberRatesForAdmin,
  RateManagementError,
} from "./rates";

type TestMember = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  status: "INVITED" | "ACTIVE" | "INACTIVE" | "DELETED";
  currentProfile: "CONTRACTOR" | "EMPLOYEE";
  defaultCurrencyCode: string;
  deletedAt: Date | null;
};

type TestRatePeriod = {
  id: string;
  validFrom: Date;
  validTo: Date | null;
  hourlyRate: { toString(): string };
  currencyCode: string;
  createdAt: Date;
  createdBy: Pick<TestMember, "firstName" | "lastName" | "displayName" | "email">;
  note: string | null;
};

type TestAssignment = {
  id: string;
  projectId: string;
  memberId: string;
  member: TestMember;
  project: {
    id: string;
    name: string;
    deletedAt: Date | null;
  };
};

const contractorMember: TestMember = {
  id: "member-1",
  email: "contractor@example.com",
  firstName: "Contractor",
  lastName: "Example",
  displayName: "Contractor Example",
  status: "ACTIVE",
  currentProfile: "CONTRACTOR",
  defaultCurrencyCode: "EUR",
  deletedAt: null,
};

const employeeMember: TestMember = {
  ...contractorMember,
  id: "member-2",
  email: "employee@example.com",
  displayName: "Employee Example",
  currentProfile: "EMPLOYEE",
};

const baseRate: TestRatePeriod = {
  id: "rate-1",
  validFrom: new Date("2026-07-01T00:00:00.000Z"),
  validTo: null,
  hourlyRate: {
    toString: () => "95.00",
  },
  currencyCode: "EUR",
  createdAt: new Date("2026-07-01T08:30:00.000Z"),
  createdBy: {
    firstName: "Admin",
    lastName: "User",
    displayName: "Admin User",
    email: "admin@example.com",
  },
  note: null,
};

const contractorAssignment: TestAssignment = {
  id: "assignment-1",
  projectId: "project-1",
  memberId: "member-1",
  member: contractorMember,
  project: {
    id: "project-1",
    name: "Client Portal",
    deletedAt: null,
  },
};

function createRateDb(
  overrides: {
    member?: TestMember | null;
    assignment?: TestAssignment | null;
    memberRates?: TestRatePeriod[];
    assignmentRates?: TestRatePeriod[];
    members?: Array<TestMember & { defaultRatePeriods: TestRatePeriod[] }>;
    assignments?: Array<TestAssignment & { overrideRates: TestRatePeriod[] }>;
  } = {},
) {
  const tx = {
    member: {
      findUnique: vi.fn().mockResolvedValue(overrides.member ?? contractorMember),
    },
    projectAssignment: {
      findUnique: vi.fn().mockResolvedValue(overrides.assignment ?? contractorAssignment),
    },
    memberDefaultRatePeriod: {
      findMany: vi.fn().mockResolvedValue(overrides.memberRates ?? []),
      create: vi.fn().mockResolvedValue({ id: "member-rate-created" }),
      update: vi.fn().mockImplementation(({ where, data }) => {
        const existingRate =
          (overrides.memberRates ?? []).find((rate) => rate.id === where.id) ?? baseRate;

        return Promise.resolve({
          ...existingRate,
          validTo: data.validTo,
        });
      }),
    },
    assignmentRatePeriod: {
      findMany: vi.fn().mockResolvedValue(overrides.assignmentRates ?? []),
      create: vi.fn().mockResolvedValue({ id: "assignment-rate-created" }),
      update: vi.fn().mockImplementation(({ where, data }) => {
        const existingRate =
          (overrides.assignmentRates ?? []).find((rate) => rate.id === where.id) ?? baseRate;

        return Promise.resolve({
          ...existingRate,
          validTo: data.validTo,
        });
      }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
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

describe("rate management services", () => {
  it("lists central member rates for employees and contractors", async () => {
    const { db } = createRateDb({
      members: [
        {
          ...employeeMember,
          defaultRatePeriods: [baseRate],
        },
        {
          ...contractorMember,
          defaultRatePeriods: [],
        },
      ],
    });

    await expect(
      listMemberRatesForAdmin({
        db,
        now: () => new Date("2026-07-07T00:00:00.000Z"),
      }),
    ).resolves.toEqual([
      {
        memberId: "member-2",
        memberName: "Employee Example",
        memberEmail: "employee@example.com",
        memberStatus: "ACTIVE",
        memberProfile: "EMPLOYEE",
        defaultCurrencyCode: "EUR",
        currentRate: {
          id: "rate-1",
          validFrom: "2026-07-01",
          validTo: null,
          hourlyRate: "95.00",
          currencyCode: "EUR",
          createdAt: "2026-07-01T08:30:00.000Z",
          createdByName: "Admin User",
          note: null,
        },
        ratePeriods: [
          {
            id: "rate-1",
            validFrom: "2026-07-01",
            validTo: null,
            hourlyRate: "95.00",
            currencyCode: "EUR",
            createdAt: "2026-07-01T08:30:00.000Z",
            createdByName: "Admin User",
            note: null,
          },
        ],
      },
      {
        memberId: "member-1",
        memberName: "Contractor Example",
        memberEmail: "contractor@example.com",
        memberStatus: "ACTIVE",
        memberProfile: "CONTRACTOR",
        defaultCurrencyCode: "EUR",
        currentRate: null,
        ratePeriods: [],
      },
    ]);
  });

  it("creates a central member rate with normalized amount and audit data", async () => {
    const { db, tx } = createRateDb({
      member: employeeMember,
    });

    const result = await createMemberDefaultRate(
      {
        memberId: "member-2",
        validFrom: new Date("2026-08-10T12:00:00.000Z"),
        hourlyRate: "120.5",
        currencyCode: "eur",
        note: "Annual adjustment",
        actorMemberId: "admin-1",
        requestMetadata: {
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        },
      },
      { db },
    );

    expect(result).toEqual({ ratePeriodId: "member-rate-created" });
    expect(tx.memberDefaultRatePeriod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          memberId: "member-2",
          validFrom: new Date("2026-08-10T00:00:00.000Z"),
          validTo: null,
          hourlyRate: "120.50",
          currencyCode: "EUR",
          note: "Annual adjustment",
          createdByMemberId: "admin-1",
        }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "rate.member_default.created",
          targetType: "member_default_rate_period",
          targetId: "member-rate-created",
          after: expect.objectContaining({
            memberId: "member-2",
            validFrom: "2026-08-10",
            hourlyRate: "120.50",
            currencyCode: "EUR",
          }),
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        }),
      }),
    );
  });

  it("rejects overlapping central member rates", async () => {
    const { db, tx } = createRateDb({
      memberRates: [
        {
          ...baseRate,
          validTo: new Date("2026-09-01T00:00:00.000Z"),
        },
      ],
    });

    await expect(
      createMemberDefaultRate(
        {
          memberId: "member-1",
          validFrom: new Date("2026-08-01T00:00:00.000Z"),
          validTo: null,
          hourlyRate: "100",
          currencyCode: "EUR",
          actorMemberId: "admin-1",
        },
        { db },
      ),
    ).rejects.toBeInstanceOf(RateManagementError);

    expect(tx.memberDefaultRatePeriod.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("allows adjacent central member rate periods", async () => {
    const { db, tx } = createRateDb({
      memberRates: [
        {
          ...baseRate,
          validTo: new Date("2026-08-01T00:00:00.000Z"),
        },
      ],
    });

    await createMemberDefaultRate(
      {
        memberId: "member-1",
        validFrom: new Date("2026-08-01T00:00:00.000Z"),
        validTo: null,
        hourlyRate: "100",
        currencyCode: "EUR",
        actorMemberId: "admin-1",
      },
      { db },
    );

    expect(tx.memberDefaultRatePeriod.create).toHaveBeenCalled();
  });

  it("closes an open-ended central member rate when adding a future successor", async () => {
    const { db, tx } = createRateDb({
      memberRates: [baseRate],
    });

    await createMemberDefaultRate(
      {
        memberId: "member-1",
        validFrom: new Date("2026-08-01T00:00:00.000Z"),
        hourlyRate: "100",
        currencyCode: "EUR",
        actorMemberId: "admin-1",
      },
      { db },
    );

    expect(tx.memberDefaultRatePeriod.update).toHaveBeenCalledWith({
      where: {
        id: "rate-1",
      },
      data: {
        validTo: new Date("2026-08-01T00:00:00.000Z"),
      },
      select: expect.any(Object),
    });
    expect(tx.memberDefaultRatePeriod.create).toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "rate.member_default.closed_for_successor",
          targetType: "member_default_rate_period",
          targetId: "rate-1",
          before: expect.objectContaining({
            validFrom: "2026-07-01",
            validTo: null,
          }),
          after: expect.objectContaining({
            validTo: "2026-08-01",
            successorRatePeriodId: "member-rate-created",
          }),
        }),
      }),
    );
  });

  it("rejects replacing an open-ended central member rate on the same start day", async () => {
    const { db, tx } = createRateDb({
      memberRates: [baseRate],
    });

    await expect(
      createMemberDefaultRate(
        {
          memberId: "member-1",
          validFrom: new Date("2026-07-01T00:00:00.000Z"),
          hourlyRate: "100",
          currencyCode: "EUR",
          actorMemberId: "admin-1",
        },
        { db },
      ),
    ).rejects.toBeInstanceOf(RateManagementError);

    expect(tx.memberDefaultRatePeriod.update).not.toHaveBeenCalled();
    expect(tx.memberDefaultRatePeriod.create).not.toHaveBeenCalled();
  });

  it("rejects currency changes outside a future month boundary", async () => {
    const { db } = createRateDb({
      memberRates: [baseRate],
    });

    await expect(
      createMemberDefaultRate(
        {
          memberId: "member-1",
          validFrom: new Date("2026-07-20T00:00:00.000Z"),
          hourlyRate: "100",
          currencyCode: "HUF",
          actorMemberId: "admin-1",
        },
        {
          db,
          now: () => new Date("2026-07-07T00:00:00.000Z"),
        },
      ),
    ).rejects.toBeInstanceOf(RateManagementError);
  });

  it("allows currency changes on a future month boundary", async () => {
    const { db, tx } = createRateDb({
      memberRates: [
        {
          ...baseRate,
          validTo: new Date("2026-08-01T00:00:00.000Z"),
        },
      ],
    });

    await createMemberDefaultRate(
      {
        memberId: "member-1",
        validFrom: new Date("2026-08-01T00:00:00.000Z"),
        hourlyRate: "40000",
        currencyCode: "HUF",
        actorMemberId: "admin-1",
      },
      {
        db,
        now: () => new Date("2026-07-07T00:00:00.000Z"),
      },
    );

    expect(tx.memberDefaultRatePeriod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currencyCode: "HUF",
          validFrom: new Date("2026-08-01T00:00:00.000Z"),
        }),
      }),
    );
  });

  it("lists assignment override rates", async () => {
    const { db } = createRateDb({
      assignments: [
        {
          ...contractorAssignment,
          overrideRates: [baseRate],
        },
      ],
    });

    await expect(
      listAssignmentRatesForAdmin({
        db,
        now: () => new Date("2026-07-07T00:00:00.000Z"),
      }),
    ).resolves.toEqual([
      {
        assignmentId: "assignment-1",
        projectId: "project-1",
        memberId: "member-1",
        memberName: "Contractor Example",
        memberEmail: "contractor@example.com",
        memberProfile: "CONTRACTOR",
        memberDefaultCurrencyCode: "EUR",
        projectName: "Client Portal",
        currentOverrideRate: {
          id: "rate-1",
          validFrom: "2026-07-01",
          validTo: null,
          hourlyRate: "95.00",
          currencyCode: "EUR",
          createdAt: "2026-07-01T08:30:00.000Z",
          createdByName: "Admin User",
          note: null,
        },
        overrideRatePeriods: [
          {
            id: "rate-1",
            validFrom: "2026-07-01",
            validTo: null,
            hourlyRate: "95.00",
            currencyCode: "EUR",
            createdAt: "2026-07-01T08:30:00.000Z",
            createdByName: "Admin User",
            note: null,
          },
        ],
      },
    ]);
  });

  it("creates contractor assignment override rates", async () => {
    const { db, tx } = createRateDb();

    const result = await createAssignmentOverrideRate(
      {
        projectAssignmentId: "assignment-1",
        validFrom: new Date("2026-08-01T00:00:00.000Z"),
        hourlyRate: 150,
        currencyCode: "EUR",
        actorMemberId: "admin-1",
      },
      { db },
    );

    expect(result).toEqual({ ratePeriodId: "assignment-rate-created" });
    expect(tx.assignmentRatePeriod.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectAssignmentId: "assignment-1",
          hourlyRate: "150.00",
          currencyCode: "EUR",
          createdByMemberId: "admin-1",
        }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "rate.assignment_override.created",
          targetType: "assignment_rate_period",
          targetId: "assignment-rate-created",
          after: expect.objectContaining({
            projectAssignmentId: "assignment-1",
            memberId: "member-1",
            projectId: "project-1",
          }),
        }),
      }),
    );
  });

  it("closes an open-ended assignment override when adding a future successor", async () => {
    const { db, tx } = createRateDb({
      assignmentRates: [baseRate],
    });

    await createAssignmentOverrideRate(
      {
        projectAssignmentId: "assignment-1",
        validFrom: new Date("2026-08-01T00:00:00.000Z"),
        hourlyRate: 150,
        currencyCode: "EUR",
        actorMemberId: "admin-1",
      },
      { db },
    );

    expect(tx.assignmentRatePeriod.update).toHaveBeenCalledWith({
      where: {
        id: "rate-1",
      },
      data: {
        validTo: new Date("2026-08-01T00:00:00.000Z"),
      },
      select: expect.any(Object),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "rate.assignment_override.closed_for_successor",
          targetType: "assignment_rate_period",
          targetId: "rate-1",
          after: expect.objectContaining({
            validTo: "2026-08-01",
            successorRatePeriodId: "assignment-rate-created",
          }),
        }),
      }),
    );
  });

  it("rejects employee assignment override rates", async () => {
    const { db, tx } = createRateDb({
      assignment: {
        ...contractorAssignment,
        member: employeeMember,
        memberId: employeeMember.id,
      },
    });

    await expect(
      createAssignmentOverrideRate(
        {
          projectAssignmentId: "assignment-1",
          validFrom: new Date("2026-08-01T00:00:00.000Z"),
          hourlyRate: 150,
          currencyCode: "EUR",
          actorMemberId: "admin-1",
        },
        { db },
      ),
    ).rejects.toBeInstanceOf(RateManagementError);

    expect(tx.assignmentRatePeriod.create).not.toHaveBeenCalled();
  });
});
