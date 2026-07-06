import { prisma } from "@/src/server/db/client";
import { requireAdminAppMemberForAction } from "@/src/server/auth/app-access";
import type { PersonRowState, PersonTableRow } from "@/src/components/sheet/PeopleTable";

export type PeopleMemberStatus = "INVITED" | "ACTIVE" | "INACTIVE" | "DELETED";
export type PeopleMemberProfile = "EMPLOYEE" | "CONTRACTOR";
export type PeopleMemberRole = "ADMIN" | "MEMBER";

export type PeopleMemberRow = {
  id: string;
  authUserId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  role: PeopleMemberRole;
  status: PeopleMemberStatus;
  currentProfile: PeopleMemberProfile;
  defaultCurrencyCode: string;
  deletedAt: Date | null;
};

export async function listPeopleForAdmin(): Promise<PersonTableRow[]> {
  await requireAdminAppMemberForAction();

  const members = await prisma.member.findMany({
    select: {
      id: true,
      authUserId: true,
      email: true,
      firstName: true,
      lastName: true,
      displayName: true,
      role: true,
      status: true,
      currentProfile: true,
      defaultCurrencyCode: true,
      deletedAt: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { email: "asc" }],
  });

  return members.map(mapMemberToPersonRow);
}

export function mapMemberToPersonRow(member: PeopleMemberRow): PersonTableRow {
  return {
    id: member.id,
    name: getMemberDisplayName(member),
    email: member.email,
    profile: formatProfile(member.currentProfile),
    role: formatRole(member.role),
    roleValue: member.role,
    state: mapMemberState(member),
    currency: member.defaultCurrencyCode,
    hasAuthUser: Boolean(member.authUserId),
  };
}

function getMemberDisplayName(member: PeopleMemberRow) {
  return (
    member.displayName.trim() ||
    [member.firstName.trim(), member.lastName.trim()].filter(Boolean).join(" ") ||
    member.email
  );
}

function formatProfile(profile: PeopleMemberProfile) {
  return profile === "CONTRACTOR" ? "Contractor" : "Employee";
}

function formatRole(role: PeopleMemberRole) {
  return role === "ADMIN" ? "Admin" : "Member";
}

function mapMemberState(member: PeopleMemberRow): PersonRowState {
  if (member.deletedAt || member.status === "DELETED") {
    return "locked";
  }

  if (member.status === "ACTIVE") {
    return "active";
  }

  if (member.status === "INVITED") {
    return "invited";
  }

  return "inactive";
}
