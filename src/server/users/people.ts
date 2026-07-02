import { prisma } from "@/src/server/db/client";
import { requireAdmin } from "@/src/server/auth/session";
import type { PersonRowState, PersonTableRow } from "@/src/components/sheet/PeopleTable";

export type PeopleMemberStatus = "INVITED" | "ACTIVE" | "INACTIVE" | "DELETED";
export type PeopleMemberProfile = "EMPLOYEE" | "CONTRACTOR";

export type PeopleMemberRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  status: PeopleMemberStatus;
  currentProfile: PeopleMemberProfile;
  defaultCurrencyCode: string;
  deletedAt: Date | null;
};

export async function listPeopleForAdmin(): Promise<PersonTableRow[]> {
  await requireAdmin();

  const members = await prisma.member.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      displayName: true,
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
    state: mapMemberState(member),
    currency: member.defaultCurrencyCode,
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
