import type { Route } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { AppShell } from "@/src/components/layout/AppShell";
import { Button } from "@/src/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/Card";
import { SectionHead } from "@/src/components/ui/SectionHead";
import {
  mapMemberToShellProfile,
  mapMemberToShellUser,
  requireAdminAppMember,
} from "@/src/server/auth/app-access";
import {
  listTimesheetsForAdmin,
  type AdminTimesheetListResult,
  type AdminTimesheetSearchParams,
} from "@/src/server/timesheets";
import { AdminTimesheetTable } from "./AdminTimesheetTable";
import { TimesheetFilterBar } from "./TimesheetFilterBar";
import { formatCount, getActionResultMessage } from "./formatting";

export const dynamic = "force-dynamic";

type AdminTimesheetsPageProps = {
  searchParams?: Promise<AdminTimesheetSearchParams>;
};

type AdminTimesheetsTranslator = Awaited<ReturnType<typeof getTranslations>>;

export default async function AdminTimesheetsPage({ searchParams }: AdminTimesheetsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const { member: admin } = await requireAdminAppMember("/admin/timesheets");
  const [result, t, locale] = await Promise.all([
    listTimesheetsForAdmin(resolvedSearchParams),
    getTranslations("AdminTimesheets"),
    getLocale(),
  ]);
  const actionResult = getSingleParam(resolvedSearchParams.result);
  const actionResultMessage = getActionResultMessage(actionResult, t, {
    count: getPositiveIntegerParam(resolvedSearchParams.count),
  });
  const currentListHref = buildPageHref(result, result.filters.page);

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
            <TimesheetFilterBar
              query={result.filters.query}
              status={result.filters.status}
              contractorMemberId={result.filters.contractorMemberId}
              projectId={result.filters.projectId}
              month={result.filters.month}
              contractorOptions={result.contractorOptions}
              projectOptions={result.projectOptions}
            />
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
            <AdminTimesheetTable
              key={`${currentListHref}:${actionResult}`}
              rows={result.rows}
              returnTo={currentListHref}
            />
            <Pagination result={result} t={t} />
          </CardContent>
        </Card>
      </section>
    </AppShell>
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

function getPositiveIntegerParam(value: string | string[] | undefined) {
  const parsed = Number.parseInt(getSingleParam(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
