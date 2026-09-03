"use client";

import { Filter, Search } from "lucide-react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { FilterChips } from "@/src/components/sheet/FilterChips";
import type { FilterChip } from "@/src/components/sheet/FilterChips";
import { Button } from "@/src/components/ui/Button";
import { Checkbox } from "@/src/components/ui/Checkbox";
import { Combobox } from "@/src/components/ui/Combobox";
import { Input } from "@/src/components/ui/Input";
import { MonthPicker } from "@/src/components/ui/MonthPicker";
import { Select } from "@/src/components/ui/Select";
import { usePickerLabels } from "@/src/i18n/picker-labels";
import { formatMonthLabel } from "@/src/lib/formatting";
import { deleteSearchParamValue } from "@/src/lib/search-params";

/** The statuses an admin can filter by, in review order. */
const filterableStatuses = [
  "SUBMITTED",
  "REJECTED",
  "APPROVED",
  "ACCEPTED",
  "INVOICED",
  "INVOICE_REJECTED",
  "PAID",
] as const;

/** The query-string names, which are also the `<form>` control names. */
type FilterKey = "q" | "status" | "contractor" | "project" | "month" | "includePaid";

export type TimesheetFilterBarProps = {
  query: string;
  statuses: readonly string[];
  contractorMemberIds: readonly string[];
  projectIds: readonly string[];
  /** `YYYY-MM`. */
  month: string;
  /** Whether paid timesheets are listed. Off by default; see the checkbox below. */
  includePaid: boolean;
  contractorOptions: readonly { value: string; label: string; email?: string | null }[];
  projectOptions: readonly { value: string; label: string }[];
};

/**
 * The timesheet list filters.
 *
 * Extracted from the page because Radix and cmdk need a client component, while the page
 * itself stays a Server Component. This is still a plain GET `<form>` submitting to
 * `/admin/timesheets` — the URL remains the state, and every control carries the same
 * `name` the native ones did, so the server-side parser is untouched.
 *
 * One toolbar row rather than a titled card of labelled fields: this sits above the list a
 * reviewer came to read, and five filters do not need a heading to explain themselves. The
 * labels move onto the controls as accessible names, and whatever is actually filtering the
 * list shows up as a chip you can take off in one click — which is the part a hidden
 * "more filters" popover would have taken away.
 *
 * Status, contractor and project accept several values, so each contributes one chip per
 * value and the whole filter reads as a union: the review queue is `SUBMITTED` **or**
 * `REJECTED` in one URL rather than two.
 *
 * The paid checkbox is the one filter that is applied without being asked for: the list
 * leaves paid timesheets out until it is ticked, so it carries a chip like the rest to keep
 * the row an honest account of what the list is showing.
 */
export function TimesheetFilterBar({
  query,
  statuses,
  contractorMemberIds,
  projectIds,
  month,
  includePaid,
  contractorOptions,
  projectOptions,
}: TimesheetFilterBarProps) {
  const t = useTranslations("AdminTimesheets");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pickerLabels = usePickerLabels();

  /**
   * Drops one filter, or — when `value` is given — one value of a multi-select filter,
   * leaving that filter's other values applied. Built from the live query string rather
   * than from the applied filters, so unrelated parameters survive the click.
   */
  function hrefWithout(key: FilterKey, value?: string) {
    const params = new URLSearchParams(searchParams.toString());

    deleteSearchParamValue(params, key, value);
    // Fewer filters means a different list, so the old page number no longer points at
    // anything in particular.
    params.delete("page");

    const search = params.toString();

    return (search ? `/admin/timesheets?${search}` : "/admin/timesheets") as Route;
  }

  const appliedFilterKey = [
    query,
    statuses,
    contractorMemberIds,
    projectIds,
    month,
    includePaid,
  ].join("|");
  const activeFilters: FilterChip<FilterKey>[] = [];

  if (query) {
    activeFilters.push({
      id: "q",
      label: query,
      aria: `${t("filters.search")}: ${query}`,
      leading: <Search className="size-3" aria-hidden="true" />,
    });
  }
  for (const status of statuses) {
    activeFilters.push({
      id: "status",
      value: status,
      label: `${t("filters.status")}: ${t(`status.${status.toLowerCase()}`)}`,
    });
  }
  for (const contractorMemberId of contractorMemberIds) {
    const option = contractorOptions.find((entry) => entry.value === contractorMemberId);

    activeFilters.push({
      id: "contractor",
      value: contractorMemberId,
      label: `${t("filters.contractor")}: ${option?.label ?? contractorMemberId}`,
    });
  }
  for (const projectId of projectIds) {
    const option = projectOptions.find((entry) => entry.value === projectId);

    activeFilters.push({
      id: "project",
      value: projectId,
      label: `${t("filters.project")}: ${option?.label ?? projectId}`,
    });
  }
  if (month) {
    activeFilters.push({
      id: "month",
      label: `${t("filters.month")}: ${formatMonthLabel(`${month}-01`, locale)}`,
    });
  }
  if (includePaid) {
    activeFilters.push({
      id: "includePaid",
      label: t("filters.includePaidChip"),
    });
  }

  return (
    <div className="grid gap-3">
      {/*
        Keyed on the applied filters so the controls are rebuilt whenever those change. The
        pickers are uncontrolled — `defaultValue` is read once — so without this, taking a
        chip off would update the URL and the list while the picker still showed the value it
        had just dropped, and the next submit would put it back.
      */}
      <form
        key={appliedFilterKey}
        className="flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-border bg-card p-3"
        action="/admin/timesheets"
      >
        <div className="min-w-[13rem] flex-1">
          <Input
            name="q"
            type="search"
            defaultValue={query}
            aria-label={t("filters.search")}
            placeholder={t("filters.searchPlaceholder")}
          />
        </div>
        <div className="w-[calc(50%-0.25rem)] sm:w-auto sm:min-w-32 sm:max-w-64">
          <Select
            multiple
            name="status"
            label={t("filters.status")}
            // No "all statuses" option to carry: an empty selection already is that state,
            // so the label becomes the placeholder.
            placeholder={t("filters.allStatuses")}
            defaultValue={statuses}
            labels={pickerLabels.combobox}
            options={filterableStatuses.map((value) => ({
              value,
              // The catalogue keys are lowercase; the filter values are the enum names.
              label: t(`status.${value.toLowerCase()}`),
            }))}
          />
        </div>
        <div className="w-[calc(50%-0.25rem)] sm:w-auto sm:min-w-32 sm:max-w-64">
          <Combobox
            multiple
            name="contractor"
            label={t("filters.contractor")}
            placeholder={t("filters.allContractors")}
            defaultValue={contractorMemberIds}
            labels={pickerLabels.combobox}
            // Email drops to the second line so the trigger stays readable while both the
            // name and the address remain searchable.
            options={contractorOptions.map((option) => ({
              value: option.value,
              label: option.label,
              meta: option.email ?? undefined,
            }))}
          />
        </div>
        <div className="w-[calc(50%-0.25rem)] sm:w-auto sm:min-w-32 sm:max-w-64">
          <Combobox
            multiple
            name="project"
            label={t("filters.project")}
            placeholder={t("filters.allProjects")}
            defaultValue={projectIds}
            labels={pickerLabels.combobox}
            options={projectOptions}
          />
        </div>
        <div className="w-[calc(50%-0.25rem)] sm:w-auto sm:min-w-32 sm:max-w-64">
          <MonthPicker
            name="month"
            label={t("filters.month")}
            locale={locale}
            defaultValue={month}
            placeholder={t("filters.allMonths")}
            labels={pickerLabels.month}
          />
        </div>
        {/*
          Not wrapped in a width class like the pickers: a checkbox and its label want their
          own width, and `whitespace-nowrap` keeps the Hungarian label — half again as long as
          the English one — from breaking away from its box when the row wraps.
        */}
        <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-muted-foreground">
          <Checkbox name="includePaid" value="1" defaultChecked={includePaid} />
          {t("filters.includePaid")}
        </label>
        <Button type="submit" icon={Filter} className="ml-auto">
          {t("filters.apply")}
        </Button>
      </form>

      <FilterChips
        chips={activeFilters}
        labels={{
          active: t("filters.active"),
          clear: t("filters.clear"),
          remove: (filter) => t("filters.removeFilter", { filter }),
        }}
        onRemove={(id, value) => router.push(hrefWithout(id, value))}
        onClear={() => router.push("/admin/timesheets" as Route)}
      />
    </div>
  );
}
