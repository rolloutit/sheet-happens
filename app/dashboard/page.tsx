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
  Plus,
  Timer,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { HTMLAttributes } from "react";

import { AppShell } from "@/src/components/layout/AppShell";
import { StatusPill, statusTone, statusToneVar } from "@/src/components/sheet/StatusPill";
import { TimesheetStepper } from "@/src/components/sheet/TimesheetStepper";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { DataTable } from "@/src/components/ui/Table";
import { formatHoursWithUnit, formatMoney, type DurationDisplayFormat } from "@/src/lib/formatting";
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
import { FlaggedReminderButton } from "./FlaggedReminderButton";

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

// Both maps used to be hand-picked hex literals and they disagreed with the pill and with
// themselves: `accepted` and `paid` were one green, `rejected` and `missing` one rose, `submitted`
// was amber here and mint in the table. They were also dark-theme values hardcoded into inline
// styles, so light mode got dark mode's palette. Reading `statusTone` gives one colour per status,
// the same one the pill uses, and `var()` follows the theme.
const priorityAccent: Record<AdminPriorityMetric["id"], string> = {
  submitted: statusToneVar[statusTone.submitted],
  approved: statusToneVar[statusTone.approved],
  invoiced: statusToneVar[statusTone.invoiced],
  accepted: statusToneVar[statusTone.accepted],
  missing: statusToneVar[statusTone.missing],
};

// The dashboard panel is a summary, not the list: `getFlaggedUsers` returns every flagged
// member/project pair, which grows with the org and once pushed the rest of the page below the
// fold. The `?drilldown=flagged` view already renders all of them.
const flaggedPreviewLimit = 8;

// `DataTable` brings its own card chrome. Inside a `DashboardPanel` that would double the border
// and the corner radius, so it renders flush and the panel keeps the outline. The header above it
// already draws the separating hairline.
const flushPanelTableClassName = "rounded-none border-0 bg-transparent";

const statusColor: Record<AdminStatusSegment["id"], string> = {
  submitted: statusToneVar[statusTone.submitted],
  rejected: statusToneVar[statusTone.rejected],
  approved: statusToneVar[statusTone.approved],
  invoiced: statusToneVar[statusTone.invoiced],
  invoice_rejected: statusToneVar[statusTone.invoice_rejected],
  accepted: statusToneVar[statusTone.accepted],
  paid: statusToneVar[statusTone.paid],
  missing: statusToneVar[statusTone.missing],
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
      {/*
       * Wider than the reading-width default from `xl` up, matching `/time` and the admin
       * surfaces (`max-w-[92rem]`). This is a table-and-metric surface, not prose: at 73.75rem
       * the flagged-users table cannot lay out its four columns without scrolling sideways while
       * a third of a large display sits empty. The cap stays, so a 4K panel does not stretch a
       * row into an unreadable sweep.
       */}
      <section className="mx-auto grid w-full max-w-[73.75rem] gap-4 px-4 py-8 sm:px-6 lg:px-8 xl:max-w-[92rem]">
        {dashboard.kind === "admin" ? (
          <AdminDashboard
            dashboard={dashboard}
            locale={locale}
            durationDisplayFormat={member.durationDisplayFormat}
            t={t}
          />
        ) : dashboard.kind === "contractor" ? (
          <ContractorDashboard
            dashboard={dashboard}
            locale={locale}
            durationDisplayFormat={member.durationDisplayFormat}
            t={t}
          />
        ) : (
          <EmployeeDashboard
            dashboard={dashboard}
            locale={locale}
            durationDisplayFormat={member.durationDisplayFormat}
            t={t}
          />
        )}
      </section>
    </AppShell>
  );
}

function EmployeeDashboard({
  dashboard,
  locale,
  durationDisplayFormat,
  t,
}: {
  dashboard: EmployeeDashboardData;
  locale: string;
  durationDisplayFormat: DurationDisplayFormat;
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
      <MemberStats
        dashboard={dashboard}
        locale={locale}
        durationDisplayFormat={durationDisplayFormat}
        t={t}
      />
      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.9fr]">
        <EmployeeProjectBreakdown
          dashboard={dashboard}
          locale={locale}
          durationDisplayFormat={durationDisplayFormat}
          t={t}
        />
        <EmployeeMonthStatusPanel
          dashboard={dashboard}
          locale={locale}
          durationDisplayFormat={durationDisplayFormat}
          t={t}
        />
      </div>
      <WeeklyChecklist projects={dashboard.weeklyProjects} t={t} />
    </>
  );
}

function ContractorDashboard({
  dashboard,
  locale,
  durationDisplayFormat,
  t,
}: {
  dashboard: ContractorDashboardData;
  locale: string;
  durationDisplayFormat: DurationDisplayFormat;
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
      <MemberStats
        dashboard={dashboard}
        locale={locale}
        durationDisplayFormat={durationDisplayFormat}
        t={t}
      />
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
  durationDisplayFormat,
  t,
}: {
  dashboard: AdminDashboardData;
  locale: string;
  durationDisplayFormat: DurationDisplayFormat;
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
      {/* Five metrics divide evenly at no breakpoint below `xl`, so two columns is the mobile
          shape: it keeps the counts legible without turning the row into five full-width blocks
          that push everything else off the first screen. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
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
          durationDisplayFormat={durationDisplayFormat}
          t={t}
        />
      ) : null}
      {/* Stacked rather than sharing a row. The status breakdown is one bar plus a wrapping
          legend, so it reads fine as a short full-width strip, and the flagged table gets the
          width its four columns need — in the old 1.5fr/1fr split it scrolled sideways at every
          viewport size, including a 2000px one. */}
      <StatusDistribution segments={dashboard.statusSegments} t={t} />
      <FlaggedUsersPanel
        users={dashboard.flaggedUsers}
        period={dashboard.period}
        locale={locale}
        t={t}
      />
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
        {t("greeting", { name })}
      </h1>
      <p className="mt-3 text-base text-muted-foreground">{subtitle}</p>
    </header>
  );
}

function MemberStats({
  dashboard,
  locale,
  durationDisplayFormat,
  t,
}: {
  dashboard: EmployeeDashboardData | ContractorDashboardData;
  locale: string;
  durationDisplayFormat: DurationDisplayFormat;
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
      value: formatHoursWithUnit(dashboard.monthMinutes, locale, durationDisplayFormat),
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
  durationDisplayFormat,
  t,
}: {
  dashboard: EmployeeDashboardData;
  locale: string;
  durationDisplayFormat: DurationDisplayFormat;
  t: DashboardTranslator;
}) {
  const caption = t("member.projectBreakdown.heading");

  return (
    <DashboardPanel className="overflow-hidden p-0">
      <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-3 font-ui text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
            {t("member.projectBreakdown.title")}
          </p>
          <h2 className="font-display text-lg font-medium text-foreground">{caption}</h2>
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
        <DataTable
          className={flushPanelTableClassName}
          displayMode="responsive"
          caption={caption}
          aria-label={caption}
          rows={dashboard.projectBreakdown}
          getRowKey={(row) => row.projectId}
          columns={[
            {
              id: "project",
              header: t("member.projectBreakdown.table.project"),
              mobileLabel: null,
              cell: (row) => <ProjectLabel color={row.projectColor} name={row.projectName} />,
            },
            {
              id: "hours",
              header: t("member.projectBreakdown.table.hours"),
              cell: (row) => (
                <span className="text-sm font-semibold text-foreground">
                  {formatHoursWithUnit(row.totalMinutes, locale, durationDisplayFormat)}
                </span>
              ),
            },
            {
              id: "rate",
              header: t("member.projectBreakdown.table.rate"),
              cell: (row) => (
                <EmployeeRateLabel
                  singleRate={row.singleRate}
                  mixedRates={row.mixedRates}
                  missingRateLineCount={row.missingRateLineCount}
                  locale={locale}
                  t={t}
                />
              ),
            },
            {
              id: "cost",
              header: t("member.projectBreakdown.table.cost"),
              cell: (row) => (
                <span className="text-sm font-semibold text-foreground">
                  {formatEmployeeCostTotals(row.costTotals, locale, t)}
                  {row.missingRateLineCount > 0 ? (
                    <span className="mt-1 block text-xs font-medium text-warning">
                      {t("member.projectBreakdown.missingRates", {
                        count: row.missingRateLineCount,
                      })}
                    </span>
                  ) : null}
                </span>
              ),
            },
            {
              id: "entries",
              header: t("member.projectBreakdown.table.entries"),
              align: "right",
              cell: (row) => row.entryCount,
            },
          ]}
        />
      )}
    </DashboardPanel>
  );
}

function EmployeeMonthStatusPanel({
  dashboard,
  locale,
  durationDisplayFormat,
  t,
}: {
  dashboard: EmployeeDashboardData;
  locale: string;
  durationDisplayFormat: DurationDisplayFormat;
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
          value={formatHoursWithUnit(dashboard.averageWeekMinutes, locale, durationDisplayFormat)}
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
      <TimesheetStepper
        status={dashboard.timesheet.status}
        aria-label={t("contractor.stepperAriaLabel")}
        labels={{
          created: t("contractor.stepper.create"),
          submitted: t("contractor.stepper.submit"),
          approved: t("contractor.stepper.approve"),
          invoiced: t("contractor.stepper.invoice"),
          paid: t("contractor.stepper.paid"),
        }}
        lockedDescriptions={{
          submitted: t("contractor.stepperLocked.submit"),
          approved: t("contractor.stepperLocked.approve"),
          invoiced: t("contractor.stepperLocked.invoice"),
          paid: t("contractor.stepperLocked.paid"),
        }}
      />
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
    // Five cards never divide evenly into two or three columns, so the last one takes the empty
    // cell rather than leaving a half-width gap. At `xl` all five sit in one row and it resets.
    <Link href={metric.href as Route} className="block min-w-0 last:col-span-2 xl:last:col-span-1">
      <DashboardPanel
        className={cn(
          "grid h-full content-between gap-3 p-4 transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-pop sm:gap-4 sm:p-5",
          active && "border-accent bg-accent-soft/40",
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <span
            className="flex size-9 items-center justify-center rounded-[var(--radius-md)]"
            style={{
              backgroundColor: `color-mix(in srgb, ${accent} 13%, transparent)`,
              color: accent,
            }}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <div>
          <p className="font-display text-[28px] font-semibold leading-none tracking-[-0.02em] text-foreground sm:text-3xl">
            {metric.count}
          </p>
          <p className="mt-2 text-[13px] font-medium leading-snug text-muted-foreground sm:text-sm">
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
  durationDisplayFormat,
  t,
}: {
  drilldown: AdminDashboardDrilldown;
  period: DashboardPeriod;
  locale: string;
  durationDisplayFormat: DurationDisplayFormat;
  t: DashboardTranslator;
}) {
  // Doubles as the table's accessible name, so the caption says which queue is on screen instead
  // of a generic "drilldown table".
  const caption = t(`admin.drilldown.${drilldown.id}.title`, {
    count: drilldown.totalItems,
  });

  return (
    <DashboardPanel className="overflow-hidden p-0">
      <div className="flex flex-col gap-4 border-b border-border p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-3 font-ui text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
            {t("admin.drilldown.eyebrow")}
          </p>
          <h2 className="font-display text-2xl font-semibold leading-tight text-foreground">
            {caption}
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
        <TimesheetDrilldownTable
          drilldown={drilldown}
          caption={caption}
          locale={locale}
          durationDisplayFormat={durationDisplayFormat}
          t={t}
        />
      ) : drilldown.kind === "missing" ? (
        <MissingTimesheetDrilldownTable
          rows={drilldown.rows}
          caption={caption}
          period={period}
          locale={locale}
          durationDisplayFormat={durationDisplayFormat}
          t={t}
        />
      ) : (
        <FlaggedUsersDrilldownTable
          users={drilldown.rows}
          caption={caption}
          period={period}
          locale={locale}
          t={t}
        />
      )}
    </DashboardPanel>
  );
}

function TimesheetDrilldownTable({
  drilldown,
  caption,
  locale,
  durationDisplayFormat,
  t,
}: {
  drilldown: Extract<AdminDashboardDrilldown, { kind: "timesheets" }>;
  caption: string;
  locale: string;
  durationDisplayFormat: DurationDisplayFormat;
  t: DashboardTranslator;
}) {
  if (drilldown.rows.length === 0) {
    return <DashboardEmptyState>{t("admin.drilldown.empty")}</DashboardEmptyState>;
  }

  return (
    <>
      <DataTable
        className={flushPanelTableClassName}
        displayMode="responsive"
        caption={caption}
        aria-label={caption}
        rows={drilldown.rows}
        getRowKey={(row) => row.id}
        columns={[
          {
            id: "contractor",
            header: t("admin.drilldown.table.contractor"),
            mobileLabel: null,
            cell: (row) => (
              <MemberIdentity
                initials={getInitials(row.contractorName)}
                name={row.contractorName}
                email={row.contractorEmail}
              />
            ),
          },
          {
            id: "month",
            header: t("admin.drilldown.table.month"),
            cell: (row) => (
              <span className="flex items-start gap-2">
                <CalendarDays
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span>
                  <span className="block text-sm font-semibold text-foreground">
                    {formatMonth(row.periodStart, locale)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {formatDateRange(row.periodStart, row.periodEnd, locale)}
                  </span>
                </span>
              </span>
            ),
          },
          {
            id: "status",
            header: t("admin.drilldown.table.status"),
            cell: (row) => (
              <StatusPill
                status={toTimesheetPreviewStatus(row.status)}
                label={t(`timesheetStatus.${toTimesheetStatusKey(row.status)}`)}
              />
            ),
          },
          {
            id: "hours",
            header: t("admin.drilldown.table.hours"),
            cell: (row) => (
              <span className="text-sm font-semibold text-foreground">
                {formatHoursWithUnit(row.totalMinutes, locale, durationDisplayFormat)}
              </span>
            ),
          },
          {
            id: "amount",
            header: t("admin.drilldown.table.amount"),
            cell: (row) => (
              <span className="text-sm font-semibold text-foreground">
                {formatMoney(row.totalAmount, row.currencyCode, locale, {
                  display: "code",
                })}
              </span>
            ),
          },
          {
            id: "updated",
            header: t("admin.drilldown.table.updated"),
            cell: (row) =>
              formatNullableTimestamp(
                row.submittedAt ?? row.approvedAt ?? row.rejectedAt,
                locale,
                t,
              ),
          },
          {
            id: "action",
            header: t("admin.drilldown.table.action"),
            mobileLabel: null,
            align: "right",
            cell: (row) => (
              <span className="flex justify-end">
                <Button asChild variant="soft" size="sm">
                  <Link href={`/admin/timesheets/${row.id}` as Route}>
                    <Eye className="size-4" aria-hidden="true" />
                    {t("admin.drilldown.review")}
                  </Link>
                </Button>
              </span>
            ),
          },
        ]}
      />
      {drilldown.totalItems > drilldown.rows.length ? (
        <p className="border-t border-border px-5 py-3 text-sm text-muted-foreground">
          {t("admin.drilldown.limited", {
            shown: drilldown.rows.length,
            total: drilldown.totalItems,
          })}
        </p>
      ) : null}
    </>
  );
}

function MissingTimesheetDrilldownTable({
  rows,
  caption,
  period,
  locale,
  durationDisplayFormat,
  t,
}: {
  rows: AdminDashboardMissingTimesheetRow[];
  caption: string;
  period: DashboardPeriod;
  locale: string;
  durationDisplayFormat: DurationDisplayFormat;
  t: DashboardTranslator;
}) {
  if (rows.length === 0) {
    return <DashboardEmptyState>{t("admin.drilldown.empty")}</DashboardEmptyState>;
  }

  return (
    <DataTable
      className={flushPanelTableClassName}
      displayMode="responsive"
      caption={caption}
      aria-label={caption}
      rows={rows}
      getRowKey={(row) => row.memberId}
      columns={[
        {
          id: "contractor",
          header: t("admin.drilldown.table.contractor"),
          mobileLabel: null,
          cell: (row) => (
            <MemberIdentity initials={row.initials} name={row.memberName} email={row.memberEmail} />
          ),
        },
        {
          id: "activeProjects",
          header: t("admin.drilldown.table.activeProjects"),
          cell: (row) => (
            <span className="text-sm font-semibold text-foreground">
              {t("admin.drilldown.activeProjectCount", { count: row.activeProjectCount })}
            </span>
          ),
        },
        {
          id: "hours",
          header: t("admin.drilldown.table.hours"),
          cell: (row) => (
            <span className="text-sm font-semibold text-foreground">
              {formatHoursWithUnit(row.monthMinutes, locale, durationDisplayFormat)}
            </span>
          ),
        },
        {
          id: "lastLogged",
          header: t("admin.drilldown.table.lastLogged"),
          cell: (row) =>
            row.lastLoggedDate ? formatDate(row.lastLoggedDate, locale) : t("admin.flagged.never"),
        },
        {
          id: "action",
          header: t("admin.drilldown.table.action"),
          mobileLabel: null,
          align: "right",
          cell: (row) => (
            <span className="flex justify-end">
              <Button asChild variant="soft" size="sm">
                <Link href={buildMemberMonthReportHref(row.memberId, period) as Route}>
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                  {t("admin.drilldown.openReport")}
                </Link>
              </Button>
            </span>
          ),
        },
      ]}
    />
  );
}

function FlaggedUsersDrilldownTable({
  users,
  caption,
  period,
  locale,
  t,
}: {
  users: DashboardFlaggedUser[];
  caption: string;
  period: DashboardPeriod;
  locale: string;
  t: DashboardTranslator;
}) {
  if (users.length === 0) {
    return <DashboardEmptyState>{t("admin.drilldown.empty")}</DashboardEmptyState>;
  }

  return (
    <DataTable
      className={flushPanelTableClassName}
      displayMode="responsive"
      caption={caption}
      aria-label={caption}
      rows={users}
      getRowKey={(row) => row.id}
      columns={[
        {
          id: "member",
          header: t("admin.flagged.name"),
          mobileLabel: null,
          cell: (row) => (
            <MemberIdentity initials={row.initials} name={row.memberName} email={row.memberEmail} />
          ),
        },
        {
          id: "project",
          header: t("admin.flagged.project"),
          cell: (row) => <ProjectLabel color={row.projectColor} name={row.projectName} />,
        },
        {
          id: "lastLogged",
          header: t("admin.flagged.lastLogged"),
          cell: (row) => (
            <LastLoggedLabel
              lastLoggedDate={row.lastLoggedDate}
              weekStart={period.weekStart}
              locale={locale}
              t={t}
            />
          ),
        },
        {
          id: "action",
          header: t("admin.drilldown.table.action"),
          mobileLabel: null,
          align: "right",
          cell: (row) => (
            <span className="flex flex-wrap justify-end gap-2">
              <FlaggedReminderButton memberId={row.memberId} weekStart={period.weekStart} />
              <Button asChild variant="soft" size="sm">
                <Link href={buildMemberProjectWeekReportHref(row, period) as Route}>
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                  {t("admin.drilldown.openReport")}
                </Link>
              </Button>
            </span>
          ),
        },
      ]}
    />
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
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-primary-foreground font-ui text-xs font-bold">
        {initials}
      </span>
      {/* The `md` cap is what makes the ellipsis work, and it is not decoration. An auto-layout
          table takes its minimum width from cell content, and `truncate` implies `nowrap`, so
          `contractor@example.com` set this column's floor and forced the whole table to scroll
          sideways — the ellipsis never appeared. Capping the box caps that floor. It starts at
          `md` because that is where `DataTable` switches from cards to a table; in a card the row
          has the full width and nothing needs shortening. */}
      <span className="min-w-0 md:max-w-[11rem]">
        <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">{email}</span>
      </span>
    </span>
  );
}

function ProjectLabel({ color, name }: { color: string; name: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {/* Wraps rather than truncates, for the same reason as the address above: a name like
          "Internal Ops & Tooling" held the column open at its full nowrap width. */}
      <span className="min-w-0 break-words">{name}</span>
    </span>
  );
}

function LastLoggedLabel({
  lastLoggedDate,
  weekStart,
  locale,
  t,
}: {
  lastLoggedDate: string | null;
  weekStart: string;
  locale: string;
  t: DashboardTranslator;
}) {
  if (!lastLoggedDate) {
    return (
      <span className="text-sm font-semibold text-destructive">{t("admin.flagged.never")}</span>
    );
  }

  // Nowrap so "Last week" does not break across two lines at the `md` boundary, where the table
  // first appears and the columns are at their tightest.
  return (
    <span className="whitespace-nowrap text-sm text-muted-foreground">
      {formatRelativeLoggedDate(lastLoggedDate, weekStart, locale, t)}
    </span>
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
  const visible = users.slice(0, flaggedPreviewLimit);
  const truncated = users.length > visible.length;

  return (
    <DashboardPanel className="overflow-hidden p-0">
      <div className="border-b border-border p-5">
        <p className="mb-3 font-ui text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
          {t("admin.flagged.title")}
        </p>
        <p className="max-w-[44rem] text-sm leading-6 text-muted-foreground">
          {t("admin.flagged.description")}
        </p>
      </div>
      {users.length === 0 ? (
        <div className="p-5 text-sm text-muted-foreground">{t("admin.flagged.empty")}</div>
      ) : (
        <>
          <DataTable
            className={flushPanelTableClassName}
            displayMode="responsive"
            caption={t("admin.flagged.title")}
            aria-label={t("admin.flagged.title")}
            rows={visible}
            getRowKey={(row) => row.id}
            columns={[
              {
                id: "member",
                header: t("admin.flagged.name"),
                mobileLabel: null,
                cell: (row) => (
                  <MemberIdentity
                    initials={row.initials}
                    name={row.memberName}
                    email={row.memberEmail}
                  />
                ),
              },
              {
                id: "project",
                header: t("admin.flagged.project"),
                cell: (row) => <ProjectLabel color={row.projectColor} name={row.projectName} />,
              },
              {
                id: "lastLogged",
                header: t("admin.flagged.lastLogged"),
                cell: (row) => (
                  <LastLoggedLabel
                    lastLoggedDate={row.lastLoggedDate}
                    weekStart={period.weekStart}
                    locale={locale}
                    t={t}
                  />
                ),
              },
              {
                id: "action",
                header: t("admin.drilldown.table.action"),
                mobileLabel: null,
                align: "right",
                cell: (row) => (
                  <span className="flex justify-end">
                    <FlaggedReminderButton memberId={row.memberId} weekStart={period.weekStart} />
                  </span>
                ),
              },
            ]}
          />
          <div className="border-t border-border px-5 py-3">
            <Link
              href={"/dashboard?drilldown=flagged" as Route}
              className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent-strong"
            >
              {truncated
                ? t("admin.flagged.viewAll", { count: users.length })
                : t("admin.flagged.viewDrilldown")}
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </>
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
  // Zero-count segments used to be drawn at `Math.max(2, …)%`, so an all-missing month showed
  // five coloured slivers for states that held nothing. A segment with no timesheets in it has no
  // width; the legend below is what reports the zero.
  const filled = segments.filter((segment) => segment.count > 0);

  return (
    <DashboardPanel className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <p className="font-ui text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
          {t("admin.status.title")}
        </p>
        <p className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold leading-none text-foreground">
            {total}
          </span>
          <span className="text-sm text-muted-foreground">{t("admin.status.caption")}</span>
        </p>
      </div>
      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-secondary">
        {filled.map((segment) => (
          <span
            key={segment.id}
            style={{
              width: `${(segment.count / total) * 100}%`,
              backgroundColor: statusColor[segment.id],
            }}
            title={`${t(`admin.status.segment.${segment.id}`)}: ${segment.count}`}
          />
        ))}
      </div>
      {/* The legend was a stacked column of eight rows, which made a strip of information as tall
          as the table beside it. Two columns on a phone, one wrapping row from `sm` up. */}
      <ul className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2 sm:flex sm:flex-wrap sm:gap-x-6">
        {segments.map((segment) => {
          const empty = segment.count === 0;

          return (
            <li key={segment.id} className="flex min-w-0 items-center gap-2 text-sm">
              <span
                className={cn("size-2 shrink-0 rounded-full", empty && "opacity-40")}
                style={{ backgroundColor: statusColor[segment.id] }}
              />
              <span
                className={cn(
                  "min-w-0 leading-tight",
                  empty ? "text-subtle-foreground" : "text-muted-foreground",
                )}
              >
                {t(`admin.status.segment.${segment.id}`)}
              </span>
              <span
                className={cn(
                  "shrink-0 font-display text-sm font-semibold",
                  empty ? "text-subtle-foreground" : "text-foreground",
                )}
              >
                {segment.count}
              </span>
            </li>
          );
        })}
      </ul>
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
