"use client";

import { Filter, Search } from "lucide-react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { FilterChips } from "@/src/components/sheet/FilterChips";
import type { FilterChip } from "@/src/components/sheet/FilterChips";
import { Button } from "@/src/components/ui/Button";
import { Combobox } from "@/src/components/ui/Combobox";
import { Input } from "@/src/components/ui/Input";
import { Select } from "@/src/components/ui/Select";
import { usePickerLabels } from "@/src/i18n/picker-labels";
import { deleteSearchParamValue } from "@/src/lib/search-params";

/** The query-string names, which are also the `<form>` control names. */
type FilterKey = "query" | "employeeMemberId" | "month";

export type PayslipFilterBarProps = {
  query: string;
  employeeMemberIds: readonly string[];
  /** `YYYY-MM`. */
  month: string;
  employeeOptions: readonly { id: string; name: string; email: string }[];
  monthOptions: readonly { value: string; label: string }[];
};

/**
 * The payslip list filters.
 *
 * A client component so the employee picker can be searchable — the previous version was a
 * native `<select>` with hand-written classes, which drifted from every other filter in the
 * app and became unusable once the employee list grew. Still a plain GET `<form>` under the
 * same control names, so the server-side parser is untouched.
 */
export function PayslipFilterBar({
  query,
  employeeMemberIds,
  month,
  employeeOptions,
  monthOptions,
}: PayslipFilterBarProps) {
  const t = useTranslations("Payslips");
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
    params.delete("page");

    const search = params.toString();

    return (search ? `/admin/payslips?${search}` : "/admin/payslips") as Route;
  }

  const appliedFilterKey = [query, employeeMemberIds, month].join("|");
  const activeFilters: FilterChip<FilterKey>[] = [];

  if (query) {
    activeFilters.push({
      id: "query",
      label: query,
      aria: `${t("admin.filters.search")}: ${query}`,
      leading: <Search className="size-3" aria-hidden="true" />,
    });
  }
  for (const memberId of employeeMemberIds) {
    const employee = employeeOptions.find((option) => option.id === memberId);

    activeFilters.push({
      id: "employeeMemberId",
      value: memberId,
      label: `${t("admin.filters.employee")}: ${employee?.name ?? memberId}`,
    });
  }
  if (month) {
    const option = monthOptions.find((entry) => entry.value === month);

    activeFilters.push({
      id: "month",
      label: `${t("admin.filters.month")}: ${option?.label ?? month}`,
    });
  }

  return (
    <div className="grid gap-3">
      {/*
        Keyed on the applied filters so the uncontrolled pickers are rebuilt whenever those
        change — see the note in `TimesheetFilterBar`.
      */}
      <form
        key={appliedFilterKey}
        className="flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-border bg-card p-3"
      >
        <div className="min-w-[13rem] flex-1">
          <Input
            name="query"
            type="search"
            defaultValue={query}
            aria-label={t("admin.filters.search")}
            placeholder={t("admin.filters.search")}
          />
        </div>
        <div className="w-[calc(50%-0.25rem)] sm:w-auto sm:min-w-32 sm:max-w-64">
          <Combobox
            multiple
            name="employeeMemberId"
            label={t("admin.filters.employee")}
            // No "all employees" option to carry: an empty selection already is that state,
            // so the label becomes the placeholder.
            placeholder={t("admin.filters.allEmployees")}
            defaultValue={employeeMemberIds}
            labels={pickerLabels.combobox}
            options={employeeOptions.map((employee) => ({
              value: employee.id,
              label: employee.name,
              meta: employee.email,
            }))}
          />
        </div>
        <div className="w-[calc(50%-0.25rem)] sm:w-auto sm:min-w-32 sm:max-w-64">
          <Select
            name="month"
            label={t("admin.filters.month")}
            placeholder={t("admin.filters.allMonths")}
            defaultValue={month}
            labels={pickerLabels.combobox}
            options={[{ value: "", label: t("admin.filters.allMonths") }, ...monthOptions]}
          />
        </div>
        {/* Any new filter starts the list over. */}
        <input type="hidden" name="page" value="1" />
        <Button type="submit" icon={Filter} className="ml-auto">
          {t("admin.filters.apply")}
        </Button>
      </form>

      <FilterChips
        chips={activeFilters}
        labels={{
          active: t("admin.filters.active"),
          clear: t("actions.clear"),
          remove: (filter) => t("admin.filters.removeFilter", { filter }),
        }}
        onRemove={(id, value) => router.push(hrefWithout(id, value))}
        onClear={() => router.push("/admin/payslips" as Route)}
      />
    </div>
  );
}
