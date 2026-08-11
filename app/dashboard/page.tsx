import type { Route } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Coins,
  Clock3,
  Eye,
  FileCheck2,
  FileText,
  FolderKanban,
  Inbox,
  Lock,
  Plus,
  Timer,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { HTMLAttributes } from "react";

import { AppShell } from "@/src/components/layout/AppShell";
import { StatusPill } from "@/src/components/sheet/StatusPill";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { formatHoursWithUnit, formatMoney } from "@/src/lib/formatting";
import { cn } from "@/src/lib/utils";
import {
  mapMemberToShellProfile,
  mapMemberToShellRole,
  mapMemberToShellUser,
  requireActiveAppMember,
} from "@/src/server/auth/app-access";
import {
  getDashboardDataForMember,
  type AdminDashboardDrilldown,
  type AdminDashboardMissingTimesheetRow,
  type AdminDashboardData,
  type AdminPriorityMetric,
  type AdminStatusSegment,
  type ContractorDashboardActionId,
  type ContractorDashboardData,
  type DashboardFlaggedUser,
  type DashboardPeriod,
  type DashboardWeeklyProject,
  type EmployeeDashboardData,
} from "@/src/server/dashboard";
import type { TimesheetPreviewStatus } from "@/src/server/timesheets";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams?: Promise<{
    drilldown?: string | string[];
  }>;
};

type DashboardTranslator = Awaited<ReturnType<typeof getTranslations>>;

const priorityIcons: Record<AdminPriorityMetric["id"], LucideIcon> = {
  submitted: Inbox,
  approved: FileText,
  invoiced: FileCheck2,
  accepted: Wallet,
  missing: AlertTriangle,
};

const priorityAccent: Record<AdminPriorityMetric["id"], string> = {
  submitted: "#FAAB59",
  approved: "#2FD4D4",
  invoiced: "#66D6A8",
  accepted: "#4FC79B",
  missing: "#F08A82",
};

const statusColor: Record<AdminStatusSegment["id"], string> = {
  submitted: "#FAAB59",
  rejected: "#F08A82",
  approved: "#2FD4D4",
  invoiced: "#9AA5A6",
  invoice_rejected: "#D8A03D",
  accepted: "#4FC79B",
  paid: "#4FC79B",
  missing: "#F08A82",
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = await searchParams;
  const { member } = await requireActiveAppMember("/dashboard");
  const [t, locale, dashboard] = await Promise.all([
    getTranslations("Dashboard"),
    getLocale(),
    getDashboardDataForMember(member, {
      drilldown: resolvedSearchParams?.drilldown,
    }),
  ]);
  const shellRole = mapMemberToShellRole(member);
  const shellProfile = mapMemberToShellProfile(member);
  const shellUser = mapMemberToShellUser(member);

  return (
    <AppShell current="dashboard" role={shellRole} profile={shellProfile} user={shellUser}>
      <section className="mx-auto grid w-full max-w-[73.75rem] gap-4 px-4 py-8 sm:px-6 lg:px-8">
        {dashboard.kind === "admin" ? (
          <AdminDashboard dashboard={dashboard} locale={locale} t={t} />
        ) : dashboard.kind === "contractor" ? (
          <ContractorDashboard dashboard={dashboard} locale={locale} t={t} />
        ) : (
          <EmployeeDashboard dashboard={dashboard} locale={locale} t={t} />
        )}
      </section>
    </AppShell>
  );
}

function EmployeeDashboard({
  dashboard,
  locale,
  t,
}: {
  dashboard: EmployeeDashboardData;
  locale: string;
  t: DashboardTranslator;
}) {
  return (
    <>
      <DashboardGreeting
        name={dashboard.greetingName}
        subtitle={t("member.subtitle", {
          status: t(`member.status.${dashboard.monthStatus}`),
          month: formatMonth(dashboard.period.monthStart, locale),
          week: formatWeekRange(dashboard.period, locale),
        })}
        t={t}
      />
      <MemberStats dashboard={dashboard} locale={locale} t={t} />
      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.9fr]">
        <EmployeeProjectBreakdown dashboard={dashboard} locale={locale} t={t} />
        <EmployeeMonthStatusPanel dashboard={dashboard} locale={locale} t={t} />
      </div>
      <WeeklyChecklist projects={dashboard.weeklyProjects} t={t} />
    </>
  );
}

function ContractorDashboard({
  dashboard,
  locale,
  t,
}: {
  dashboard: ContractorDashboardData;
  locale: string;
  t: DashboardTranslator;
}) {
  return (
    <>
      <DashboardGreeting
        name={dashboard.greetingName}
        subtitle={t("contractor.subtitle", {
          status: t(`timesheetStatus.${dashboard.timesheet.status}`),
          month: formatMonth(dashboard.period.monthStart, locale),
        })}
        t={t}
      />
      <MemberStats dashboard={dashboard} locale={locale} t={t} />
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <ContractorStepper dashboard={dashboard} t={t} />
        <ContractorNextActionPanel action={dashboard.nextAction} t={t} />
      </div>
      <WeeklyChecklist projects={dashboard.weeklyProjects} t={t} />
    </>
  );
}

function AdminDashboard({
  dashboard,
  locale,
  t,
}: {
  dashboard: AdminDashboardData;
  locale: string;
  t: DashboardTranslator;
}) {
  const submitted =
    dashboard.priorityMetrics.find((metric) => metric.id === "submitted")?.count ?? 0;
  const accepted = dashboard.priorityMetrics.find((metric) => metric.id === "accepted")?.count ?? 0;

  return (
    <>
      <DashboardGreeting
        name={dashboard.greetingName}
        subtitle={t("admin.subtitle", {
          submitted,
          accepted,
        })}
        t={t}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {dashboard.priorityMetrics.map((metric) => (
          <PriorityMetricCard
            key={metric.id}
            metric={metric}
            active={dashboard.drilldown?.id === metric.id}
            t={t}
          />
        ))}
      </div>
      {dashboard.drilldown ? (
        <AdminDrilldownPanel
          drilldown={dashboard.drilldown}
          period={dashboard.period}
          locale={locale}
          t={t}
        />
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <FlaggedUsersPanel
          users={dashboard.flaggedUsers}
          period={dashboard.period}
          locale={locale}
          t={t}
        />
        <StatusDistribution segments={dashboard.statusSegments} t={t} />
      </div>
    </>
  );
}

function DashboardGreeting({
  name,
  subtitle,
  t,
}: {
  name: string;
  subtitle: string;
  t: DashboardTranslator;
}) {
  return (
    <header className="mb-2">
      <p className="mb-3 font-ui text-[12px] font-bold uppercase tracking-[0.18em] text-accent">
        {t("eyebrow")}
      </p>
      <h1 className="font-display text-[34px] font-medium leading-none tracking-[-0.02em] text-foreground sm:text-[38px]">
        {t("greeting", { name: getGivenName(name) })}
      </h1>
      <p className="mt-3 text-base text-muted-foreground">{subtitle}</p>
    </header>
  );
}

function MemberStats({
  dashboard,
  locale,
  t,
}: {
  dashboard: EmployeeDashboardData | ContractorDashboardData;
  locale: string;
  t: DashboardTranslator;
}) {
  const stats = [
    {
      id: "activeProjects",
      label: t("stats.activeProjects"),
      value: formatNumber(dashboard.activeProjectCount, locale),
      icon: FolderKanban,
      accent: "#2FD4D4",
    },
    {
      id: "hours",
      label: t("stats.hours"),
      value: formatHoursWithUnit(dashboard.monthMinutes, locale),
      icon: Timer,
      accent: "#239B9B",
      trend: formatTrend(dashboard.monthMinutes, dashboard.previousMonthMinutes),
    },
    dashboard.kind === "contractor"
      ? {
          id: "amount",
          label: t("stats.expectedAmount"),
          value: formatContractorAmount(dashboard, locale, t),
          icon: Coins,
          accent: "#FAAB59",
        }
      : {
          id: "internalCost",
          label: t("stats.internalCost"),
          value: formatEmployeeCost(dashboard, locale, t),
          icon: Coins,
          accent: "#FAAB59",
        },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => (
        <MetricPanel key={stat.id} {...stat} />
      ))}
    </div>
  );
}

function MetricPanel({
  label,
  value,
  icon: Icon,
  accent,
  trend,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent: string;
  trend?: string | null;
}) {
  return (
    <DashboardPanel className="grid gap-4 p-5">
      <div className="flex items-center justify-between gap-4">
        <span
          className="flex size-9 items-center justify-center rounded-[var(--radius-md)]"
          style={{ backgroundColor: `${accent}22`, color: accent }}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        {trend ? <span className="font-ui text-xs font-semibold text-success">{trend}</span> : null}
      </div>
      <div>
        <p className="font-display text-3xl font-semibold leading-none tracking-[-0.02em] text-foreground">
          {value}
        </p>
        <p className="mt-2 font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
      </div>
    </DashboardPanel>
  );
}

function EmployeeProjectBreakdown({
  dashboard,
  locale,
  t,
}: {
  dashboard: EmployeeDashboardData;
  locale: string;
  t: DashboardTranslator;
}) {
  return (
    <DashboardPanel className="overflow-hidden p-0">
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-3 font-ui text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
            {t("member.projectBreakdown.title")}
          </p>
          <h2 className="font-display text-lg font-medium text-foreground">
            {t("member.projectBreakdown.heading")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("member.projectBreakdown.description")}
          </p>
        </div>
        <Button asChild variant="soft" size="sm">
          <Link href={"/time" as Route}>
            <Plus className="size-4" aria-hidden="true" />
            {t("weekly.log")}
          </Link>
        </Button>
      </div>

      {dashboard.projectBreakdown.length === 0 ? (
        <DashboardEmptyState>{t("member.projectBreakdown.empty")}</DashboardEmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse">
            <thead>
              <tr className="border-b border-border bg-background/35">
                <DrilldownHeadCell>{t("member.projectBreakdown.table.project")}</DrilldownHeadCell>
                <DrilldownHeadCell>{t("member.projectBreakdown.table.hours")}</DrilldownHeadCell>
                <DrilldownHeadCell>{t("member.projectBreakdown.table.rate")}</DrilldownHeadCell>
                <DrilldownHeadCell>{t("member.projectBreakdown.table.cost")}</DrilldownHeadCell>
                <DrilldownHeadCell align="right">
                  {t("member.projectBreakdown.table.entries")}
                </DrilldownHeadCell>
              </tr>
            </thead>
            <tbody>
              {dashboard.projectBreakdown.map((project) => (
                <tr key={project.projectId} className="border-b border-border last:border-b-0">
                  <td className="px-5 py-4">
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: project.projectColor }}
                      />
                      <span className="truncate text-sm font-semibold text-foreground">
                        {project.projectName}
                      </span>
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-foreground">
                    {formatHoursWithUnit(project.totalMinutes, locale)}
                  </td>
                  <td className="px-5 py-4">
                    <EmployeeRateLabel
                      singleRate={project.singleRate}
                      mixedRates={project.mixedRates}
                      missingRateLineCount={project.missingRateLineCount}
                      locale={locale}
                      t={t}
                    />
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-foreground">
                    {formatEmployeeCostTotals(project.costTotals, locale, t)}
                    {project.missingRateLineCount > 0 ? (
                      <span className="mt-1 block text-xs font-medium text-warning">
                        {t("member.projectBreakdown.missingRates", {
                          count: project.missingRateLineCount,
                        })}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-4 text-right text-sm text-muted-foreground">
                    {project.entryCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardPanel>
  );
}

function EmployeeMonthStatusPanel({
  dashboard,
  locale,
  t,
}: {
  dashboard: EmployeeDashboardData;
  locale: string;
  t: DashboardTranslator;
}) {
  const statusTone =
    dashboard.monthStatus === "tracked"
      ? "success"
      : dashboard.monthStatus === "missing_rates"
        ? "warning"
        : "neutral";

  return (
    <DashboardPanel className="p-6">
      <p className="mb-4 font-ui text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
        {t("member.statusPanel.title")}
      </p>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold leading-tight text-foreground">
            {t(`member.status.${dashboard.monthStatus}`)}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t(`member.statusPanel.${dashboard.monthStatus}`)}
          </p>
        </div>
        <Badge tone={statusTone}>{t("member.statusPanel.current")}</Badge>
      </div>
      <div className="grid gap-3">
        <StatusMetric
          label={t("member.statusPanel.totalCost")}
          value={formatEmployeeCost(dashboard, locale, t)}
        />
        <StatusMetric
          label={t("stats.averageWeek")}
          value={formatHoursWithUnit(dashboard.averageWeekMinutes, locale)}
        />
        <StatusMetric
          label={t("member.statusPanel.missingRates")}
          value={formatNumber(dashboard.missingRateLineCount, locale)}
        />
      </div>
    </DashboardPanel>
  );
}

function EmployeeRateLabel({
  singleRate,
  mixedRates,
  missingRateLineCount,
  locale,
  t,
}: {
  singleRate: EmployeeDashboardData["projectBreakdown"][number]["singleRate"];
  mixedRates: boolean;
  missingRateLineCount: number;
  locale: string;
  t: DashboardTranslator;
}) {
  if (mixedRates) {
    return <Badge tone="warning">{t("member.projectBreakdown.mixedRates")}</Badge>;
  }

  if (!singleRate) {
    return (
      <Badge tone={missingRateLineCount > 0 ? "warning" : "neutral"}>
        {t("member.projectBreakdown.noRate")}
      </Badge>
    );
  }

  return (
    <span className="text-sm font-semibold text-foreground">
      {formatMoney(singleRate.hourlyRate, singleRate.currencyCode, locale, {
        display: "code",
      })}
      /h
    </span>
  );
}

function StatusMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-background/35 px-4 py-3">
      <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function WeeklyChecklist({
  projects,
  t,
}: {
  projects: DashboardWeeklyProject[];
  t: DashboardTranslator;
}) {
  const missing = projects.filter((project) => !project.logged && !project.inactive);
  const allDone = projects.length > 0 && missing.length === 0;

  return (
    <DashboardPanel className="p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="mb-3 font-ui text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
            {t("weekly.title")}
          </p>
          <h2 className="max-w-[34rem] font-display text-lg font-medium leading-snug text-foreground">
            {t("weekly.question")}
          </h2>
        </div>
        <Button asChild variant="soft" size="sm">
          <Link href={"/time" as Route}>
            <Plus className="size-4" aria-hidden="true" />
            {t("weekly.log")}
          </Link>
        </Button>
      </div>
      {projects.length === 0 ? (
        <div className="rounded-[var(--radius-md)] bg-secondary p-4 text-sm text-muted-foreground">
          {t("weekly.empty")}
        </div>
      ) : allDone ? (
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-success/25 bg-success-soft p-4 text-success">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success text-primary-foreground">
            <Check className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold">{t("weekly.allClear")}</p>
            <p className="mt-1 text-sm text-success/80">{t("weekly.allClearDescription")}</p>
          </div>
        </div>
      ) : (
        <div className="grid">
          {projects.map((project, index) => (
            <div
              key={project.projectId}
              className={cn(
                "grid gap-3 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center",
                index > 0 && "border-t border-border",
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: project.projectColor }}
                />
                <span className="truncate text-sm font-semibold text-foreground">
                  {project.projectName}
                </span>
              </span>
              <WeeklyProjectState project={project} t={t} />
              {!project.logged && !project.inactive ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={"/time" as Route}>{t("weekly.log")}</Link>
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </DashboardPanel>
  );
}

function WeeklyProjectState({
  project,
  t,
}: {
  project: DashboardWeeklyProject;
  t: DashboardTranslator;
}) {
  if (project.logged) {
    return (
      <span className="inline-flex items-center gap-2 text-sm font-medium text-success">
        <CheckCircle2 className="size-4" aria-hidden="true" />
        {t("weekly.logged")}
      </span>
    );
  }

  if (project.inactive) {
    return <Badge tone="neutral">{t("weekly.inactive")}</Badge>;
  }

  return <span className="text-sm font-medium text-warning">{t("weekly.missing")}</span>;
}

function ContractorStepper({
  dashboard,
  t,
}: {
  dashboard: ContractorDashboardData;
  t: DashboardTranslator;
}) {
  const nodes = getStepperNodes(dashboard.timesheet.status, t);

  return (
    <DashboardPanel className="p-6">
      <div className="mb-7 flex items-center justify-between gap-4">
        <h2 className="font-display text-lg font-medium text-foreground">
          {t("contractor.stepperTitle")}
        </h2>
        <StatusPill
          status={dashboard.timesheet.status}
          label={t(`timesheetStatus.${dashboard.timesheet.status}`)}
        />
      </div>
      <div className="flex items-start">
        {nodes.map((node, index) => (
          <div key={node.id} className="contents">
            {index > 0 ? (
              <span
                className={cn(
                  "mt-[17px] h-0.5 min-w-4 flex-1 rounded-full",
                  node.state === "done" ? "bg-accent" : "bg-border",
                )}
                aria-hidden="true"
              />
            ) : null}
            <div className="flex w-16 shrink-0 flex-col items-center gap-2">
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border-2 font-ui text-sm font-bold",
                  node.state === "done" && "border-accent bg-accent text-primary-foreground",
                  node.state === "active" &&
                    "border-accent bg-card text-accent shadow-[0_0_0_4px_var(--accent-soft)]",
                  node.state === "disabled" && "border-border bg-secondary text-muted-foreground",
                )}
              >
                {node.state === "done" ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : node.state === "disabled" ? (
                  <Lock className="size-3.5" aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  "text-center font-ui text-[11px] font-semibold leading-tight",
                  node.state === "active" ? "text-accent" : "text-muted-foreground",
                )}
              >
                {node.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </DashboardPanel>
  );
}

const contractorActionIcons: Record<ContractorDashboardActionId, LucideIcon> = {
  record_time: Timer,
  resolve_rates: AlertTriangle,
  review_and_submit: FileText,
  correct_timesheet: FileText,
  awaiting_approval: Clock3,
  upload_invoice: FileCheck2,
  upload_cancellation_invoice: AlertTriangle,
  upload_replacement_invoice: FileCheck2,
  review_invoice_rejection: AlertTriangle,
  awaiting_invoice_review: Clock3,
  awaiting_payment: Wallet,
  complete: CheckCircle2,
};

const contractorActionTone: Record<ContractorDashboardActionId, "accent" | "warning" | "success"> =
  {
    record_time: "accent",
    resolve_rates: "warning",
    review_and_submit: "accent",
    correct_timesheet: "warning",
    awaiting_approval: "accent",
    upload_invoice: "accent",
    upload_cancellation_invoice: "warning",
    upload_replacement_invoice: "warning",
    review_invoice_rejection: "warning",
    awaiting_invoice_review: "accent",
    awaiting_payment: "accent",
    complete: "success",
  };

function ContractorNextActionPanel({
  action,
  t,
}: {
  action: ContractorDashboardData["nextAction"];
  t: DashboardTranslator;
}) {
  const Icon = contractorActionIcons[action.id];
  const tone = contractorActionTone[action.id];
  const isComplete = action.id === "complete";

  return (
    <DashboardPanel className="p-6">
      <p className="font-ui text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
        {t("contractor.nextAction.eyebrow")}
      </p>
      <div className="mt-4 flex items-start gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)]",
            tone === "accent" && "bg-accent-soft text-accent",
            tone === "warning" && "bg-warning-soft text-warning",
            tone === "success" && "bg-success-soft text-success",
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-medium text-foreground">
            {t(`contractor.nextAction.${action.id}.title`)}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {t(`contractor.nextAction.${action.id}.description`)}
          </p>
        </div>
      </div>
      <Button asChild variant={tone === "warning" ? "soft" : "cta"} className="mt-6 w-full">
        <Link href={action.href as Route}>
          {isComplete
            ? t("contractor.nextAction.complete.cta")
            : t(`contractor.nextAction.${action.id}.cta`)}
        </Link>
      </Button>
    </DashboardPanel>
  );
}

function PriorityMetricCard({
  metric,
  active,
  t,
}: {
  metric: AdminPriorityMetric;
  active: boolean;
  t: DashboardTranslator;
}) {
  const Icon = priorityIcons[metric.id];
  const accent = priorityAccent[metric.id];

  return (
    <Link href={metric.href as Route} className="block min-w-0">
      <DashboardPanel
        className={cn(
          "grid h-full gap-4 p-5 transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-pop",
          active && "border-accent bg-accent-soft/40",
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <span
            className="flex size-9 items-center justify-center rounded-[var(--radius-md)]"
            style={{ backgroundColor: `${accent}22`, color: accent }}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <div>
          <p className="font-display text-3xl font-semibold leading-none tracking-[-0.02em] text-foreground">
            {metric.count}
          </p>
          <p className="mt-2 text-sm font-medium leading-snug text-muted-foreground">
            {t(`admin.priority.${metric.id}`)}
          </p>
        </div>
      </DashboardPanel>
    </Link>
  );
}

function AdminDrilldownPanel({
  drilldown,
  period,
  locale,
  t,
}: {
  drilldown: AdminDashboardDrilldown;
  period: DashboardPeriod;
  locale: string;
  t: DashboardTranslator;
}) {
  return (
    <DashboardPanel className="overflow-hidden p-0">
      <div className="flex flex-col gap-4 border-b border-border p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-3 font-ui text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
            {t("admin.drilldown.eyebrow")}
          </p>
          <h2 className="font-display text-2xl font-semibold leading-tight text-foreground">
            {t(`admin.drilldown.${drilldown.id}.title`, {
              count: drilldown.totalItems,
            })}
          </h2>
          <p className="mt-2 max-w-[44rem] text-sm leading-6 text-muted-foreground">
            {t(`admin.drilldown.${drilldown.id}.description`, {
              month: formatMonth(period.monthStart, locale),
              week: formatWeekRange(period, locale),
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="soft" size="sm">
            <Link href={drilldown.fullHref as Route}>
              <ArrowUpRight className="size-4" aria-hidden="true" />
              {drilldown.kind === "timesheets"
                ? t("admin.drilldown.openFullList")
                : t("admin.drilldown.openReport")}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={"/dashboard" as Route}>
              <X className="size-4" aria-hidden="true" />
              {t("admin.drilldown.close")}
            </Link>
          </Button>
        </div>
      </div>

      {drilldown.kind === "timesheets" ? (
        <TimesheetDrilldownTable drilldown={drilldown} locale={locale} t={t} />
      ) : drilldown.kind === "missing" ? (
        <MissingTimesheetDrilldownTable
          rows={drilldown.rows}
          period={period}
          locale={locale}
          t={t}
        />
      ) : (
        <FlaggedUsersDrilldownTable users={drilldown.rows} period={period} locale={locale} t={t} />
      )}
    </DashboardPanel>
  );
}

function TimesheetDrilldownTable({
  drilldown,
  locale,
  t,
}: {
  drilldown: Extract<AdminDashboardDrilldown, { kind: "timesheets" }>;
  locale: string;
  t: DashboardTranslator;
}) {
  if (drilldown.rows.length === 0) {
    return <DashboardEmptyState>{t("admin.drilldown.empty")}</DashboardEmptyState>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[58rem] border-collapse">
        <thead>
          <tr className="border-b border-border bg-background/35">
            <DrilldownHeadCell>{t("admin.drilldown.table.contractor")}</DrilldownHeadCell>
            <DrilldownHeadCell>{t("admin.drilldown.table.month")}</DrilldownHeadCell>
            <DrilldownHeadCell>{t("admin.drilldown.table.status")}</DrilldownHeadCell>
            <DrilldownHeadCell>{t("admin.drilldown.table.hours")}</DrilldownHeadCell>
            <DrilldownHeadCell>{t("admin.drilldown.table.amount")}</DrilldownHeadCell>
            <DrilldownHeadCell>{t("admin.drilldown.table.updated")}</DrilldownHeadCell>
            <DrilldownHeadCell align="right">{t("admin.drilldown.table.action")}</DrilldownHeadCell>
          </tr>
        </thead>
        <tbody>
          {drilldown.rows.map((row) => (
            <tr key={row.id} className="border-b border-border last:border-b-0">
              <td className="px-5 py-4">
                <MemberIdentity
                  initials={getInitials(row.contractorName)}
                  name={row.contractorName}
                  email={row.contractorEmail}
                />
              </td>
              <td className="px-5 py-4">
                <div className="flex items-start gap-2">
                  <CalendarDays className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {formatMonth(row.periodStart, locale)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateRange(row.periodStart, row.periodEnd, locale)}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-4">
                <StatusPill
                  status={toTimesheetPreviewStatus(row.status)}
                  label={t(`timesheetStatus.${toTimesheetStatusKey(row.status)}`)}
                />
              </td>
              <td className="px-5 py-4 text-sm font-semibold text-foreground">
                {formatHoursWithUnit(row.totalMinutes, locale)}
              </td>
              <td className="px-5 py-4 text-sm font-semibold text-foreground">
                {formatMoney(row.totalAmount, row.currencyCode, locale, {
                  display: "code",
                })}
              </td>
              <td className="px-5 py-4 text-sm text-muted-foreground">
                {formatNullableTimestamp(
                  row.submittedAt ?? row.approvedAt ?? row.rejectedAt,
                  locale,
                  t,
                )}
              </td>
              <td className="px-5 py-4 text-right">
                <Button asChild variant="soft" size="sm">
                  <Link href={`/admin/timesheets/${row.id}` as Route}>
                    <Eye className="size-4" aria-hidden="true" />
                    {t("admin.drilldown.review")}
                  </Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {drilldown.totalItems > drilldown.rows.length ? (
        <p className="border-t border-border px-5 py-3 text-sm text-muted-foreground">
          {t("admin.drilldown.limited", {
            shown: drilldown.rows.length,
            total: drilldown.totalItems,
          })}
        </p>
      ) : null}
    </div>
  );
}

function MissingTimesheetDrilldownTable({
  rows,
  period,
  locale,
  t,
}: {
  rows: AdminDashboardMissingTimesheetRow[];
  period: DashboardPeriod;
  locale: string;
  t: DashboardTranslator;
}) {
  if (rows.length === 0) {
    return <DashboardEmptyState>{t("admin.drilldown.empty")}</DashboardEmptyState>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] border-collapse">
        <thead>
          <tr className="border-b border-border bg-background/35">
            <DrilldownHeadCell>{t("admin.drilldown.table.contractor")}</DrilldownHeadCell>
            <DrilldownHeadCell>{t("admin.drilldown.table.activeProjects")}</DrilldownHeadCell>
            <DrilldownHeadCell>{t("admin.drilldown.table.hours")}</DrilldownHeadCell>
            <DrilldownHeadCell>{t("admin.drilldown.table.lastLogged")}</DrilldownHeadCell>
            <DrilldownHeadCell align="right">{t("admin.drilldown.table.action")}</DrilldownHeadCell>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.memberId} className="border-b border-border last:border-b-0">
              <td className="px-5 py-4">
                <MemberIdentity
                  initials={row.initials}
                  name={row.memberName}
                  email={row.memberEmail}
                />
              </td>
              <td className="px-5 py-4 text-sm font-semibold text-foreground">
                {t("admin.drilldown.activeProjectCount", {
                  count: row.activeProjectCount,
                })}
              </td>
              <td className="px-5 py-4 text-sm font-semibold text-foreground">
                {formatHoursWithUnit(row.monthMinutes, locale)}
              </td>
              <td className="px-5 py-4 text-sm text-muted-foreground">
                {row.lastLoggedDate
                  ? formatDate(row.lastLoggedDate, locale)
                  : t("admin.flagged.never")}
              </td>
              <td className="px-5 py-4 text-right">
                <Button asChild variant="soft" size="sm">
                  <Link href={buildMemberMonthReportHref(row.memberId, period) as Route}>
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                    {t("admin.drilldown.openReport")}
                  </Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlaggedUsersDrilldownTable({
  users,
  period,
  locale,
  t,
}: {
  users: DashboardFlaggedUser[];
  period: DashboardPeriod;
  locale: string;
  t: DashboardTranslator;
}) {
  if (users.length === 0) {
    return <DashboardEmptyState>{t("admin.drilldown.empty")}</DashboardEmptyState>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] border-collapse">
        <thead>
          <tr className="border-b border-border bg-background/35">
            <DrilldownHeadCell>{t("admin.flagged.name")}</DrilldownHeadCell>
            <DrilldownHeadCell>{t("admin.flagged.project")}</DrilldownHeadCell>
            <DrilldownHeadCell>{t("admin.flagged.lastLogged")}</DrilldownHeadCell>
            <DrilldownHeadCell align="right">{t("admin.drilldown.table.action")}</DrilldownHeadCell>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b border-border last:border-b-0">
              <td className="px-5 py-4">
                <MemberIdentity
                  initials={user.initials}
                  name={user.memberName}
                  email={user.memberEmail}
                />
              </td>
              <td className="px-5 py-4">
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: user.projectColor }}
                  />
                  <span className="truncate">{user.projectName}</span>
                </span>
              </td>
              <td className="px-5 py-4 text-sm text-muted-foreground">
                {user.lastLoggedDate
                  ? formatRelativeLoggedDate(user.lastLoggedDate, period.weekStart, locale, t)
                  : t("admin.flagged.never")}
              </td>
              <td className="px-5 py-4 text-right">
                <Button asChild variant="soft" size="sm">
                  <Link href={buildMemberProjectWeekReportHref(user, period) as Route}>
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                    {t("admin.drilldown.openReport")}
                  </Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MemberIdentity({
  initials,
  name,
  email,
}: {
  initials: string;
  name: string;
  email: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary-foreground font-ui text-xs font-bold">
        {initials}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">{email}</span>
      </span>
    </div>
  );
}

function DrilldownHeadCell({
  children,
  align = "left",
}: {
  children: string;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cn(
        "px-5 py-3 font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

function DashboardEmptyState({ children }: { children: string }) {
  return (
    <div className="p-5">
      <div className="rounded-[var(--radius-md)] border border-dashed border-border bg-secondary/45 px-5 py-8 text-center text-sm text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

function FlaggedUsersPanel({
  users,
  period,
  locale,
  t,
}: {
  users: DashboardFlaggedUser[];
  period: DashboardPeriod;
  locale: string;
  t: DashboardTranslator;
}) {
  return (
    <DashboardPanel className="overflow-hidden p-0">
      <div className="border-b border-border p-5">
        <p className="mb-3 font-ui text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
          {t("admin.flagged.title")}
        </p>
        <p className="max-w-[28rem] text-sm leading-6 text-muted-foreground">
          {t("admin.flagged.description")}
        </p>
      </div>
      {users.length === 0 ? (
        <div className="p-5 text-sm text-muted-foreground">{t("admin.flagged.empty")}</div>
      ) : (
        <div className="min-w-0 overflow-x-auto">
          <div className="grid min-w-[38rem] grid-cols-[1.35fr_1.1fr_auto] gap-4 border-b border-border px-5 py-3 font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            <span>{t("admin.flagged.name")}</span>
            <span>{t("admin.flagged.project")}</span>
            <span className="text-right">{t("admin.flagged.lastLogged")}</span>
          </div>
          {users.map((user, index) => (
            <div
              key={user.id}
              className={cn(
                "grid min-w-[38rem] grid-cols-[1.35fr_1.1fr_auto] items-center gap-4 px-5 py-3",
                index < users.length - 1 && "border-b border-border",
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary-foreground font-ui text-xs font-bold">
                  {user.initials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {user.memberName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {user.memberEmail}
                  </span>
                </span>
              </span>
              <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: user.projectColor }}
                />
                <span className="truncate">{user.projectName}</span>
              </span>
              <span
                className={cn(
                  "text-right text-sm",
                  user.lastLoggedDate ? "text-muted-foreground" : "font-semibold text-destructive",
                )}
              >
                {user.lastLoggedDate
                  ? formatRelativeLoggedDate(user.lastLoggedDate, period.weekStart, locale, t)
                  : t("admin.flagged.never")}
              </span>
            </div>
          ))}
          <div className="border-t border-border px-5 py-3">
            <Link
              href={"/dashboard?drilldown=flagged" as Route}
              className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent-strong"
            >
              {t("admin.flagged.viewDrilldown")}
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}
    </DashboardPanel>
  );
}

function StatusDistribution({
  segments,
  t,
}: {
  segments: AdminStatusSegment[];
  t: DashboardTranslator;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);

  return (
    <DashboardPanel className="p-6">
      <p className="mb-4 font-ui text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
        {t("admin.status.title")}
      </p>
      <div className="mb-5 flex items-baseline gap-2">
        <span className="font-display text-3xl font-semibold leading-none text-foreground">
          {total}
        </span>
        <span className="text-sm text-muted-foreground">{t("admin.status.caption")}</span>
      </div>
      <div className="mb-5 flex h-3.5 overflow-hidden rounded-full bg-secondary">
        {total > 0
          ? segments.map((segment) => (
              <span
                key={segment.id}
                style={{
                  width: `${Math.max(2, (segment.count / total) * 100)}%`,
                  backgroundColor: statusColor[segment.id],
                }}
                title={`${t(`admin.status.segment.${segment.id}`)}: ${segment.count}`}
              />
            ))
          : null}
      </div>
      <div className="grid gap-3">
        {segments.map((segment) => (
          <div key={segment.id} className="flex items-center gap-3">
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: statusColor[segment.id] }}
            />
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {t(`admin.status.segment.${segment.id}`)}
            </span>
            <span className="font-display text-sm font-semibold text-foreground">
              {segment.count}
            </span>
          </div>
        ))}
      </div>
    </DashboardPanel>
  );
}

function DashboardPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-border bg-card/85 shadow-panel",
        className,
      )}
      {...props}
    />
  );
}

function formatContractorAmount(
  dashboard: ContractorDashboardData,
  locale: string,
  t: DashboardTranslator,
) {
  if (dashboard.timesheet.mixedCurrency) return t("stats.mixedCurrency");
  if (dashboard.timesheet.missingRateLineCount > 0) return t("stats.missingRate");
  if (!dashboard.timesheet.totalAmount || !dashboard.timesheet.currencyCode)
    return t("stats.noAmount");
  return formatMoney(dashboard.timesheet.totalAmount, dashboard.timesheet.currencyCode, locale, {
    display: "code",
  });
}

function formatEmployeeCost(
  dashboard: EmployeeDashboardData,
  locale: string,
  t: DashboardTranslator,
) {
  if (dashboard.mixedCurrency) return t("stats.mixedCurrency");
  if (dashboard.costTotals.length === 0 && dashboard.missingRateLineCount > 0) {
    return t("stats.missingRate");
  }
  if (dashboard.costTotals.length === 0) return t("stats.noAmount");

  const [total] = dashboard.costTotals;
  return formatMoney(total.amount, total.currencyCode, locale, {
    display: "code",
  });
}

function formatEmployeeCostTotals(
  totals: EmployeeDashboardData["costTotals"],
  locale: string,
  t: DashboardTranslator,
) {
  if (totals.length === 0) return t("stats.noAmount");
  if (totals.length > 1) return t("stats.mixedCurrency");

  const [total] = totals;
  return formatMoney(total.amount, total.currencyCode, locale, {
    display: "code",
  });
}

function getStepperNodes(status: TimesheetPreviewStatus, t: DashboardTranslator) {
  const states = getStepperStates(status);

  return [
    { id: "create", label: t("contractor.stepper.create"), state: states.create },
    { id: "submit", label: t("contractor.stepper.submit"), state: states.submit },
    { id: "approve", label: t("contractor.stepper.approve"), state: states.approve },
    { id: "invoice", label: t("contractor.stepper.invoice"), state: states.invoice },
    { id: "paid", label: t("contractor.stepper.paid"), state: states.paid },
  ] as const;
}

function getStepperStates(status: TimesheetPreviewStatus) {
  if (status === "paid") {
    return {
      create: "done",
      submit: "done",
      approve: "done",
      invoice: "done",
      paid: "done",
    } as const;
  }

  if (status === "accepted") {
    return {
      create: "done",
      submit: "done",
      approve: "done",
      invoice: "done",
      paid: "active",
    } as const;
  }

  if (status === "invoiced" || status === "invoice_rejected") {
    return {
      create: "done",
      submit: "done",
      approve: "done",
      invoice: "active",
      paid: "disabled",
    } as const;
  }

  if (status === "approved") {
    return {
      create: "done",
      submit: "done",
      approve: "done",
      invoice: "active",
      paid: "disabled",
    } as const;
  }

  if (status === "submitted") {
    return {
      create: "done",
      submit: "done",
      approve: "active",
      invoice: "disabled",
      paid: "disabled",
    } as const;
  }

  return {
    create: "active",
    submit: "disabled",
    approve: "disabled",
    invoice: "disabled",
    paid: "disabled",
  } as const;
}

function formatTrend(current: number, previous: number) {
  if (previous <= 0 || current === previous) return null;
  const percent = Math.round(((current - previous) / previous) * 100);
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent}%`;
}

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatMonth(dateOnly: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateOnly}T00:00:00.000Z`));
}

function formatWeekRange(period: DashboardPeriod, locale: string) {
  const formatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return `${formatter.format(new Date(`${period.weekStart}T00:00:00.000Z`))} - ${formatter.format(
    new Date(`${period.weekEnd}T00:00:00.000Z`),
  )}`;
}

function formatRelativeLoggedDate(
  lastLoggedDate: string,
  weekStart: string,
  locale: string,
  t: DashboardTranslator,
) {
  const diffDays = Math.round(
    (new Date(`${weekStart}T00:00:00.000Z`).getTime() -
      new Date(`${lastLoggedDate}T00:00:00.000Z`).getTime()) /
      86_400_000,
  );

  if (diffDays <= 7) return t("admin.flagged.lastWeek");
  if (diffDays <= 14) return t("admin.flagged.twoWeeksAgo");

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${lastLoggedDate}T00:00:00.000Z`));
}

function formatDateRange(start: string, end: string, locale: string) {
  const formatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return `${formatter.format(new Date(`${start}T00:00:00.000Z`))} - ${formatter.format(
    new Date(`${end}T00:00:00.000Z`),
  )}`;
}

function formatDate(dateOnly: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateOnly}T00:00:00.000Z`));
}

function formatNullableTimestamp(timestamp: string | null, locale: string, t: DashboardTranslator) {
  if (!timestamp) return t("admin.drilldown.notAvailable");

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function toTimesheetStatusKey(status: string) {
  return status.toLowerCase() as TimesheetPreviewStatus;
}

function toTimesheetPreviewStatus(status: string): TimesheetPreviewStatus {
  return toTimesheetStatusKey(status);
}

function buildMemberMonthReportHref(memberId: string, period: DashboardPeriod) {
  const params = new URLSearchParams({
    period: "month",
    anchor: period.monthStart,
    member: memberId,
    view: "PROJECT",
  });

  return `/admin/reports?${params.toString()}`;
}

function buildMemberProjectWeekReportHref(user: DashboardFlaggedUser, period: DashboardPeriod) {
  const params = new URLSearchParams({
    period: "week",
    anchor: period.weekStart,
    member: user.memberId,
    project: user.projectId,
    view: "USER",
  });

  return `/admin/reports?${params.toString()}`;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getGivenName(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.at(-1) ?? name;
}
