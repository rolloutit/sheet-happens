import { firstSearchParam, listSearchParam } from "@/src/lib/search-params";
import { anyOf } from "@/src/server/db/any-of";
import { prisma } from "@/src/server/db/client";
import { requireAdminAppMemberForAction } from "@/src/server/auth/app-access";
import type { Prisma } from "@/src/server/db/generated/client";
import type { PersonRowState, PersonTableRow } from "@/src/components/sheet/PeopleTable";
import type { TrackingMode } from "@/src/server/time-tracking";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export type PeopleMemberStatus = "INVITED" | "ACTIVE" | "INACTIVE" | "DELETED";
export type PeopleMemberProfile = "EMPLOYEE" | "CONTRACTOR";
export type PeopleMemberRole = "ADMIN" | "MEMBER";
export type PeopleListSearchParams = Record<string, string | string[] | undefined>;
export type PeopleStateFilter = PersonRowState | "";

export type PeopleFilters = {
  query: string;
  /** Empty means every state, the same way no filter at all does. */
  states: PersonRowState[];
  role: PeopleMemberRole | "";
  profile: PeopleMemberProfile | "";
  page: number;
  pageSize: number;
};

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
  defaultTrackingMode: TrackingMode;
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
  defaultTrackingMode: TrackingMode;
};

export type PeopleStats = {
  totalMembers: number;
  invitedMembers: number;
};

export type PeopleListResult = {
  rows: AdminPersonRow[];
  filters: PeopleFilters;
  totalItems: number;
  totalPages: number;
  pageStart: number;
  pageEnd: number;
  stats: PeopleStats;
};

export async function listPeopleForAdmin(
  searchParams: PeopleListSearchParams = {},
): Promise<PeopleListResult> {
  await requireAdminAppMemberForAction();
  const filters = normalizePeopleFilters(searchParams);
  const where = buildPeopleWhere(filters);
  const today = getTodayDateOnly();

  const [totalItems, totalMembers, invitedMembers] = await Promise.all([
    prisma.member.count({ where }),
    prisma.member.count(),
    prisma.member.count({
      where: {
        status: "INVITED",
        deletedAt: null,
      },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalItems / filters.pageSize));
  const safeFilters = {
    ...filters,
    page: Math.min(filters.page, totalPages),
  };
  const skip = (safeFilters.page - 1) * safeFilters.pageSize;

  const members = await prisma.member.findMany({
    where,
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
      defaultTrackingMode: true,
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
    skip,
    take: safeFilters.pageSize,
  });

  return {
    rows: members.map(mapMemberToPersonRow),
    filters: safeFilters,
    totalItems,
    totalPages,
    pageStart: totalItems === 0 ? 0 : skip + 1,
    pageEnd: Math.min(skip + members.length, totalItems),
    stats: {
      totalMembers,
      invitedMembers,
    },
  };
}

export function normalizePeopleFilters(searchParams: PeopleListSearchParams = {}): PeopleFilters {
  return {
    query: firstSearchParam(searchParams.q).trim().slice(0, 120),
    states: listSearchParam(searchParams.state)
      .map(normalizeStateFilter)
      .filter((state): state is PersonRowState => state !== ""),
    role: normalizeRoleFilter(firstSearchParam(searchParams.role)),
    profile: normalizeProfileFilter(firstSearchParam(searchParams.profile)),
    page: parsePositiveInteger(firstSearchParam(searchParams.page), DEFAULT_PAGE),
    pageSize: Math.min(
      parsePositiveInteger(firstSearchParam(searchParams.pageSize), DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE,
    ),
  };
}

export function buildPeopleWhere(filters: PeopleFilters): Prisma.MemberWhereInput {
  const and: Prisma.MemberWhereInput[] = [];

  if (filters.query) {
    const containsFilter = {
      contains: filters.query,
      mode: "insensitive" as const,
    };

    and.push({
      OR: [
        { email: containsFilter },
        { firstName: containsFilter },
        { lastName: containsFilter },
        { displayName: containsFilter },
      ],
    });
  }

  const stateClause = buildStateClause(filters.states);

  if (stateClause) and.push(stateClause);

  if (filters.role) {
    and.push({
      role: filters.role,
    });
  }

  if (filters.profile) {
    and.push({
      currentProfile: filters.profile,
    });
  }

  if (and.length === 0) return {};
  if (and.length === 1) return and[0];
  return { AND: and };
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
    defaultTrackingMode: member.defaultTrackingMode,
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

function parsePositiveInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeStateFilter(value: string): PeopleStateFilter {
  if (value === "active" || value === "inactive" || value === "invited" || value === "locked") {
    return value;
  }

  return "";
}

function normalizeRoleFilter(value: string): PeopleMemberRole | "" {
  if (value === "ADMIN" || value === "MEMBER") return value;
  return "";
}

function normalizeProfileFilter(value: string): PeopleMemberProfile | "" {
  if (value === "EMPLOYEE" || value === "CONTRACTOR") return value;
  return "";
}

/**
 * `locked` is not a member status but a soft-delete marker, so it cannot join the same `in`
 * as the real statuses — picking it alongside another state means "either".
 */
function buildStateClause(states: PersonRowState[]) {
  const statuses = states
    .filter((state): state is Exclude<PersonRowState, "locked"> => state !== "locked")
    .map(mapStateFilterToStatus);
  const clauses: Prisma.MemberWhereInput[] = [];

  if (statuses.length < states.length) {
    clauses.push({ OR: [{ status: "DELETED" }, { deletedAt: { not: null } }] });
  }

  if (statuses.length > 0) {
    clauses.push({ status: { in: statuses }, deletedAt: null });
  }

  return anyOf(clauses);
}

function mapStateFilterToStatus(state: Exclude<PeopleStateFilter, "" | "locked">) {
  if (state === "active") return "ACTIVE";
  if (state === "invited") return "INVITED";
  return "INACTIVE";
}
