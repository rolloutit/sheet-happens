import { AppShell } from "@/src/components/layout/AppShell";
import {
  mapMemberToShellProfile,
  mapMemberToShellRole,
  mapMemberToShellUser,
  requireActiveAppMember,
} from "@/src/server/auth/app-access";
import {
  getMemberMonthOverview,
  getMemberWeeklyTimeGrid,
  getMonday,
  getMonthStartsInRange,
  parseDateOnly,
  TimeTrackingDateError,
} from "@/src/server/time-tracking";

import { TimeGridClient } from "./TimeGridClient";

export const dynamic = "force-dynamic";

type TimePageProps = {
  searchParams?: Promise<{
    week?: string;
  }>;
};

export default async function TimePage({ searchParams }: TimePageProps) {
  const { member } = await requireActiveAppMember("/time");
  const resolvedSearchParams = await searchParams;
  const requestedWeekStart = parseWeekStart(resolvedSearchParams?.week);
  const week = await getMemberWeeklyTimeGrid({
    memberId: member.id,
    weekStart: requestedWeekStart,
  });
  /**
   * The month level ships with the page, for every month the visible week touches — one, or two
   * across a month boundary (§11).
   *
   * That is what makes all four stops reachable with no round-trip, which in turn is what lets a
   * level change stay a pure layout animation: L4 needs no per-entry data, so it is a `groupBy` and
   * two small `findMany`s per month rather than anything a spinner would have to cover.
   *
   * After the week rather than beside it, because which months the week touches is not known until
   * the week is: the week start depends on the member's own timezone, which
   * `getMemberWeeklyTimeGrid` resolves. `getMonthStartsInRange` is the same helper it uses to find
   * the months it locks against, so the two can never disagree about where a month begins.
   */
  const months = await Promise.all(
    getMonthStartsInRange(parseDateOnly(week.weekStart), parseDateOnly(week.weekEnd)).map(
      (monthStart) => getMemberMonthOverview({ memberId: member.id, monthStart }),
    ),
  );

  return (
    <AppShell
      current="time"
      role={mapMemberToShellRole(member)}
      profile={mapMemberToShellProfile(member)}
      user={mapMemberToShellUser(member)}
    >
      {/*
       * Wider than the reading-width default from `xl` up, matching the admin surfaces
       * (`max-w-[92rem]`). This page is not prose — its widest level is seven day columns side by
       * side, and at 73.75rem a large display spends a third of the content area on empty margins
       * while the columns are too narrow for a description and a time range. The cap stays, so the
       * week does not turn into seven sparse strips on a 4K panel.
       */}
      <section className="mx-auto w-full max-w-[73.75rem] px-4 py-8 sm:px-6 lg:px-8 xl:max-w-[92rem]">
        <TimeGridClient
          week={week}
          months={months}
          durationDisplayFormat={member.durationDisplayFormat}
        />
      </section>
    </AppShell>
  );
}

function parseWeekStart(value: string | undefined) {
  if (!value) return null;

  try {
    return getMonday(parseDateOnly(value));
  } catch (error) {
    if (error instanceof TimeTrackingDateError) return null;
    throw error;
  }
}
