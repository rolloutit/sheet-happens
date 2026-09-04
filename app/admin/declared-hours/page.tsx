import { getLocale, getTranslations } from "next-intl/server";

import { AppShell } from "@/src/components/layout/AppShell";
import { SectionHead } from "@/src/components/ui/SectionHead";
import {
  mapMemberToShellProfile,
  mapMemberToShellUser,
  requireAdminAppMember,
} from "@/src/server/auth/app-access";
import {
  formatDateOnly,
  getMonthStart,
  listDeclaredHoursForMonth,
} from "@/src/server/time-tracking";
import { AdminDeclaredHoursTable } from "./AdminDeclaredHoursTable";

export const dynamic = "force-dynamic";

type AdminDeclaredHoursPageProps = {
  searchParams?: Promise<{ month?: string | string[] }>;
};

/**
 * The admin surface for declared monthly hours — §17 decision 7's "can an admin enter or correct a
 * declared figure on the member's behalf".
 *
 * **Why the month lives in the URL.** A declared figure is month-scoped and has no finer
 * resolution, so "which month" is the page's only real dimension. Carrying it as `?month=` makes a
 * month linkable and lets each month be one server render of its own — which is right here, unlike
 * on `/time`, where the month payload already sits in the client and a navigation would re-issue
 * queries for data it holds. Changing months here *is* a real navigation.
 *
 * **Why not the report line editor.** That is where an admin corrects a tracked entry, and §4
 * deliberately keeps declared figures out of it: a declared aggregate is not a day of work, and the
 * reporting chain does not carry it. A declared figure is corrected at the month level, which is
 * what this page is for an admin.
 */
export default async function AdminDeclaredHoursPage({
  searchParams,
}: AdminDeclaredHoursPageProps) {
  const { member: admin } = await requireAdminAppMember("/admin/declared-hours");
  const resolvedSearchParams = (await searchParams) ?? {};
  const [t, locale] = await Promise.all([getTranslations("AdminDeclaredHours"), getLocale()]);

  const monthStart = resolveMonthStart(getSingleParam(resolvedSearchParams.month));
  const month = await listDeclaredHoursForMonth({ monthStart });

  return (
    <AppShell
      current="declared-hours"
      role="admin"
      profile={mapMemberToShellProfile(admin)}
      user={mapMemberToShellUser(admin)}
    >
      <section className="mx-auto grid w-full max-w-[92rem] gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <SectionHead eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />

        <AdminDeclaredHoursTable
          month={month}
          previousMonth={shiftMonthStartIso(month.monthStart, -1)}
          nextMonth={shiftMonthStartIso(month.monthStart, 1)}
          currentMonth={formatDateOnly(getMonthStart(new Date()))}
          adminMemberId={admin.id}
          locale={locale}
          durationDisplayFormat={admin.durationDisplayFormat}
        />
      </section>
    </AppShell>
  );
}

/**
 * The month the page is showing.
 *
 * Falls back to the current month rather than throwing: a hand-edited or stale `?month=` is a
 * navigation mistake, and an admin list that 500s on one is worse than one that quietly shows now.
 */
function resolveMonthStart(value: string | undefined) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00.000Z`);

    if (!Number.isNaN(parsed.getTime())) return getMonthStart(parsed);
  }

  return getMonthStart(new Date());
}

/**
 * A month start shifted by whole months.
 *
 * `Date.UTC` with an out-of-range month index normalizes on its own, so December → January and the
 * year rolls with it; and because the day is always 1, there is no shorter-month clamping to get
 * wrong.
 */
function shiftMonthStartIso(monthStartIso: string, months: number) {
  const start = new Date(`${monthStartIso}T00:00:00.000Z`);

  return formatDateOnly(
    new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 1)),
  );
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
