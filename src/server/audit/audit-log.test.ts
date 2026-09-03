import { describe, expect, it, vi } from "vitest";

import {
  buildAuditLogWhere,
  listAuditLogsForAdmin,
  normalizeAuditLogFilters,
  redactAuditPayload,
} from "./audit-log";

function createAuditLogDb() {
  const auditLog = {
    count: vi.fn().mockResolvedValue(42),
    groupBy: vi
      .fn()
      .mockResolvedValueOnce([{ action: "member.updated" }, { action: "security.totp_reset" }])
      .mockResolvedValueOnce([{ targetType: "member" }, { targetType: "project" }]),
    findMany: vi.fn().mockResolvedValue([
      {
        id: "audit-1",
        actorMemberId: "member-1",
        action: "security.totp_reset",
        targetType: "member",
        targetId: "member-2",
        before: {
          twoFactorEnabled: true,
          secret: "do-not-show",
        },
        after: {
          twoFactorEnabled: false,
          revokedSessionCount: 1,
        },
        requestId: "request-1",
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
        createdAt: new Date("2026-07-10T10:00:00.000Z"),
        actor: {
          id: "member-1",
          displayName: "Admin User",
          email: "admin@example.com",
        },
      },
    ]),
  };
  const member = {
    findMany: vi.fn().mockResolvedValue([
      {
        id: "member-1",
        displayName: "Admin User",
        email: "admin@example.com",
      },
    ]),
  };

  return {
    db: {
      auditLog,
      member,
    },
    auditLog,
    member,
  };
}

describe("audit log service", () => {
  it("normalizes search params and clamps unsafe values", () => {
    expect(
      normalizeAuditLogFilters({
        q: "  security  ",
        action: "security.totp_reset",
        targetType: "member",
        actor: "system",
        from: "2026-07-01",
        to: "not-a-date",
        page: "-10",
        pageSize: "500",
      }),
    ).toEqual({
      query: "security",
      actions: ["security.totp_reset"],
      targetTypes: ["member"],
      actorMemberIds: ["system"],
      fromDate: "2026-07-01",
      toDate: "",
      page: 1,
      pageSize: 100,
    });
  });

  it("builds indexed audit filters for action, target, actor, and date range", () => {
    const where = buildAuditLogWhere({
      query: "",
      actions: ["member.updated"],
      targetTypes: ["member"],
      actorMemberIds: ["member-1"],
      fromDate: "2026-07-01",
      toDate: "2026-07-10",
      page: 1,
      pageSize: 25,
    });

    expect(where).toMatchObject({
      AND: [
        { action: { in: ["member.updated"] } },
        { targetType: { in: ["member"] } },
        { actorMemberId: { in: ["member-1"] } },
        {
          createdAt: {
            gte: new Date("2026-07-01T00:00:00.000Z"),
            lte: new Date("2026-07-10T23:59:59.999Z"),
          },
        },
      ],
    });
  });

  it("builds system actor filters", () => {
    expect(
      buildAuditLogWhere({
        query: "",
        actions: [],
        targetTypes: [],
        actorMemberIds: ["system"],
        fromDate: "",
        toDate: "",
        page: 1,
        pageSize: 25,
      }),
    ).toEqual({
      actorMemberId: null,
    });
  });

  /**
   * An investigation asks for an event group, not one action — every rate change, or every
   * login event — so each of these filters takes several values. The actor filter is the one
   * with a trap: `system` stands for rows no member owns, so it cannot be folded into the
   * same `in` as real member ids.
   */
  it("matches any of several actions, targets and actors", () => {
    const where = buildAuditLogWhere({
      query: "",
      actions: ["rate.created", "rate.updated"],
      targetTypes: ["rate", "member"],
      actorMemberIds: ["member-1", "member-2"],
      fromDate: "",
      toDate: "",
      page: 1,
      pageSize: 25,
    });

    expect(where).toEqual({
      AND: [
        { action: { in: ["rate.created", "rate.updated"] } },
        { targetType: { in: ["rate", "member"] } },
        { actorMemberId: { in: ["member-1", "member-2"] } },
      ],
    });
  });

  it("reads the system pseudo-actor picked alongside a person as either", () => {
    const where = buildAuditLogWhere({
      query: "",
      actions: [],
      targetTypes: [],
      actorMemberIds: ["system", "member-1"],
      fromDate: "",
      toDate: "",
      page: 1,
      pageSize: 25,
    });

    expect(where).toEqual({
      OR: [{ actorMemberId: null }, { actorMemberId: { in: ["member-1"] } }],
    });
  });

  it("reads every value of a repeated event parameter", () => {
    const filters = normalizeAuditLogFilters({
      action: ["rate.created", "rate.updated"],
      targetType: "rate",
      actor: ["system", "member-1"],
    });

    expect(filters.actions).toEqual(["rate.created", "rate.updated"]);
    expect(filters.targetTypes).toEqual(["rate"]);
    expect(filters.actorMemberIds).toEqual(["system", "member-1"]);
  });

  it("redacts sensitive JSON keys recursively", () => {
    expect(
      redactAuditPayload({
        name: "Safe",
        tokenHash: "secret-token",
        nested: {
          backupCodes: "codes",
          details: [{ publicKey: "key" }, { changed: true }],
        },
      }),
    ).toEqual({
      name: "Safe",
      tokenHash: "[redacted]",
      nested: {
        backupCodes: "[redacted]",
        details: [{ publicKey: "[redacted]" }, { changed: true }],
      },
    });
  });

  it("lists audit rows with safe pagination and redacted detail payloads", async () => {
    const { db, auditLog } = createAuditLogDb();

    const result = await listAuditLogsForAdmin(
      {
        page: "999",
        pageSize: "25",
      },
      {
        db,
        now: () => new Date("2026-07-10T11:00:00.000Z"),
        timeZone: "Europe/Budapest",
      },
    );

    expect(auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 25,
        take: 25,
      }),
    );
    expect(result.filters.page).toBe(2);
    expect(result.totalPages).toBe(2);
    expect(result.rows[0]).toMatchObject({
      id: "audit-1",
      actorName: "Admin User",
      before: {
        twoFactorEnabled: true,
        secret: "[redacted]",
      },
    });
    expect(result.actionOptions).toEqual([
      { value: "member.updated", label: "Member Updated" },
      { value: "security.totp_reset", label: "Security Totp Reset" },
    ]);
  });
});
