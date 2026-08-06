import { CalendarDays, FolderKanban, Users, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { AppShell } from "@/src/components/layout/AppShell";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { SectionHead } from "@/src/components/ui/SectionHead";
import { defaultLocale, resolveLocale, supportedLocales, type AppLocale } from "@/src/i18n/locales";
import {
  formatCount,
  formatDateLabel,
  formatHours,
  formatHoursWithUnit,
  formatPeriodRange,
} from "@/src/lib/formatting";
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
  type ReportCostFreeLine,
  type ReportFilterOption,
  type ReportPeriodMode,
  type ReportSearchParams,
  type ReportSnapshot,
  type ReportView,
} from "@/src/server/reports";
import { formatDateOnly, getMonday, parseDateOnly } from "@/src/server/time-tracking";

import { ReportExportModal } from "./ReportExportModal";

export const dynamic = "force-dynamic";

type AdminReportsPageProps = {
  searchParams?: Promise<ReportSearchParams>;
};

type AdminReportsTranslator = Awaited<ReturnType<typeof getTranslations>>;

const selectClassName =
  "h-11 min-w-0 rounded-[var(--radius-md)] border border-border bg-background px-4 py-2.5 font-body text-sm font-semibold text-foreground shadow-[0_14px_40px_-30px_rgba(0,0,0,0.45)] transition focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

export default async function AdminReportsPage({ searchParams }: AdminReportsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const { member: admin } = await requireAdminAppMember("/admin/reports");
  const [t, locale, options] = await Promise.all([
    getTranslations("AdminReports"),
    getLocale(),
    listReportFilterOptions(),
  ]);
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
      <section className="mx-auto grid w-full max-w-[73.75rem] gap-4 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <SectionHead eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
          <ReportExportModal
            exportFields={reportExportFieldsFromFilters(filters)}
            defaultTitles={exportTitles}
            initialLocale={resolveLocale(locale) ?? defaultLocale}
            timezone={admin.timezone}
            disabled={snapshot.lines.length === 0}
          />
        </div>

        <ReportFilters
          snapshot={snapshot}
          options={options}
          filters={filters}
          locale={locale}
          t={t}
        />

        <div className="grid gap-3 md:grid-cols-4">
          <SummaryCard
            label={t("stats.totalHours")}
            value={formatHoursWithUnit(snapshot.summary.totalMinutes, locale)}
          />
          <SummaryCard
            label={t("stats.period")}
            value={formatPeriod(snapshot.period.start, snapshot.period.end, locale)}
          />
          <SummaryCard
            label={t("stats.people")}
            value={formatCount(snapshot.summary.peopleCount, locale)}
          />
          <SummaryCard
            label={t("stats.projects")}
            value={formatCount(snapshot.summary.projectCount, locale)}
          />
        </div>

        {snapshot.lines.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-border bg-card p-6 shadow-soft">
            <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-secondary/45 px-5 py-10 text-center">
              <p className="font-ui text-sm font-semibold text-foreground">{t("empty.title")}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t("empty.description")}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(24rem,1fr)]">
              <div className="rounded-[var(--radius-lg)] border border-border bg-card px-5 py-5 shadow-soft">
                <div className="mb-4 font-display text-[15px] font-semibold text-foreground">
                  {t("charts.time")}
                </div>
                <div>
                  <WeekBars lines={snapshot.lines} locale={locale} />
                </div>
              </div>

              <div className="rounded-[var(--radius-lg)] border border-border bg-card px-5 py-5 shadow-soft">
                <div className="mb-4 font-display text-[15px] font-semibold text-foreground">
                  {snapshot.view === "USER" ? t("charts.users") : t("charts.projects")}
                </div>
                <DonutBreakdown snapshot={snapshot} locale={locale} />
              </div>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-border bg-card px-5 py-5 shadow-soft">
              <div className="mb-4 font-display text-lg font-semibold text-foreground">
                {snapshot.view === "USER" ? t("charts.projects") : t("charts.users")}
              </div>
              <HorizontalBreakdown snapshot={snapshot} locale={locale} />
            </div>

            <div>
              <div className="mb-3 flex flex-col gap-1">
                <h2 className="font-display text-lg font-semibold text-foreground">
                  {t("detail.title")}
                </h2>
                <p className="text-sm text-muted-foreground">{t("detail.description")}</p>
              </div>
              <ReportDetail snapshot={snapshot} locale={locale} t={t} />
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}

function ReportFilters({
  snapshot,
  options,
  filters,
  locale,
  t,
}: {
  snapshot: ReportSnapshot;
  options: Awaited<ReturnType<typeof listReportFilterOptions>>;
  filters: ReturnType<typeof parseReportSearchParams>;
  locale: string;
  t: AdminReportsTranslator;
}) {
  const baseParams = new URLSearchParams();
  if (snapshot.filters.projectId) baseParams.set("project", snapshot.filters.projectId);
  if (snapshot.filters.projectGroupId) baseParams.set("group", snapshot.filters.projectGroupId);
  if (snapshot.filters.memberId) baseParams.set("member", snapshot.filters.memberId);
  baseParams.set("view", snapshot.view);

  return (
    <form
      className="rounded-[var(--radius-lg)] border border-border bg-card px-4 py-4 shadow-soft"
      action="/admin/reports"
    >
      <input type="hidden" name="period" value={filters.period} />
      <input type="hidden" name="view" value={snapshot.view} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-[var(--radius-pill)] bg-secondary p-1">
          {(["month", "week", "day", "year", "custom"] as const).map((period) => (
            <Link
              key={period}
              href={buildPeriodHref(period, filters, snapshot, baseParams) as Route}
              className={`inline-flex h-9 items-center rounded-[var(--radius-pill)] px-4 font-body text-sm font-semibold transition ${
                filters.period === period
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`period.${period}`)}
            </Link>
          ))}
        </div>

        {filters.period === "custom" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="report-start"
              name="start"
              type="date"
              defaultValue={snapshot.period.start}
              className="h-11 w-[10.75rem]"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              id="report-end"
              name="end"
              type="date"
              defaultValue={snapshot.period.end}
              className="h-11 w-[10.75rem]"
            />
          </div>
        ) : (
          <Input
            id="report-anchor"
            name="anchor"
            type={
              filters.period === "month" ? "month" : filters.period === "year" ? "number" : "date"
            }
            defaultValue={
              filters.period === "month"
                ? filters.anchor.slice(0, 7)
                : filters.period === "year"
                  ? filters.anchor.slice(0, 4)
                  : filters.anchor
            }
            min={filters.period === "year" ? "2000" : undefined}
            max={filters.period === "year" ? "2100" : undefined}
            className="h-11 w-[10.75rem]"
          />
        )}

        <div className="hidden h-10 w-px bg-border lg:block" />

        <select
          id="report-project"
          name="project"
          defaultValue={snapshot.filters.projectId ?? ""}
          className={`${selectClassName} w-full sm:w-[15rem]`}
          aria-label={t("filters.project")}
        >
          <option value="">{t("filters.projectAll")}</option>
          {options.projects.map((option) => (
            <ReportOption key={option.value} option={option} />
          ))}
        </select>
        <select
          id="report-group"
          name="group"
          defaultValue={snapshot.filters.projectGroupId ?? ""}
          className={`${selectClassName} w-full sm:w-[15rem]`}
          aria-label={t("filters.group")}
        >
          <option value="">{t("filters.groupAll")}</option>
          {options.projectGroups.map((option) => (
            <ReportOption key={option.value} option={option} />
          ))}
        </select>
        <select
          id="report-member"
          name="member"
          defaultValue={snapshot.filters.memberId ?? ""}
          className={`${selectClassName} w-full sm:w-[15rem]`}
          aria-label={t("filters.member")}
        >
          <option value="">{t("filters.memberAll")}</option>
          {options.members.map((option) => (
            <ReportOption key={option.value} option={option} />
          ))}
        </select>

        <div className="ml-auto inline-flex rounded-[var(--radius-pill)] border border-border bg-secondary p-1">
          <Link
            href={buildViewHref("USER", filters, snapshot) as Route}
            className={`inline-flex h-9 items-center gap-2 rounded-[var(--radius-pill)] px-4 font-body text-sm font-semibold transition ${
              snapshot.view === "USER"
                ? "bg-primary text-primary-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="size-4" aria-hidden />
            {t("views.user")}
          </Link>
          <Link
            href={buildViewHref("PROJECT", filters, snapshot) as Route}
            className={`inline-flex h-9 items-center gap-2 rounded-[var(--radius-pill)] px-4 font-body text-sm font-semibold transition ${
              snapshot.view === "PROJECT"
                ? "bg-primary text-primary-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FolderKanban className="size-4" aria-hidden />
            {t("views.project")}
          </Link>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="size-4 text-accent" aria-hidden />
          {formatPeriod(snapshot.period.start, snapshot.period.end, locale)}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="soft">
            {t("filters.apply")}
          </Button>
          <Button asChild variant="ghost">
            <Link href={"/admin/reports" as Route}>
              <X className="size-4" aria-hidden />
              {t("filters.clear")}
            </Link>
          </Button>
        </div>
      </div>
    </form>
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

function normalizeAnchorForPeriod(anchor: string, period: ReportPeriodMode) {
  if (period === "month") return anchor.slice(0, 7);
  if (period === "year") return anchor.slice(0, 4);
  return anchor;
}

function ReportOption({ option }: { option: ReportFilterOption }) {
  return (
    <option value={option.value}>
      {option.caption ? `${option.label} (${option.caption})` : option.label}
    </option>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-card px-5 py-4 shadow-soft">
      <p className="font-ui text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-semibold leading-none text-foreground">
        {value}
      </p>
    </div>
  );
}

function WeekBars({ lines, locale }: { lines: ReportCostFreeLine[]; locale: string }) {
  const buckets = buildWeekBuckets(lines);
  const maxMinutes = Math.max(1, ...buckets.map((bucket) => bucket.totalMinutes));

  return (
    <div className="flex min-h-52 items-end gap-4 overflow-x-auto pb-1">
      {buckets.map((bucket) => {
        const height = Math.max(12, Math.round((bucket.totalMinutes / maxMinutes) * 142));

        return (
          <div
            key={bucket.key}
            className="flex min-h-48 min-w-16 flex-1 flex-col items-center justify-end gap-2"
          >
            <span className="text-sm font-semibold text-foreground">
              {bucket.totalMinutes ? formatHoursWithUnit(bucket.totalMinutes, locale) : ""}
            </span>
            <span
              className="w-12 rounded-t-[var(--radius-md)] bg-accent shadow-[0_12px_28px_rgba(31,128,127,0.18)]"
              style={{ height }}
              aria-hidden="true"
            />
            <span className="font-ui text-[11px] font-semibold uppercase text-muted-foreground">
              {bucket.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DonutBreakdown({ snapshot, locale }: { snapshot: ReportSnapshot; locale: string }) {
  const segments = snapshot.groups.map((group, index) => ({
    key: group.key,
    label: group.label,
    percentage: group.percentageOfTotal,
    color: getGroupColor(snapshot.view, group.color, index),
  }));
  const gradient = buildConicGradient(segments);

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div
        className="relative grid size-36 shrink-0 place-items-center rounded-full"
        style={{ background: gradient }}
        aria-hidden="true"
      >
        <div className="grid size-24 place-items-center rounded-full bg-card text-center shadow-inner">
          <span className="font-display text-2xl font-semibold leading-none text-foreground">
            {formatHours(snapshot.summary.totalMinutes, locale)}
          </span>
          <span className="font-ui text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            h
          </span>
        </div>
      </div>
      <div className="min-w-44 flex-1">
        <LegendList segments={segments} />
      </div>
    </div>
  );
}

function HorizontalBreakdown({ snapshot, locale }: { snapshot: ReportSnapshot; locale: string }) {
  const dimension = snapshot.view === "USER" ? "PROJECT" : "USER";
  const rows = buildBreakdown(snapshot.lines, dimension, snapshot.summary.totalMinutes);

  return (
    <div className="grid gap-2">
      {rows.map((row, index) => (
        <div
          key={row.key}
          className="grid grid-cols-[minmax(8rem,10rem)_1fr_6rem] items-center gap-3 py-1.5"
        >
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
            {dimension === "PROJECT" ? (
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: getGroupColor("PROJECT", row.color, index) }}
                aria-hidden="true"
              />
            ) : (
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft font-ui text-[11px] font-bold text-accent">
                {row.initials}
              </span>
            )}
            <span className="truncate">{row.label}</span>
          </span>
          <span className="h-2.5 overflow-hidden rounded-full bg-secondary">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.max(2, row.percentage)}%`,
                backgroundColor: getGroupColor(dimension, row.color, index),
              }}
            />
          </span>
          <span className="text-right text-sm text-muted-foreground">
            <b className="font-display text-foreground">
              {formatHoursWithUnit(row.totalMinutes, locale)}
            </b>{" "}
            · {Math.round(row.percentage)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function LegendList({
  segments,
}: {
  segments: Array<{ key: string; label: string; percentage: number; color: string }>;
}) {
  return (
    <div className="grid gap-2">
      {segments.map((segment) => (
        <div key={segment.key} className="flex items-center gap-2 text-sm">
          <span
            className="size-2.5 shrink-0 rounded-[3px]"
            style={{ backgroundColor: segment.color }}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate text-muted-foreground">{segment.label}</span>
          <span className="font-display font-semibold text-foreground">
            {Math.round(segment.percentage)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function buildBreakdown(lines: ReportCostFreeLine[], dimension: ReportView, totalMinutes: number) {
  const rows = new Map<
    string,
    {
      key: string;
      label: string;
      color: string | null;
      initials: string | null;
      totalMinutes: number;
      percentage: number;
    }
  >();

  for (const line of lines) {
    const key = dimension === "PROJECT" ? line.project.id : line.member.id;
    const existing =
      rows.get(key) ??
      ({
        key,
        label: dimension === "PROJECT" ? line.project.name : line.member.name,
        color: dimension === "PROJECT" ? line.project.color : null,
        initials: dimension === "USER" ? line.member.initials : null,
        totalMinutes: 0,
        percentage: 0,
      } satisfies {
        key: string;
        label: string;
        color: string | null;
        initials: string | null;
        totalMinutes: number;
        percentage: number;
      });

    existing.totalMinutes += line.durationMinutes;
    rows.set(key, existing);
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      percentage: totalMinutes === 0 ? 0 : (row.totalMinutes / totalMinutes) * 100,
    }))
    .sort((left, right) => right.totalMinutes - left.totalMinutes);
}

function buildConicGradient(segments: Array<{ percentage: number; color: string }>) {
  if (segments.length === 0) {
    return "var(--secondary)";
  }

  let cursor = 0;
  const stops = segments.map((segment) => {
    const start = cursor;
    const end = cursor + segment.percentage;
    cursor = end;
    return `${segment.color} ${start}% ${end}%`;
  });

  return `conic-gradient(${stops.join(", ")})`;
}

const userChartColors = ["#29C6C6", "#5FE0DA", "#1F7475", "#FAAB59", "#F08A82", "#B58B2C"];

function getGroupColor(view: ReportView, color: string | null, index: number) {
  if (view === "PROJECT" && color) return color;
  return userChartColors[index % userChartColors.length] ?? "#29C6C6";
}

function ReportDetail({
  snapshot,
  locale,
  t,
}: {
  snapshot: ReportSnapshot;
  locale: string;
  t: AdminReportsTranslator;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card shadow-soft">
      {snapshot.groups.map((group) => {
        const lines = snapshot.lines.filter((line) =>
          snapshot.view === "USER" ? line.member.id === group.key : line.project.id === group.key,
        );

        return (
          <div key={group.key} className="border-b border-border last:border-b-0">
            <div className="flex flex-wrap items-center gap-3 bg-secondary/50 px-5 py-4">
              {snapshot.view === "PROJECT" ? (
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: getGroupColor("PROJECT", group.color, 0) }}
                  aria-hidden="true"
                />
              ) : (
                <span className="grid size-9 place-items-center rounded-full bg-accent-soft font-ui text-xs font-bold text-accent">
                  {lines[0]?.member.initials ?? group.label.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-display text-base font-semibold text-foreground">
                  {group.label}
                </div>
                {snapshot.view === "PROJECT" && group.isInternalProject ? (
                  <Badge tone="warning">{t("detail.internalProject")}</Badge>
                ) : null}
              </div>
              <div className="font-display text-lg font-semibold text-foreground">
                {formatHoursWithUnit(group.totalMinutes, locale)}
              </div>
            </div>
            <div className="divide-y divide-border/70">
              {lines.map((line) => (
                <div
                  key={line.id}
                  className="grid gap-3 px-5 py-3 md:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)_6rem] md:items-center"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {line.description || t("table.noDescription")}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDate(line.localDate, locale)}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {snapshot.view === "USER" ? line.project.name : line.member.name}
                  </div>
                  <div className="font-display text-sm font-semibold text-foreground md:text-right">
                    {formatHoursWithUnit(line.durationMinutes, locale)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function buildWeekBuckets(lines: ReportCostFreeLine[]) {
  const buckets = new Map<string, { key: string; label: string; totalMinutes: number }>();

  for (const line of lines) {
    const weekStart = getMonday(parseDateOnly(line.localDate));
    const key = formatDateOnly(weekStart);
    const existing =
      buckets.get(key) ??
      ({
        key,
        label: key.slice(5),
        totalMinutes: 0,
      } satisfies { key: string; label: string; totalMinutes: number });

    existing.totalMinutes += line.durationMinutes;
    buckets.set(key, existing);
  }

  return [...buckets.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function formatDate(value: string, locale: string) {
  return formatDateLabel(value, locale, { style: "short" });
}

function formatPeriod(start: string, end: string, locale: string) {
  return formatPeriodRange(start, end, locale, { style: "short" });
}

/**
 * One generated title per supported language, so the dialog can follow its own language selector
 * without a round trip — the export language is not the interface language.
 */
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
