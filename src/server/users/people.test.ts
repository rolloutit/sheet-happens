import { describe, expect, it } from "vitest";

import { mapMemberToPersonRow } from "./people";
import type { PeopleMemberRow } from "./people";

const baseMember: PeopleMemberRow = {
  id: "member-1",
  authUserId: "auth-user-1",
  email: "alex@example.com",
  firstName: "Alex",
  lastName: "Taylor",
  displayName: "Alex Taylor",
  role: "MEMBER",
  status: "ACTIVE",
  currentProfile: "CONTRACTOR",
  defaultCurrencyCode: "EUR",
  timezone: "Europe/Budapest",
  locale: "en",
  deletedAt: null,
};

describe("mapMemberToPersonRow", () => {
  it("maps active contractors to people table rows", () => {
    expect(mapMemberToPersonRow(baseMember)).toEqual({
      id: "member-1",
      name: "Alex Taylor",
      email: "alex@example.com",
      firstName: "Alex",
      lastName: "Taylor",
      displayName: "Alex Taylor",
      profile: "Contractor",
      role: "Member",
      roleValue: "MEMBER",
      state: "active",
      currency: "EUR",
      defaultCurrencyCode: "EUR",
      timezone: "Europe/Budapest",
      locale: "en",
      hasAuthUser: true,
    });
  });

  it("falls back to composed name and maps invited employees", () => {
    expect(
      mapMemberToPersonRow({
        ...baseMember,
        displayName: "",
        status: "INVITED",
        currentProfile: "EMPLOYEE",
      }),
    ).toMatchObject({
      name: "Alex Taylor",
      profile: "Employee",
      state: "invited",
    });
  });

  it("treats soft-deleted members as locked", () => {
    expect(
      mapMemberToPersonRow({
        ...baseMember,
        status: "ACTIVE",
        deletedAt: new Date("2026-01-01T00:00:00.000Z"),
      }).state,
    ).toBe("locked");
  });
});
