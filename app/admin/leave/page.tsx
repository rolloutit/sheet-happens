import { getLocale } from "next-intl/server";

import { AppShell } from "@/src/components/layout/AppShell";
import {
  mapMemberToShellProfile,
  mapMemberToShellUser,
  requireAdminAppMember,
} from "@/src/server/auth/app-access";
import {
  getPublicHolidaysInRange,
  listLeaveForAdmin,
  normalizeAdminLeaveFilters,
} from "@/src/server/leave";
import { getTodayIsoInTimezone } from "@/src/server/time-tracking";
import { toLeaveHolidays } from "@/app/leave/leave-page-data";
import { AdminLeaveClient } from "./AdminLeaveClient";

export const dynamic = "force-dynamic";

type AdminLeavePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** A month never holds more leave than this; the calendar asks for all of it at once. */
const CALENDAR_PAGE_SIZE = 1000;

export default async function AdminLeavePage({ searchParams }: AdminLeavePageProps) {
  const { member } = await requireAdminAppMember("/admin/leave");
  const params = (await searchParams) ?? {};
  const view = params.view === "calendar" ? "calendar" : "list";
  const todayIso = getTodayIsoInTimezone(member.timezone);
  const currentMonth = todayIso.slice(0, 7);
  const parsed = normalizeAdminLeaveFilters(params);
  // The calendar always shows one month and everyone in it, whatever the HR state.
  const filters =
    view === "calendar"
      ? { ...parsed, month: parsed.month ?? currentMonth, hr: "all" as const, page: 1 }
      : parsed;
  const thisYear = Number.parseInt(todayIso.slice(0, 4), 10);
  const calendarMonth = filters.month ?? currentMonth;
  // The calendar draws Monday of the first week to Sunday of the last; a week either side covers it.
  const [gridYear, gridMonth] = calendarMonth.split("-").map(Number) as [number, number];
  const gridStart = new Date(Date.UTC(gridYear, gridMonth - 1, -6)).toISOString().slice(0, 10);
  const gridEnd = new Date(Date.UTC(gridYear, gridMonth, 7)).toISOString().slice(0, 10);

  const [locale, result, formHolidays, calendarHolidays] = await Promise.all([
    getLocale(),
    listLeaveForAdmin(
      filters,
      view === "calendar"
        ? { pageSize: CALENDAR_PAGE_SIZE, range: { from: gridStart, to: gridEnd } }
        : {},
    ),
    getPublicHolidaysInRange(`${thisYear - 1}-01-01`, `${thisYear + 1}-12-31`),
    view === "calendar" ? getPublicHolidaysInRange(gridStart, gridEnd) : Promise.resolve([]),
  ]);

  return (
    <AppShell
      current="leave-admin"
      role="admin"
      profile={mapMemberToShellProfile(member)}
      user={mapMemberToShellUser(member)}
    >
      <AdminLeaveClient
        view={view}
        filters={{
          month: filters.month ?? "",
          memberIds: filters.memberIds,
          type: filters.types.length === 1 ? filters.types[0]! : "",
          hr: filters.hr,
        }}
        employeeOptions={result.employeeOptions}
        rows={result.rows.map((row) => ({
          id: row.id,
          memberId: row.memberId,
          memberName: row.memberName,
          memberEmail: row.memberEmail,
          kind: row.kind,
          dayPart: row.dayPart,
          startDate: row.startDate,
          endDate: row.endDate,
          workdays: row.workdays,
          isOwn: false,
          note: row.note,
          attachment: row.attachment,
          hrProcessedAt: row.hrProcessedAt?.toISOString() ?? null,
          hrProcessedByName: row.hrProcessedByName,
        }))}
        page={result.page}
        totalPages={result.totalPages}
        totalItems={result.totalItems}
        pendingCount={result.pendingCount}
        calendar={
          view === "calendar"
            ? {
                month: calendarMonth,
                currentMonth,
                todayIso,
                holidays: toLeaveHolidays(calendarHolidays, locale),
              }
            : null
        }
        formHolidayDates={formHolidays.map(({ date }) => date)}
      />
    </AppShell>
  );
}
