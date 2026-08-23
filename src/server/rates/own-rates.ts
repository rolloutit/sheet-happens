import { isProjectColorToken, projectColorValues } from "@/src/lib/project-colors";
import type { AppMember } from "@/src/server/auth/app-access";
import { prisma } from "@/src/server/db/client";

type DecimalLike = { toString(): string };

type OwnRatePeriodRecord = {
  id: string;
  validFrom: Date;
  validTo: Date | null;
  hourlyRate: DecimalLike;
  currencyCode: string;
};

type OwnRateAssignmentRecord = {
  id: string;
  project: {
    id: string;
    name: string;
    colorToken: string;
  };
  overrideRates: OwnRatePeriodRecord[];
};

type OwnRatesDb = {
  memberDefaultRatePeriod: {
    findMany(args: object): Promise<OwnRatePeriodRecord[]>;
  };
  projectAssignment: {
    findMany(args: object): Promise<OwnRateAssignmentRecord[]>;
  };
};

export type OwnRatePeriod = {
  id: string;
  validFrom: string;
  validTo: string | null;
  hourlyRate: string;
  currencyCode: string;
  current: boolean;
};

export type OwnProjectRate = {
  assignmentId: string;
  projectId: string;
  projectName: string;
  projectColor: string;
  source: "override" | "central" | "missing";
  hourlyRate: string | null;
  currencyCode: string | null;
};

export type OwnRatesView = {
  profile: "CONTRACTOR" | "EMPLOYEE";
  centralPeriods: OwnRatePeriod[];
  projectRates: OwnProjectRate[];
};

export async function getOwnRatesForMember(
  member: Pick<AppMember, "id" | "currentProfile" | "timezone">,
  deps: { db?: OwnRatesDb; now?: Date } = {},
): Promise<OwnRatesView> {
  const db = deps.db ?? (prisma as unknown as OwnRatesDb);
  const today = getDateOnlyInTimeZone(deps.now ?? new Date(), member.timezone);

  const [centralPeriods, assignments] = await Promise.all([
    db.memberDefaultRatePeriod.findMany({
      where: { memberId: member.id },
      orderBy: [{ validFrom: "desc" }],
      select: ratePeriodSelect,
    }),
    member.currentProfile === "CONTRACTOR"
      ? db.projectAssignment.findMany({
          where: {
            memberId: member.id,
            active: true,
            validFrom: { lte: today },
            OR: [{ validTo: null }, { validTo: { gt: today } }],
            project: {
              deletedAt: null,
              status: "ACTIVE",
            },
          },
          orderBy: [{ project: { name: "asc" } }],
          select: {
            id: true,
            project: {
              select: {
                id: true,
                name: true,
                colorToken: true,
              },
            },
            overrideRates: {
              orderBy: [{ validFrom: "desc" }],
              select: ratePeriodSelect,
            },
          },
        })
      : Promise.resolve([]),
  ]);

  return buildOwnRatesView({
    profile: member.currentProfile,
    today,
    centralPeriods,
    assignments,
  });
}

export function buildOwnRatesView(input: {
  profile: "CONTRACTOR" | "EMPLOYEE";
  today: Date;
  centralPeriods: OwnRatePeriodRecord[];
  assignments: OwnRateAssignmentRecord[];
}): OwnRatesView {
  const currentCentral = findEffectivePeriod(input.centralPeriods, input.today);
  const seenProjectIds = new Set<string>();

  return {
    profile: input.profile,
    centralPeriods: [...input.centralPeriods]
      .sort((left, right) => right.validFrom.getTime() - left.validFrom.getTime())
      .map((period) => mapPeriod(period, input.today)),
    projectRates:
      input.profile === "EMPLOYEE"
        ? []
        : input.assignments.flatMap((assignment) => {
            if (seenProjectIds.has(assignment.project.id)) return [];
            seenProjectIds.add(assignment.project.id);
            const override = findEffectivePeriod(assignment.overrideRates, input.today);
            const effective = override ?? currentCentral;

            return [
              {
                assignmentId: assignment.id,
                projectId: assignment.project.id,
                projectName: assignment.project.name,
                projectColor:
                  projectColorValues[
                    isProjectColorToken(assignment.project.colorToken)
                      ? assignment.project.colorToken
                      : "teal"
                  ],
                source: override ? "override" : effective ? "central" : "missing",
                hourlyRate: effective?.hourlyRate.toString() ?? null,
                currencyCode: effective?.currencyCode ?? null,
              } satisfies OwnProjectRate,
            ];
          }),
  };
}

function findEffectivePeriod(periods: OwnRatePeriodRecord[], today: Date) {
  return periods.find(
    (period) => period.validFrom <= today && (!period.validTo || period.validTo > today),
  );
}

function mapPeriod(period: OwnRatePeriodRecord, today: Date): OwnRatePeriod {
  return {
    id: period.id,
    validFrom: formatDateOnly(period.validFrom),
    validTo: period.validTo ? formatDateOnly(subtractUtcDay(period.validTo)) : null,
    hourlyRate: period.hourlyRate.toString(),
    currencyCode: period.currencyCode,
    current: period.validFrom <= today && (!period.validTo || period.validTo > today),
  };
}

function getDateOnlyInTimeZone(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return new Date(Date.UTC(value("year"), value("month") - 1, value("day")));
}

function subtractUtcDay(date: Date) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() - 1);
  return result;
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

const ratePeriodSelect = {
  id: true,
  validFrom: true,
  validTo: true,
  hourlyRate: true,
  currencyCode: true,
} as const;
