import type { Route } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

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
import { firstSearchParam } from "@/src/lib/search-params";
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
import { getActionResultMessage } from "./formatting";

export const dynamic = "force-dynamic";

type AdminTimesheetsPageProps = {
  searchParams?: Promise<AdminTimesheetSearchParams>;
};

type AdminTimesheetsTranslator = Awaited<ReturnType<typeof getTranslations>>;

export default async function AdminTimesheetsPage({ searchParams }: AdminTimesheetsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const { member: admin } = await requireAdminAppMember("/admin/timesheets");
  const [result, t] = await Promise.all([
    listTimesheetsForAdmin(resolvedSearchParams),
    getTranslations("AdminTimesheets"),
  ]);
  const actionResult = firstSearchParam(resolvedSearchParams.result);
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

        <TimesheetFilterBar
          query={result.filters.query}
          statuses={result.filters.statuses}
          contractorMemberIds={result.filters.contractorMemberIds}
          projectIds={result.filters.projectIds}
          month={result.filters.month}
          contractorOptions={result.contractorOptions}
          projectOptions={result.projectOptions}
        />

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

function buildPageHref(result: AdminTimesheetListResult, page: number) {
  const params = new URLSearchParams();
  const safePage = Math.min(Math.max(page, 1), result.totalPages);

  if (result.filters.query) params.set("q", result.filters.query);
  // Multi-select filters travel as one repeated parameter per value, which is what both the
  // hidden `<select multiple>` in the toolbar and `listSearchParam` on the way back expect.
  for (const status of result.filters.statuses) params.append("status", status);
  for (const contractorMemberId of result.filters.contractorMemberIds) {
    params.append("contractor", contractorMemberId);
  }
  for (const projectId of result.filters.projectIds) params.append("project", projectId);
  if (result.filters.month) params.set("month", result.filters.month);
  if (safePage > 1) params.set("page", String(safePage));

  const query = params.toString();
  return query ? `/admin/timesheets?${query}` : "/admin/timesheets";
}

function getPositiveIntegerParam(value: string | string[] | undefined) {
  const parsed = Number.parseInt(firstSearchParam(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
