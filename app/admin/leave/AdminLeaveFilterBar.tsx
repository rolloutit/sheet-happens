"use client";

import { Filter } from "lucide-react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { FilterChips, type FilterChip } from "@/src/components/sheet/FilterChips";
import { Button } from "@/src/components/ui/Button";
import { Combobox } from "@/src/components/ui/Combobox";
import { MonthPicker } from "@/src/components/ui/MonthPicker";
import { Select } from "@/src/components/ui/Select";
import { usePickerLabels } from "@/src/i18n/picker-labels";
import { formatMonthLabel } from "@/src/lib/formatting";
import { deleteSearchParamValue } from "@/src/lib/search-params";

/** The query-string names, which are also the `<form>` control names. */
type FilterKey = "month" | "member" | "type" | "hr";

export type AdminLeaveFilterBarProps = {
  view: "list" | "calendar";
  /** `YYYY-MM`, or empty for every month (the list only; the calendar always shows one). */
  month: string;
  memberIds: readonly string[];
  type: "" | "VACATION" | "SICK";
  hr: "all" | "pending" | "processed";
  employeeOptions: readonly { id: string; name: string; email: string }[];
};

/**
 * Month, people, kind and HR state, as a plain GET form so the server parses one set of params
 * for both views. The HR filter only applies to the list: the calendar shows who is away, which
 * does not depend on the admin's bookkeeping.
 */
export function AdminLeaveFilterBar({
  view,
  month,
  memberIds,
  type,
  hr,
  employeeOptions,
}: AdminLeaveFilterBarProps) {
  const t = useTranslations("Leave");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pickerLabels = usePickerLabels();

  function hrefWithout(key: FilterKey, value?: string) {
    const params = new URLSearchParams(searchParams.toString());
    deleteSearchParamValue(params, key, value);
    params.delete("page");
    const search = params.toString();
    return (search ? `/admin/leave?${search}` : "/admin/leave") as Route;
  }

  const chips: FilterChip<FilterKey>[] = [];
  if (month && view === "list") {
    chips.push({
      id: "month",
      label: `${t("admin.filters.month")}: ${formatMonthLabel(`${month}-01`, locale)}`,
    });
  }
  for (const memberId of memberIds) {
    const employee = employeeOptions.find((option) => option.id === memberId);
    chips.push({
      id: "member",
      value: memberId,
      label: `${t("admin.filters.member")}: ${employee?.name ?? memberId}`,
    });
  }
  if (type) {
    chips.push({
      id: "type",
      label: `${t("admin.filters.type")}: ${t(`kinds.${type === "SICK" ? "sick" : "vacation"}`)}`,
    });
  }
  if (hr !== "all" && view === "list") {
    chips.push({
      id: "hr",
      label: `${t("admin.filters.hr")}: ${t(`admin.filters.hrOptions.${hr}`)}`,
    });
  }

  return (
    <div className="grid gap-3">
      <form
        key={[view, month, memberIds.join(","), type, hr].join("|")}
        action="/admin/leave"
        className="flex flex-wrap items-end gap-2 rounded-[var(--radius-lg)] border border-border bg-card p-3"
      >
        {view === "calendar" ? <input type="hidden" name="view" value="calendar" /> : null}
        {view === "list" ? (
          <div className="w-[calc(50%-0.25rem)] sm:w-44">
            <MonthPicker
              name="month"
              label={t("admin.filters.month")}
              placeholder={t("admin.filters.allMonths")}
              defaultValue={month || undefined}
              locale={locale}
              labels={pickerLabels.month}
              clearable
            />
          </div>
        ) : (
          <input type="hidden" name="month" value={month} />
        )}
        <div className="w-[calc(50%-0.25rem)] sm:w-auto sm:min-w-40 sm:max-w-64">
          <Combobox
            multiple
            name="member"
            label={t("admin.filters.member")}
            placeholder={t("admin.filters.allMembers")}
            defaultValue={memberIds}
            labels={pickerLabels.combobox}
            options={employeeOptions.map((employee) => ({
              value: employee.id,
              label: employee.name,
              meta: employee.email,
            }))}
          />
        </div>
        <div className="w-[calc(50%-0.25rem)] sm:w-40">
          <Select
            name="type"
            label={t("admin.filters.type")}
            placeholder={t("admin.filters.allTypes")}
            defaultValue={type || undefined}
            labels={pickerLabels.combobox}
            options={[
              { value: "", label: t("admin.filters.allTypes") },
              { value: "VACATION", label: t("kinds.vacation") },
              { value: "SICK", label: t("kinds.sick") },
            ]}
          />
        </div>
        {view === "list" ? (
          <div className="w-[calc(50%-0.25rem)] sm:w-44">
            <Select
              name="hr"
              label={t("admin.filters.hr")}
              placeholder={t("admin.filters.hrOptions.all")}
              defaultValue={hr === "all" ? undefined : hr}
              labels={pickerLabels.combobox}
              options={[
                { value: "", label: t("admin.filters.hrOptions.all") },
                { value: "pending", label: t("admin.filters.hrOptions.pending") },
                { value: "processed", label: t("admin.filters.hrOptions.processed") },
              ]}
            />
          </div>
        ) : null}
        <Button type="submit" icon={Filter} className="ml-auto">
          {t("admin.filters.apply")}
        </Button>
      </form>

      <FilterChips
        chips={chips}
        labels={{
          active: t("admin.filters.active"),
          clear: t("admin.filters.clear"),
          remove: (filter) => t("admin.filters.remove", { filter }),
        }}
        onRemove={(id, value) => router.push(hrefWithout(id, value))}
        onClear={() =>
          router.push(
            (view === "calendar" ? "/admin/leave?view=calendar" : "/admin/leave") as Route,
          )
        }
      />
    </div>
  );
}
