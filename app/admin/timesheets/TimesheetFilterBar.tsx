"use client";

import { Filter, Search } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { FilterChips } from "@/src/components/sheet/FilterChips";
import type { FilterChip } from "@/src/components/sheet/FilterChips";
import { Button } from "@/src/components/ui/Button";
import { Combobox } from "@/src/components/ui/Combobox";
import { Input } from "@/src/components/ui/Input";
import { MonthPicker } from "@/src/components/ui/MonthPicker";
import { Select } from "@/src/components/ui/Select";
import { usePickerLabels } from "@/src/i18n/picker-labels";
import { formatMonthLabel } from "@/src/lib/formatting";

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
type FilterKey = "q" | "status" | "contractor" | "project" | "month";

export type TimesheetFilterBarProps = {
  query: string;
  status: string;
  contractorMemberId: string;
  projectId: string;
  /** `YYYY-MM`. */
  month: string;
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
 */
export function TimesheetFilterBar({
  query,
  status,
  contractorMemberId,
  projectId,
  month,
  contractorOptions,
  projectOptions,
}: TimesheetFilterBarProps) {
  const t = useTranslations("AdminTimesheets");
  const locale = useLocale();
  const router = useRouter();
  const pickerLabels = usePickerLabels();

  const current: Record<FilterKey, string> = {
    q: query,
    status,
    contractor: contractorMemberId,
    project: projectId,
    month,
  };

  function hrefWithout(key: FilterKey) {
    const params = new URLSearchParams();

    for (const [name, value] of Object.entries(current)) {
      if (name !== key && value) params.set(name, value);
    }

    const search = params.toString();

    return (search ? `/admin/timesheets?${search}` : "/admin/timesheets") as Route;
  }

  const activeFilters: FilterChip<FilterKey>[] = [];

  if (query) {
    activeFilters.push({
      id: "q",
      label: query,
      aria: `${t("filters.search")}: ${query}`,
      leading: <Search className="size-3" aria-hidden="true" />,
    });
  }
  if (status) {
    activeFilters.push({
      id: "status",
      label: `${t("filters.status")}: ${t(`status.${status.toLowerCase()}`)}`,
    });
  }
  if (contractorMemberId) {
    const option = contractorOptions.find((entry) => entry.value === contractorMemberId);

    activeFilters.push({
      id: "contractor",
      label: `${t("filters.contractor")}: ${option?.label ?? contractorMemberId}`,
    });
  }
  if (projectId) {
    const option = projectOptions.find((entry) => entry.value === projectId);

    activeFilters.push({
      id: "project",
      label: `${t("filters.project")}: ${option?.label ?? projectId}`,
    });
  }
  if (month) {
    activeFilters.push({
      id: "month",
      label: `${t("filters.month")}: ${formatMonthLabel(`${month}-01`, locale)}`,
    });
  }

  return (
    <div className="grid gap-3">
      <form
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
            name="status"
            label={t("filters.status")}
            // Radix reads an empty value as unset, so the "all" label doubles as the
            // placeholder or the trigger renders blank.
            placeholder={t("filters.allStatuses")}
            defaultValue={status}
            labels={pickerLabels.combobox}
            options={[
              { value: "", label: t("filters.allStatuses") },
              // The catalogue keys are lowercase; the filter values are the enum names.
              ...filterableStatuses.map((value) => ({
                value,
                label: t(`status.${value.toLowerCase()}`),
              })),
            ]}
          />
        </div>
        <div className="w-[calc(50%-0.25rem)] sm:w-auto sm:min-w-32 sm:max-w-64">
          <Combobox
            name="contractor"
            label={t("filters.contractor")}
            placeholder={t("filters.allContractors")}
            defaultValue={contractorMemberId}
            labels={pickerLabels.combobox}
            options={[
              { value: "", label: t("filters.allContractors") },
              // Email drops to the second line so the trigger stays readable while both
              // the name and the address remain searchable.
              ...contractorOptions.map((option) => ({
                value: option.value,
                label: option.label,
                meta: option.email ?? undefined,
              })),
            ]}
          />
        </div>
        <div className="w-[calc(50%-0.25rem)] sm:w-auto sm:min-w-32 sm:max-w-64">
          <Combobox
            name="project"
            label={t("filters.project")}
            placeholder={t("filters.allProjects")}
            defaultValue={projectId}
            labels={pickerLabels.combobox}
            options={[{ value: "", label: t("filters.allProjects") }, ...projectOptions]}
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
        onRemove={(id) => router.push(hrefWithout(id))}
        onClear={() => router.push("/admin/timesheets" as Route)}
      />
    </div>
  );
}
