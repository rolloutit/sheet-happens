"use client";

import { CalendarDays, FolderKanban, Users, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/src/components/ui/Button";
import { Combobox } from "@/src/components/ui/Combobox";
import { DatePicker } from "@/src/components/ui/DatePicker";
import { Input } from "@/src/components/ui/Input";
import { MonthPicker } from "@/src/components/ui/MonthPicker";
import { usePickerLabels } from "@/src/i18n/picker-labels";
import type { ReportFilterOption } from "@/src/server/reports";

export type ReportPeriodMode = "month" | "week" | "day" | "year" | "custom";
export type ReportViewMode = "USER" | "PROJECT";

export type ReportFiltersBarProps = {
  period: ReportPeriodMode;
  view: ReportViewMode;
  /** `YYYY-MM-DD`, already normalized for the active period. */
  anchor: string;
  periodStart: string;
  periodEnd: string;
  periodSummary: string;
  projectIds: readonly string[];
  groupIds: readonly string[];
  memberIds: readonly string[];
  projects: readonly ReportFilterOption[];
  projectGroups: readonly ReportFilterOption[];
  members: readonly ReportFilterOption[];
  /**
   * Precomputed on the server so `typedRoutes` stays satisfied and the href-building logic
   * (which reads the snapshot) does not have to cross the client boundary.
   */
  periodHrefs: Record<ReportPeriodMode, string>;
  viewHrefs: Record<ReportViewMode, string>;
};

const periodModes = ["month", "week", "day", "year", "custom"] as const;

function toOptions(options: readonly ReportFilterOption[]) {
  return options.map((option) => ({
    value: option.value,
    label: option.label,
    // The caption used to be parenthesised into the label; as meta it stays searchable
    // while the trigger shows just the name.
    meta: option.caption ?? undefined,
  }));
}

/**
 * The report period, scope and view controls.
 *
 * Extracted from the page for Radix and cmdk; the page stays a Server Component and this is
 * still a plain GET `<form>` posting to `/admin/reports`. Period and view switching stay
 * `<Link>` navigations, which is what makes them discard unsubmitted edits exactly as before.
 *
 * The anchor and the custom start/end are mutually exclusive and stay conditionally
 * rendered. Mounting the hidden ones would add `start=&end=` to every non-custom URL —
 * harmless to the parser, but it changes shareable URLs on a financial-reporting screen.
 */
export function ReportFiltersBar({
  period,
  view,
  anchor,
  periodStart,
  periodEnd,
  periodSummary,
  projectIds,
  groupIds,
  memberIds,
  projects,
  projectGroups,
  members,
  periodHrefs,
  viewHrefs,
}: ReportFiltersBarProps) {
  const t = useTranslations("AdminReports");
  const locale = useLocale();
  const pickerLabels = usePickerLabels();

  const scopeFilters = [
    {
      name: "project",
      values: projectIds,
      options: projects,
      label: t("filters.project"),
      allLabel: t("filters.projectAll"),
    },
    {
      name: "group",
      values: groupIds,
      options: projectGroups,
      label: t("filters.group"),
      allLabel: t("filters.groupAll"),
    },
    {
      name: "member",
      values: memberIds,
      options: members,
      label: t("filters.member"),
      allLabel: t("filters.memberAll"),
    },
  ];

  return (
    <form
      className="rounded-[var(--radius-lg)] border border-border bg-card px-4 py-4 shadow-soft"
      action="/admin/reports"
    >
      <input type="hidden" name="period" value={period} />
      <input type="hidden" name="view" value={view} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-[var(--radius-pill)] bg-secondary p-1">
          {periodModes.map((mode) => (
            <Link
              key={mode}
              href={periodHrefs[mode] as Route}
              className={`inline-flex h-9 items-center rounded-[var(--radius-pill)] px-4 font-body text-sm font-semibold transition ${
                period === mode
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`period.${mode}`)}
            </Link>
          ))}
        </div>

        <PeriodAnchor
          period={period}
          anchor={anchor}
          periodStart={periodStart}
          periodEnd={periodEnd}
          locale={locale}
          labels={pickerLabels}
          t={t}
        />

        <div className="hidden h-10 w-px bg-border lg:block" />

        {scopeFilters.map((filter) => (
          <Combobox
            multiple
            key={filter.name}
            id={`report-${filter.name}`}
            name={filter.name}
            label={filter.label}
            // No "all …" option to carry: an empty selection already is that state, so the
            // label becomes the placeholder.
            placeholder={filter.allLabel}
            defaultValue={filter.values}
            labels={pickerLabels.combobox}
            className="w-full sm:w-[15rem]"
            options={toOptions(filter.options)}
          />
        ))}

        <div className="ml-auto inline-flex rounded-[var(--radius-pill)] border border-border bg-secondary p-1">
          <ViewLink
            href={viewHrefs.USER}
            active={view === "USER"}
            icon={<Users className="size-4" aria-hidden />}
            label={t("views.user")}
          />
          <ViewLink
            href={viewHrefs.PROJECT}
            active={view === "PROJECT"}
            icon={<FolderKanban className="size-4" aria-hidden />}
            label={t("views.project")}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="size-4 text-accent" aria-hidden />
          {periodSummary}
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

/**
 * One control per period mode, replacing the single input that used to switch its own
 * `type` between `month`, `number` and `date`.
 *
 * The year branch stays a native number input: a year is not a date, there is no YearPicker,
 * and a Select over a generated range would silently narrow the free 2000-2100 span the
 * field has today.
 */
function PeriodAnchor({
  period,
  anchor,
  periodStart,
  periodEnd,
  locale,
  labels,
  t,
}: {
  period: ReportPeriodMode;
  anchor: string;
  periodStart: string;
  periodEnd: string;
  locale: string;
  labels: ReturnType<typeof usePickerLabels>;
  t: ReturnType<typeof useTranslations<"AdminReports">>;
}) {
  if (period === "custom") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <DatePicker
          id="report-start"
          name="start"
          label={t("filters.periodStart")}
          locale={locale}
          defaultValue={periodStart}
          labels={labels.date}
          className="w-[10.75rem]"
        />
        <span className="text-muted-foreground">-</span>
        <DatePicker
          id="report-end"
          name="end"
          label={t("filters.periodEnd")}
          locale={locale}
          defaultValue={periodEnd}
          labels={labels.date}
          className="w-[10.75rem]"
        />
      </div>
    );
  }

  if (period === "month") {
    return (
      <MonthPicker
        id="report-anchor"
        name="anchor"
        label={t("filters.anchorMonth")}
        locale={locale}
        defaultValue={anchor.slice(0, 7)}
        labels={labels.month}
        className="w-[10.75rem]"
      />
    );
  }

  if (period === "year") {
    return (
      <Input
        id="report-anchor"
        name="anchor"
        type="number"
        aria-label={t("filters.anchorYear")}
        defaultValue={anchor.slice(0, 4)}
        min="2000"
        max="2100"
        className="h-11 w-[10.75rem]"
      />
    );
  }

  return (
    <DatePicker
      id="report-anchor"
      name="anchor"
      label={t("filters.anchorDate")}
      locale={locale}
      defaultValue={anchor}
      labels={labels.date}
      className="w-[10.75rem]"
    />
  );
}

function ViewLink({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href as Route}
      className={`inline-flex h-9 items-center gap-2 rounded-[var(--radius-pill)] px-4 font-body text-sm font-semibold transition ${
        active
          ? "bg-primary text-primary-foreground shadow-soft"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}
