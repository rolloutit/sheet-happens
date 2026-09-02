import { AppShell } from "@/src/components/layout/AppShell";
import {
  mapMemberToShellProfile,
  mapMemberToShellRole,
  mapMemberToShellUser,
  requireActiveAppMember,
} from "@/src/server/auth/app-access";
import {
  getMemberWeeklyTimeGrid,
  getMonday,
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

  return (
    <AppShell
      current="time"
      role={mapMemberToShellRole(member)}
      profile={mapMemberToShellProfile(member)}
      user={mapMemberToShellUser(member)}
    >
      <section className="mx-auto w-full max-w-[73.75rem] px-4 py-8 sm:px-6 lg:px-8">
        <TimeGridClient week={week} durationDisplayFormat={member.durationDisplayFormat} />
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
