import { describe, expect, it } from "vitest";

import { buildPeopleWhere, mapMemberToPersonRow, normalizePeopleFilters } from "./people";
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
      profileValue: "CONTRACTOR",
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
      profileValue: "EMPLOYEE",
      state: "invited",
    });
  });

  it("maps the next scheduled profile transition", () => {
    expect(
      mapMemberToPersonRow({
        ...baseMember,
        profilePeriods: [
          {
            profile: "EMPLOYEE",
            validFrom: new Date("2026-08-01T00:00:00.000Z"),
          },
        ],
      }),
    ).toMatchObject({
      scheduledProfile: "Employee",
      scheduledProfileValue: "EMPLOYEE",
      scheduledProfileValidFrom: "2026-08-01",
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

describe("people admin filters", () => {
  it("normalizes supported filters and pagination", () => {
    expect(
      normalizePeopleFilters({
        q: " alex@example.com ",
        state: "active",
        role: "ADMIN",
        profile: "CONTRACTOR",
        page: "3",
        pageSize: "50",
      }),
    ).toEqual({
      query: "alex@example.com",
      state: "active",
      role: "ADMIN",
      profile: "CONTRACTOR",
      page: 3,
      pageSize: 50,
    });
  });

  it("falls back from invalid filters and caps page size", () => {
    expect(
      normalizePeopleFilters({
        state: "bad",
        role: "OWNER",
        profile: "VENDOR",
        page: "-1",
        pageSize: "999",
      }),
    ).toEqual({
      query: "",
      state: "",
      role: "",
      profile: "",
      page: 1,
      pageSize: 100,
    });
  });

  it("builds search, state, role, and profile filters", () => {
    expect(
      buildPeopleWhere(
        normalizePeopleFilters({
          q: "anna",
          state: "invited",
          role: "MEMBER",
          profile: "EMPLOYEE",
        }),
      ),
    ).toEqual({
      AND: [
        {
          OR: [
            { email: { contains: "anna", mode: "insensitive" } },
            { firstName: { contains: "anna", mode: "insensitive" } },
            { lastName: { contains: "anna", mode: "insensitive" } },
            { displayName: { contains: "anna", mode: "insensitive" } },
          ],
        },
        {
          status: "INVITED",
          deletedAt: null,
        },
        {
          role: "MEMBER",
        },
        {
          currentProfile: "EMPLOYEE",
        },
      ],
    });
  });

  it("maps locked state to archived members", () => {
    expect(buildPeopleWhere(normalizePeopleFilters({ state: "locked" }))).toEqual({
      OR: [
        {
          status: "DELETED",
        },
        {
          deletedAt: {
            not: null,
          },
        },
      ],
    });
  });
});
