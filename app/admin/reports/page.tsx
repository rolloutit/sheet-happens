import { getLocale, getTranslations } from "next-intl/server";

import { AppShell } from "@/src/components/layout/AppShell";
import { defaultLocale, resolveLocale, supportedLocales, type AppLocale } from "@/src/i18n/locales";
import { formatPeriodRange } from "@/src/lib/formatting";
import {
  mapMemberToShellProfile,
  mapMemberToShellUser,
  requireAdminAppMember,
} from "@/src/server/auth/app-access";
import {
  getTimeEntryReportSnapshot,
  listReportFilterOptions,
  parseReportSearchParams,
  reportExportFieldsFromFilters,
  type ReportPeriodMode,
  type ReportSearchParams,
  type ReportSnapshot,
  type ReportView,
} from "@/src/server/reports";

import { ReportFiltersBar } from "./ReportFiltersBar";
import { ReportWorkspace } from "./ReportWorkspace";

export const dynamic = "force-dynamic";

type AdminReportsPageProps = {
  searchParams?: Promise<ReportSearchParams>;
};

export default async function AdminReportsPage({ searchParams }: AdminReportsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const { member: admin } = await requireAdminAppMember("/admin/reports");
  const [locale, options] = await Promise.all([getLocale(), listReportFilterOptions()]);
  const filters = parseReportSearchParams(resolvedSearchParams, admin.timezone);
  const snapshot = await getTimeEntryReportSnapshot({
    periodStart: filters.periodStart,
    periodEnd: filters.periodEnd,
    view: filters.view,
    mode: "COST_FREE",
    projectId: filters.projectId,
    projectGroupId: filters.projectGroupId,
    memberId: filters.memberId,
  });
  const exportTitles = await buildExportTitles(snapshot.period);

  return (
    <AppShell
      current="reports"
      role="admin"
      profile={mapMemberToShellProfile(admin)}
      user={mapMemberToShellUser(admin)}
    >
      <ReportWorkspace
        snapshot={snapshot}
        locale={locale}
        exportFields={reportExportFieldsFromFilters(filters)}
        defaultTitles={exportTitles}
        initialLocale={resolveLocale(locale) ?? defaultLocale}
        timezone={admin.timezone}
        filters={
          <ReportFiltersBar
            period={filters.period}
            view={snapshot.view}
            anchor={filters.anchor}
            periodStart={snapshot.period.start}
            periodEnd={snapshot.period.end}
            periodSummary={formatPeriod(snapshot.period.start, snapshot.period.end, locale)}
            projectId={snapshot.filters.projectId ?? ""}
            groupId={snapshot.filters.projectGroupId ?? ""}
            memberId={snapshot.filters.memberId ?? ""}
            projects={options.projects}
            projectGroups={options.projectGroups}
            members={options.members}
            periodHrefs={buildPeriodHrefs(filters, snapshot)}
            viewHrefs={{
              USER: buildViewHref("USER", filters, snapshot),
              PROJECT: buildViewHref("PROJECT", filters, snapshot),
            }}
          />
        }
      />
    </AppShell>
  );
}

function buildViewHref(
  view: ReportView,
  filters: ReturnType<typeof parseReportSearchParams>,
  snapshot: ReportSnapshot,
) {
  const params = new URLSearchParams();
  params.set("period", filters.period);
  params.set("view", view);
  if (filters.period === "custom") {
    params.set("start", snapshot.period.start);
    params.set("end", snapshot.period.end);
  } else {
    params.set("anchor", filters.anchor);
  }
  if (snapshot.filters.projectId) params.set("project", snapshot.filters.projectId);
  if (snapshot.filters.projectGroupId) params.set("group", snapshot.filters.projectGroupId);
  if (snapshot.filters.memberId) params.set("member", snapshot.filters.memberId);
  return `/admin/reports?${params.toString()}`;
}

function buildPeriodHref(
  period: ReportPeriodMode,
  filters: ReturnType<typeof parseReportSearchParams>,
  snapshot: ReportSnapshot,
  baseParams: URLSearchParams,
) {
  const params = new URLSearchParams(baseParams);
  params.set("period", period);
  if (period === "custom") {
    params.set("start", snapshot.period.start);
    params.set("end", snapshot.period.end);
  } else {
    params.set("anchor", normalizeAnchorForPeriod(filters.anchor, period));
  }
  return `/admin/reports?${params.toString()}`;
}

function buildPeriodHrefs(
  filters: ReturnType<typeof parseReportSearchParams>,
  snapshot: ReportSnapshot,
) {
  const baseParams = new URLSearchParams();
  if (snapshot.filters.projectId) baseParams.set("project", snapshot.filters.projectId);
  if (snapshot.filters.projectGroupId) baseParams.set("group", snapshot.filters.projectGroupId);
  if (snapshot.filters.memberId) baseParams.set("member", snapshot.filters.memberId);
  baseParams.set("view", snapshot.view);

  return {
    month: buildPeriodHref("month", filters, snapshot, baseParams),
    week: buildPeriodHref("week", filters, snapshot, baseParams),
    day: buildPeriodHref("day", filters, snapshot, baseParams),
    year: buildPeriodHref("year", filters, snapshot, baseParams),
    custom: buildPeriodHref("custom", filters, snapshot, baseParams),
  };
}

function normalizeAnchorForPeriod(anchor: string, period: ReportPeriodMode) {
  if (period === "month") return anchor.slice(0, 7);
  if (period === "year") return anchor.slice(0, 4);
  return anchor;
}

function formatPeriod(start: string, end: string, locale: string) {
  return formatPeriodRange(start, end, locale, { style: "short" });
}

async function buildExportTitles(period: ReportSnapshot["period"]) {
  const titles = await Promise.all(
    supportedLocales.map(async (locale) => {
      const t = await getTranslations({ locale, namespace: "AdminReports" });

      return [
        locale,
        `${t("export.defaultTitle")} - ${formatPeriod(period.start, period.end, locale)}`,
      ] as const;
    }),
  );

  return Object.fromEntries(titles) as Record<AppLocale, string>;
}
