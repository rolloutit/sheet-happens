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
  timezone: string;
  locale: string;
  deletedAt: Date | null;
  profilePeriods?: Array<{
    profile: PeopleMemberProfile;
    validFrom: Date;
  }>;
};

export type AdminPersonRow = PersonTableRow & {
  firstName: string;
  lastName: string;
  displayName: string;
  profileValue: PeopleMemberProfile;
  scheduledProfile?: string;
  scheduledProfileValue?: PeopleMemberProfile;
  scheduledProfileValidFrom?: string;
  defaultCurrencyCode: string;
  timezone: string;
  locale: string;
};

export async function listPeopleForAdmin(): Promise<AdminPersonRow[]> {
  await requireAdminAppMemberForAction();
  const today = getTodayDateOnly();

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
      timezone: true,
      locale: true,
      deletedAt: true,
      profilePeriods: {
        where: {
          validFrom: {
            gt: today,
          },
        },
        orderBy: {
          validFrom: "asc",
        },
        take: 1,
        select: {
          profile: true,
          validFrom: true,
        },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { email: "asc" }],
  });

  return members.map(mapMemberToPersonRow);
}

export function mapMemberToPersonRow(member: PeopleMemberRow): AdminPersonRow {
  const scheduledProfilePeriod = member.profilePeriods?.at(0);

  return {
    id: member.id,
    name: getMemberDisplayName(member),
    email: member.email,
    firstName: member.firstName,
    lastName: member.lastName,
    displayName: member.displayName,
    profile: formatProfile(member.currentProfile),
    profileValue: member.currentProfile,
    scheduledProfile: scheduledProfilePeriod
      ? formatProfile(scheduledProfilePeriod.profile)
      : undefined,
    scheduledProfileValue: scheduledProfilePeriod?.profile,
    scheduledProfileValidFrom: scheduledProfilePeriod
      ? formatDateOnly(scheduledProfilePeriod.validFrom)
      : undefined,
    role: formatRole(member.role),
    roleValue: member.role,
    state: mapMemberState(member),
    currency: member.defaultCurrencyCode,
    defaultCurrencyCode: member.defaultCurrencyCode,
    timezone: member.timezone,
    locale: member.locale,
    hasAuthUser: Boolean(member.authUserId),
  };
}

function getTodayDateOnly() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
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

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
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
