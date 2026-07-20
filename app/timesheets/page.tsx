import { AlertTriangle, CalendarDays, Clock3, FileText, WalletCards } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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
import { SectionHead } from "@/src/components/ui/SectionHead";
import {
  accountStatusRoute,
  mapMemberToShellRole,
  mapMemberToShellUser,
  requireActiveAppMember,
} from "@/src/server/auth/app-access";
import {
  getContractorTimesheetMonthlyPreview,
  parseTimesheetMonthParam,
  type ContractorTimesheetMonthlyPreview,
  type TimesheetProjectPreview,
  type TimesheetPreviewRate,
  type TimesheetPreviewStatus,
} from "@/src/server/timesheets";

export const dynamic = "force-dynamic";

type TimesheetsPageProps = {
  searchParams?: Promise<{
    month?: string | string[];
  }>;
};

type TimesheetsTranslator = Awaited<ReturnType<typeof getTranslations>>;

export default async function TimesheetsPage({ searchParams }: TimesheetsPageProps) {
  const resolvedSearchParams = await searchParams;
  const monthParam = getSingleParam(resolvedSearchParams?.month);
  const callbackURL = `/timesheets${monthParam ? `?month=${encodeURIComponent(monthParam)}` : ""}`;
  const { member } = await requireActiveAppMember(callbackURL);

  if (member.currentProfile !== "CONTRACTOR") {
    redirect(accountStatusRoute(callbackURL, "contractor-required"));
  }

  const [preview, t, locale] = await Promise.all([
    getContractorTimesheetMonthlyPreview({
      memberId: member.id,
      monthStart: parseTimesheetMonthParam(monthParam),
    }),
    getTranslations("Timesheets"),
    getLocale(),
  ]);
  const shellRole = mapMemberToShellRole(member);
  const totalAmountLabel = formatPreviewAmount(preview, locale, t);

  return (
    <AppShell current="timesheets" role={shellRole} user={mapMemberToShellUser(member)}>
      <section className="mx-auto grid w-full max-w-[73.75rem] gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <SectionHead eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />

        <MonthSelector preview={preview} locale={locale} t={t} />

        <Card variant="featured" density="lg">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div>
              <StatusPill
                status={preview.status}
                label={getStatusLabel(preview.status, t)}
                density="comfortable"
              />
              <h2 className="mt-3 text-2xl font-semibold text-foreground">
                {formatMonthLabel(preview.periodStart, locale)}
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {formatPeriodRange(preview.periodStart, preview.periodEnd, locale)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:min-w-[28rem]">
              <SummaryMetric
                icon={Clock3}
                label={t("summary.hours")}
                value={formatHours(preview.totalMinutes, locale)}
              />
              <SummaryMetric
                icon={WalletCards}
                label={t("summary.amount")}
                value={totalAmountLabel}
              />
              <SummaryMetric
                icon={FileText}
                label={t("summary.entries")}
                value={formatCount(preview.entryCount, locale)}
              />
            </div>
          </div>
        </Card>

        <PreviewWarnings preview={preview} t={t} />

        <Card variant="elevated" density="lg">
          <CardHeader className="block">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>{t("breakdown.title")}</CardTitle>
                <CardDescription>
                  {preview.source === "timesheet_snapshot"
                    ? t("breakdown.snapshotSource")
                    : t("breakdown.currentSource")}
                </CardDescription>
              </div>
              {preview.revisionNumber ? (
                <Badge tone="info">{t("revision", { number: preview.revisionNumber })}</Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {preview.projects.length > 0 ? (
              <ProjectBreakdownTable projects={preview.projects} locale={locale} t={t} />
            ) : (
              <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-secondary/45 px-5 py-8 text-center text-sm text-muted-foreground">
                {t("breakdown.empty")}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

function MonthSelector({
  preview,
  locale,
  t,
}: {
  preview: ContractorTimesheetMonthlyPreview;
  locale: string;
  t: TimesheetsTranslator;
}) {
  return (
    <Card density="sm" className="overflow-hidden">
      <div className="flex gap-2 overflow-x-auto p-2">
        {preview.months.map((month) => {
          const active = month.month === preview.selectedMonth;

          return (
            <Button key={month.month} asChild variant={active ? "primary" : "soft"} size="sm">
              <Link href={`/timesheets?month=${month.month}` as Route}>
                <CalendarDays className="size-4" aria-hidden="true" />
                <span>{formatMonthLabel(month.periodStart, locale)}</span>
                <span className="sr-only">, {getStatusLabel(month.status, t)}</span>
              </Link>
            </Button>
          );
        })}
      </div>
    </Card>
  );
}

function PreviewWarnings({
  preview,
  t,
}: {
  preview: ContractorTimesheetMonthlyPreview;
  t: TimesheetsTranslator;
}) {
  const warnings = [
    preview.mixedCurrency ? t("warnings.mixedCurrency") : null,
    preview.missingRateLineCount > 0
      ? t("warnings.missingRates", { count: preview.missingRateLineCount })
      : null,
    preview.rejectionReason ? t("warnings.rejected", { reason: preview.rejectionReason }) : null,
  ].filter((warning): warning is string => Boolean(warning));

  if (warnings.length === 0) return null;

  return (
    <div className="grid gap-2">
      {warnings.map((warning) => (
        <div
          key={warning}
          className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{warning}</p>
        </div>
      ))}
    </div>
  );
}

function ProjectBreakdownTable({
  projects,
  locale,
  t,
}: {
  projects: TimesheetProjectPreview[];
  locale: string;
  t: TimesheetsTranslator;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse">
          <caption className="sr-only">{t("breakdown.caption")}</caption>
          <thead>
            <tr className="border-b border-border bg-background/45">
              <HeadCell>{t("table.project")}</HeadCell>
              <HeadCell>{t("table.hours")}</HeadCell>
              <HeadCell>{t("table.rate")}</HeadCell>
              <HeadCell>{t("table.amount")}</HeadCell>
              <HeadCell>{t("table.entries")}</HeadCell>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.projectId} className="border-b border-border last:border-b-0">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="size-3 rounded-full"
                      style={{ backgroundColor: project.projectColor }}
                      aria-hidden="true"
                    />
                    <span className="font-ui text-sm font-semibold text-foreground">
                      {project.projectName}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 font-ui text-sm font-semibold text-foreground">
                  {formatHours(project.totalMinutes, locale)}
                </td>
                <td className="px-4 py-4 text-sm text-muted-foreground">
                  <RateCell project={project} locale={locale} t={t} />
                </td>
                <td className="px-4 py-4 font-ui text-sm font-semibold text-foreground">
                  {formatProjectAmount(project, locale, t)}
                </td>
                <td className="px-4 py-4 text-sm text-muted-foreground">
                  {formatCount(project.entryCount, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RateCell({
  project,
  locale,
  t,
}: {
  project: TimesheetProjectPreview;
  locale: string;
  t: TimesheetsTranslator;
}) {
  if (project.missingRateLineCount > 0) {
    return <Badge tone="warning">{t("rate.missing")}</Badge>;
  }

  if (project.mixedRates) {
    return <Badge tone="neutral">{t("rate.mixed")}</Badge>;
  }

  if (!project.singleRate) {
    return <span>{t("rate.none")}</span>;
  }

  return (
    <span>
      {formatRate(project.singleRate, locale)} · {t(`rateSource.${project.singleRate.source}`)}
    </span>
  );
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-card/70 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em]">
          {label}
        </span>
      </div>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function HeadCell({ children }: { children: string }) {
  return (
    <th className="px-4 py-3 text-left font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </th>
  );
}

function formatPreviewAmount(
  preview: Pick<
    ContractorTimesheetMonthlyPreview,
    "totalAmount" | "currencyCode" | "mixedCurrency" | "missingRateLineCount"
  >,
  locale: string,
  t: TimesheetsTranslator,
) {
  if (preview.mixedCurrency) return t("amount.mixedCurrency");
  if (!preview.totalAmount || !preview.currencyCode) {
    return preview.missingRateLineCount > 0 ? t("amount.missingRate") : t("amount.none");
  }

  return formatMoney(preview.totalAmount, preview.currencyCode, locale);
}

function formatProjectAmount(
  project: Pick<
    TimesheetProjectPreview,
    "amount" | "currencyCode" | "mixedCurrency" | "missingRateLineCount"
  >,
  locale: string,
  t: TimesheetsTranslator,
) {
  if (project.mixedCurrency) return t("amount.mixedCurrency");
  if (!project.amount || !project.currencyCode) {
    return project.missingRateLineCount > 0 ? t("amount.missingRate") : t("amount.none");
  }

  return formatMoney(project.amount, project.currencyCode, locale);
}

function formatRate(rate: TimesheetPreviewRate, locale: string) {
  const formattedRate = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(Number(rate.hourlyRate));

  return `${formattedRate} ${rate.currencyCode}/h`;
}

function formatMoney(amount: string, currencyCode: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
    currencyDisplay: "code",
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

function formatHours(minutes: number, locale: string) {
  const hours = minutes / 60;

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(hours);
}

function formatCount(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatMonthLabel(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatPeriodRange(start: string, end: string, locale: string) {
  const formatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return `${formatter.format(new Date(`${start}T00:00:00.000Z`))} - ${formatter.format(
    new Date(`${end}T00:00:00.000Z`),
  )}`;
}

function getStatusLabel(status: TimesheetPreviewStatus, t: TimesheetsTranslator) {
  return t(`status.${status}`);
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.at(0) ?? "";
  }

  return value ?? "";
}
