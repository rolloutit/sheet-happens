import { CalendarDays, Eye, Filter, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { AppShell } from "@/src/components/layout/AppShell";
import { StatusPill } from "@/src/components/sheet/StatusPill";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/Card";
import { Field } from "@/src/components/ui/Field";
import { Input } from "@/src/components/ui/Input";
import { SectionHead } from "@/src/components/ui/SectionHead";
import {
  mapMemberToShellProfile,
  mapMemberToShellUser,
  requireAdminAppMember,
} from "@/src/server/auth/app-access";
import {
  listTimesheetsForAdmin,
  type AdminTimesheetListResult,
  type AdminTimesheetRow,
  type AdminTimesheetSearchParams,
} from "@/src/server/timesheets";
import {
  formatCount,
  formatHours,
  formatMoney,
  formatMonthLabel,
  formatPeriodRange,
  formatTimestamp,
  getActionResultMessage,
  getStatusLabel,
  toTimesheetPreviewStatus,
} from "./formatting";

export const dynamic = "force-dynamic";

type AdminTimesheetsPageProps = {
  searchParams?: Promise<AdminTimesheetSearchParams>;
};

type AdminTimesheetsTranslator = Awaited<ReturnType<typeof getTranslations>>;

const selectClassName =
  "flex h-10 w-full rounded-[var(--radius-md)] border border-input bg-background/50 px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35";

export default async function AdminTimesheetsPage({ searchParams }: AdminTimesheetsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const { member: admin } = await requireAdminAppMember("/admin/timesheets");
  const [result, t, locale] = await Promise.all([
    listTimesheetsForAdmin(resolvedSearchParams),
    getTranslations("AdminTimesheets"),
    getLocale(),
  ]);
  const actionResult = getSingleParam(resolvedSearchParams.result);
  const actionResultMessage = getActionResultMessage(actionResult, t);

  return (
    <AppShell
      current="review"
      role="admin"
      profile={mapMemberToShellProfile(admin)}
      user={mapMemberToShellUser(admin)}
    >
      <section className="mx-auto grid w-full max-w-[92rem] gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <SectionHead eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />

        {actionResultMessage ? (
          <div className="rounded-[var(--radius-lg)] border border-accent/30 bg-accent-soft px-4 py-3 text-sm font-medium text-accent">
            {actionResultMessage}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <SummaryCard
            label={t("stats.matching")}
            value={formatCount(result.totalItems, locale)}
            caption={t("stats.matchingCaption")}
          />
          <SummaryCard
            label={t("stats.page")}
            value={`${formatCount(result.pageStart, locale)}-${formatCount(result.pageEnd, locale)}`}
            caption={t("stats.pageCaption")}
          />
          <SummaryCard
            label={t("stats.pageSize")}
            value={formatCount(result.filters.pageSize, locale)}
            caption={t("stats.pageSizeCaption")}
          />
        </div>

        <Card density="lg">
          <CardHeader className="block">
            <CardTitle>{t("filters.title")}</CardTitle>
            <CardDescription>{t("filters.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <TimesheetFilters result={result} t={t} />
          </CardContent>
        </Card>

        <Card density="lg">
          <CardHeader className="block">
            <CardTitle>{t("list.title")}</CardTitle>
            <CardDescription>
              {t("list.showing", {
                start: result.pageStart,
                end: result.pageEnd,
                total: result.totalItems,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TimesheetTable rows={result.rows} locale={locale} t={t} />
            <Pagination result={result} t={t} />
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

function TimesheetFilters({
  result,
  t,
}: {
  result: AdminTimesheetListResult;
  t: AdminTimesheetsTranslator;
}) {
  return (
    <form className="grid gap-4" action="/admin/timesheets">
      <div className="grid gap-3 lg:grid-cols-[minmax(15rem,1fr)_repeat(4,minmax(10rem,13rem))]">
        <Field label={t("filters.search")} htmlFor="timesheet-search">
          <Input
            id="timesheet-search"
            name="q"
            type="search"
            defaultValue={result.filters.query}
            placeholder={t("filters.searchPlaceholder")}
          />
        </Field>
        <Field label={t("filters.status")} htmlFor="timesheet-status">
          <select
            id="timesheet-status"
            name="status"
            defaultValue={result.filters.status}
            className={selectClassName}
          >
            <option value="">{t("filters.allStatuses")}</option>
            {[
              "SUBMITTED",
              "REJECTED",
              "APPROVED",
              "ACCEPTED",
              "INVOICED",
              "INVOICE_REJECTED",
              "PAID",
            ].map((status) => (
              <option key={status} value={status}>
                {getStatusLabel(status, t)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("filters.contractor")} htmlFor="timesheet-contractor">
          <select
            id="timesheet-contractor"
            name="contractor"
            defaultValue={result.filters.contractorMemberId}
            className={selectClassName}
          >
            <option value="">{t("filters.allContractors")}</option>
            {result.contractorOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.email ? `${option.label} (${option.email})` : option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("filters.project")} htmlFor="timesheet-project">
          <select
            id="timesheet-project"
            name="project"
            defaultValue={result.filters.projectId}
            className={selectClassName}
          >
            <option value="">{t("filters.allProjects")}</option>
            {result.projectOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("filters.month")} htmlFor="timesheet-month">
          <Input
            id="timesheet-month"
            name="month"
            type="month"
            defaultValue={result.filters.month}
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" icon={Filter}>
          {t("filters.apply")}
        </Button>
        <Button asChild variant="ghost">
          <Link href={"/admin/timesheets" as Route}>
            <X className="size-4" aria-hidden />
            {t("filters.clear")}
          </Link>
        </Button>
      </div>
    </form>
  );
}

function TimesheetTable({
  rows,
  locale,
  t,
}: {
  rows: AdminTimesheetRow[];
  locale: string;
  t: AdminTimesheetsTranslator;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-secondary/45 px-5 py-8 text-center text-sm text-muted-foreground">
        {t("list.empty")}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[64rem] border-collapse">
          <caption className="sr-only">{t("list.caption")}</caption>
          <thead>
            <tr className="border-b border-border bg-background/45">
              <HeadCell>{t("table.contractor")}</HeadCell>
              <HeadCell>{t("table.month")}</HeadCell>
              <HeadCell>{t("table.status")}</HeadCell>
              <HeadCell>{t("table.hours")}</HeadCell>
              <HeadCell>{t("table.amount")}</HeadCell>
              <HeadCell>{t("table.submitted")}</HeadCell>
              <HeadCell>{t("table.snapshot")}</HeadCell>
              <HeadCell>{t("table.action")}</HeadCell>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <AvatarLabel name={row.contractorName} />
                    <div>
                      <p className="font-ui text-sm font-semibold text-foreground">
                        {row.contractorName}
                      </p>
                      <p className="text-xs text-muted-foreground">{row.contractorEmail}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-start gap-2">
                    <CalendarDays className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
                    <div>
                      <p className="font-ui text-sm font-semibold text-foreground">
                        {formatMonthLabel(row.periodStart, locale)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatPeriodRange(row.periodStart, row.periodEnd, locale)}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <StatusPill
                    status={toTimesheetPreviewStatus(row.status)}
                    label={getStatusLabel(row.status, t)}
                  />
                </td>
                <td className="px-4 py-4 font-ui text-sm font-semibold text-foreground">
                  {formatHours(row.totalMinutes, locale)}
                </td>
                <td className="px-4 py-4 font-ui text-sm font-semibold text-foreground">
                  {formatMoney(row.totalAmount, row.currencyCode, locale)}
                </td>
                <td className="px-4 py-4 text-sm text-muted-foreground">
                  {formatTimestamp(row.submittedAt, locale)}
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="info">{t("revision", { number: row.revisionNumber })}</Badge>
                    <Badge tone="neutral">{t("list.entries", { count: row.entryCount })}</Badge>
                    <Badge tone="neutral">{t("list.projects", { count: row.projectCount })}</Badge>
                  </div>
                </td>
                <td className="px-4 py-4 text-right">
                  <Button asChild variant="soft" size="sm">
                    <Link href={`/admin/timesheets/${row.id}` as Route}>
                      <Eye className="size-4" aria-hidden />
                      {t("list.review")}
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pagination({
  result,
  t,
}: {
  result: AdminTimesheetListResult;
  t: AdminTimesheetsTranslator;
}) {
  if (result.totalPages <= 1) return null;

  const previousHref = buildPageHref(result, result.filters.page - 1);
  const nextHref = buildPageHref(result, result.filters.page + 1);
  const canGoPrevious = result.filters.page > 1;
  const canGoNext = result.filters.page < result.totalPages;

  return (
    <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <p className="text-sm text-muted-foreground">
        {t("pagination.summary", {
          page: result.filters.page,
          totalPages: result.totalPages,
          totalItems: result.totalItems,
        })}
      </p>
      <div className="flex gap-2">
        {canGoPrevious ? (
          <Button asChild variant="soft" size="sm">
            <Link href={previousHref as Route}>{t("pagination.previous")}</Link>
          </Button>
        ) : (
          <Button type="button" variant="soft" size="sm" disabled>
            {t("pagination.previous")}
          </Button>
        )}
        {canGoNext ? (
          <Button asChild variant="soft" size="sm">
            <Link href={nextHref as Route}>{t("pagination.next")}</Link>
          </Button>
        ) : (
          <Button type="button" variant="soft" size="sm" disabled>
            {t("pagination.next")}
          </Button>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-card/70 p-4">
      <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{caption}</p>
    </div>
  );
}

function AvatarLabel({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((part) => part.at(0))
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft font-ui text-xs font-bold text-accent">
      {initials || "TS"}
    </span>
  );
}

function HeadCell({ children }: { children: string }) {
  return (
    <th className="px-4 py-3 text-left font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </th>
  );
}

function buildPageHref(result: AdminTimesheetListResult, page: number) {
  const params = new URLSearchParams();
  const safePage = Math.min(Math.max(page, 1), result.totalPages);

  if (result.filters.query) params.set("q", result.filters.query);
  if (result.filters.status) params.set("status", result.filters.status);
  if (result.filters.contractorMemberId)
    params.set("contractor", result.filters.contractorMemberId);
  if (result.filters.projectId) params.set("project", result.filters.projectId);
  if (result.filters.month) params.set("month", result.filters.month);
  if (safePage > 1) params.set("page", String(safePage));

  const query = params.toString();
  return query ? `/admin/timesheets?${query}` : "/admin/timesheets";
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.at(0) ?? "";
  return value ?? "";
}
