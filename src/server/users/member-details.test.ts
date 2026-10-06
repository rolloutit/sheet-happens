import { describe, expect, it, vi } from "vitest";

import { TrackingModeSwitchError, type TrackingMode } from "@/src/server/time-tracking";
import { MemberDetailsError, updateMemberDetails } from "./member-details";

type TestMemberDetails = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  defaultCurrencyCode: string;
  timezone: string;
  locale: string;
  defaultTrackingMode: TrackingMode;
  status: string;
  deletedAt: Date | null;
};

const baseMember: TestMemberDetails = {
  id: "member-1",
  firstName: "Alex",
  lastName: "Taylor",
  displayName: "Alex Taylor",
  defaultCurrencyCode: "EUR",
  timezone: "Europe/Budapest",
  locale: "en",
  defaultTrackingMode: "TRACKED",
  status: "ACTIVE",
  deletedAt: null,
};

function createUpdateMemberDetailsDb(
  member: TestMemberDetails | null = baseMember,
  trackingModeData: {
    inheritingAssignments?: Array<{ id: string }>;
    entries?: Array<{ projectId: string; localDate: Date; project: { name: string } }>;
    declarations?: Array<{ projectId: string; periodStart: Date; project: { name: string } }>;
    locks?: Array<{ periodStart: Date }>;
  } = {},
) {
  const tx = {
    member: {
      findUnique: vi.fn().mockResolvedValue(member),
      update: vi.fn().mockResolvedValue({ id: "member-1" }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
    projectAssignment: {
      findMany: vi.fn().mockResolvedValue(trackingModeData.inheritingAssignments ?? []),
    },
    timeEntry: {
      findMany: vi.fn().mockResolvedValue(trackingModeData.entries ?? []),
    },
    monthlyHourDeclaration: {
      findMany: vi.fn().mockResolvedValue(trackingModeData.declarations ?? []),
    },
    periodLock: {
      findMany: vi.fn().mockResolvedValue(trackingModeData.locks ?? []),
    },
  };

  return {
    tx,
    db: {
      $transaction: vi.fn((callback) => callback(tx)),
    },
  };
}

describe("updateMemberDetails", () => {
  it("updates changed editable fields and audits before and after values", async () => {
    const { db, tx } = createUpdateMemberDetailsDb();

    const result = await updateMemberDetails(
      {
        memberId: "member-1",
        actorMemberId: "admin-1",
        firstName: "Alexandra",
        lastName: "Taylor",
        displayName: "",
        defaultCurrencyCode: "HUF",
        timezone: "Europe/Budapest",
        locale: "hu",
        defaultTrackingMode: "TRACKED",
      },
      { db },
    );

    expect(tx.member.update).toHaveBeenCalledWith({
      where: {
        id: "member-1",
      },
      data: {
        firstName: "Alexandra",
        displayName: "",
        defaultCurrencyCode: "HUF",
        locale: "hu",
      },
      select: {
        id: true,
      },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorMemberId: "admin-1",
        action: "member.updated",
        targetType: "member",
        targetId: "member-1",
        before: {
          firstName: "Alex",
          displayName: "Alex Taylor",
          defaultCurrencyCode: "EUR",
          locale: "en",
        },
        after: {
          firstName: "Alexandra",
          displayName: "",
          defaultCurrencyCode: "HUF",
          locale: "hu",
        },
      },
    });
    expect(result).toEqual({
      memberId: "member-1",
      changed: true,
    });
  });

  it("does not update or audit unchanged details", async () => {
    const { db, tx } = createUpdateMemberDetailsDb();

    await expect(
      updateMemberDetails(
        {
          memberId: "member-1",
          actorMemberId: "admin-1",
          firstName: "Alex",
          lastName: "Taylor",
          displayName: "Alex Taylor",
          defaultCurrencyCode: "EUR",
          timezone: "Europe/Budapest",
          locale: "en",
          defaultTrackingMode: "TRACKED",
        },
        { db },
      ),
    ).resolves.toEqual({
      memberId: "member-1",
      changed: false,
    });
    expect(tx.member.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("rejects deleted members", async () => {
    const { db } = createUpdateMemberDetailsDb({
      ...baseMember,
      status: "DELETED",
      deletedAt: new Date("2026-07-01T00:00:00.000Z"),
    });

    await expect(
      updateMemberDetails(
        {
          memberId: "member-1",
          actorMemberId: "admin-1",
          firstName: "Alex",
          lastName: "Taylor",
          displayName: "Alex Taylor",
          defaultCurrencyCode: "EUR",
          timezone: "Europe/Budapest",
          locale: "en",
          defaultTrackingMode: "TRACKED",
        },
        { db },
      ),
    ).rejects.toBeInstanceOf(MemberDetailsError);
  });

  it("refuses a default switch while an inheriting assignment still holds tracked entries", async () => {
    const { db, tx } = createUpdateMemberDetailsDb(baseMember, {
      inheritingAssignments: [{ id: "assignment-1" }],
      entries: [
        {
          projectId: "project-nimbus",
          localDate: new Date("2026-09-03T00:00:00.000Z"),
          project: { name: "Nimbus" },
        },
      ],
    });

    await expect(
      updateMemberDetails(
        {
          memberId: "member-1",
          actorMemberId: "admin-1",
          firstName: "Alex",
          lastName: "Taylor",
          displayName: "Alex Taylor",
          defaultCurrencyCode: "EUR",
          timezone: "Europe/Budapest",
          locale: "en",
          defaultTrackingMode: "DECLARED",
        },
        { db },
      ),
    ).rejects.toBeInstanceOf(TrackingModeSwitchError);
    expect(tx.member.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("allows the switch when every assignment carries its own override", async () => {
    const { db, tx } = createUpdateMemberDetailsDb(baseMember, {
      inheritingAssignments: [],
      entries: [
        {
          projectId: "project-nimbus",
          localDate: new Date("2026-09-03T00:00:00.000Z"),
          project: { name: "Nimbus" },
        },
      ],
    });

    await expect(
      updateMemberDetails(
        {
          memberId: "member-1",
          actorMemberId: "admin-1",
          firstName: "Alex",
          lastName: "Taylor",
          displayName: "Alex Taylor",
          defaultCurrencyCode: "EUR",
          timezone: "Europe/Budapest",
          locale: "en",
          defaultTrackingMode: "DECLARED",
        },
        { db },
      ),
    ).resolves.toEqual({
      memberId: "member-1",
      changed: true,
    });
    expect(tx.timeEntry.findMany).not.toHaveBeenCalled();
    expect(tx.member.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          defaultTrackingMode: "DECLARED",
        },
      }),
    );
  });

  it("rejects unsupported member preference values", async () => {
    const { db, tx } = createUpdateMemberDetailsDb();

    await expect(
      updateMemberDetails(
        {
          memberId: "member-1",
          actorMemberId: "admin-1",
          firstName: "Alex",
          lastName: "Taylor",
          displayName: "Alex Taylor",
          defaultCurrencyCode: "ZZZ",
          timezone: "Europe/Budapest",
          locale: "en",
          defaultTrackingMode: "TRACKED",
        },
        { db },
      ),
    ).rejects.toBeInstanceOf(MemberDetailsError);
    expect(tx.member.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
