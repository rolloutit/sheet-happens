import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";

import { AppShell } from "@/src/components/layout/AppShell";
import {
  mapMemberToShellProfile,
  mapMemberToShellRole,
  mapMemberToShellUser,
  requireActiveAppMember,
} from "@/src/server/auth/app-access";
import {
  getLeaveEarliestStartDate,
  getPublicHolidaysInRange,
  listLeaveCalendar,
  listOwnLeave,
} from "@/src/server/leave";
import { getTodayIsoInTimezone } from "@/src/server/time-tracking";
import { LeaveClient } from "./LeaveClient";
import { readMonthParam, toLeaveHolidays, toLeaveView } from "./leave-page-data";

export const dynamic = "force-dynamic";

type LeavePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LeavePage({ searchParams }: LeavePageProps) {
  const { member } = await requireActiveAppMember("/leave");

  if (member.currentProfile !== "EMPLOYEE") {
    notFound();
  }

  const params = (await searchParams) ?? {};
  const todayIso = getTodayIsoInTimezone(member.timezone);
  const currentMonth = todayIso.slice(0, 7);
  const month = readMonthParam(params.month, currentMonth);
  const view = params.view === "list" ? "list" : "calendar";
  const thisYear = Number.parseInt(todayIso.slice(0, 4), 10);
  const viewer = { memberId: member.id, isAdmin: false };

  const [locale, calendar, own, formHolidays] = await Promise.all([
    getLocale(),
    listLeaveCalendar({ month, viewer }),
    listOwnLeave({ memberId: member.id, today: todayIso }),
    getPublicHolidaysInRange(`${thisYear}-01-01`, `${thisYear + 1}-12-31`),
  ]);

  return (
    <AppShell
      current="leave"
      role={mapMemberToShellRole(member)}
      profile={mapMemberToShellProfile(member)}
      user={mapMemberToShellUser(member)}
    >
      <LeaveClient
        view={view}
        month={month}
        currentMonth={currentMonth}
        todayIso={todayIso}
        calendarLeaves={calendar.items.map(toLeaveView)}
        holidays={toLeaveHolidays(calendar.holidays, locale)}
        ownSummary={calendar.ownSummary}
        upcoming={own.upcoming.map(toLeaveView)}
        past={own.past.map(toLeaveView)}
        minDate={getLeaveEarliestStartDate(member.timezone)}
        formHolidayDates={formHolidays.map(({ date }) => date)}
      />
    </AppShell>
  );
}
