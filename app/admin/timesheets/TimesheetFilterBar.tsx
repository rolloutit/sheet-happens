"use client";

import { Filter, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/src/components/ui/Button";
import { Combobox } from "@/src/components/ui/Combobox";
import { Field } from "@/src/components/ui/Field";
import { Input } from "@/src/components/ui/Input";
import { MonthPicker } from "@/src/components/ui/MonthPicker";
import { Select } from "@/src/components/ui/Select";
import { usePickerLabels } from "@/src/i18n/picker-labels";

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
  const pickerLabels = usePickerLabels();

  return (
    <form className="grid gap-4" action="/admin/timesheets">
      <div className="grid gap-3 lg:grid-cols-[minmax(15rem,1fr)_repeat(4,minmax(10rem,13rem))]">
        <Field label={t("filters.search")} htmlFor="timesheet-search">
          <Input
            id="timesheet-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder={t("filters.searchPlaceholder")}
          />
        </Field>
        <Field label={t("filters.status")}>
          {({ id }) => (
            <Select
              id={id}
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
          )}
        </Field>
        <Field label={t("filters.contractor")}>
          {({ id }) => (
            <Combobox
              id={id}
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
          )}
        </Field>
        <Field label={t("filters.project")}>
          {({ id }) => (
            <Combobox
              id={id}
              name="project"
              label={t("filters.project")}
              placeholder={t("filters.allProjects")}
              defaultValue={projectId}
              labels={pickerLabels.combobox}
              options={[{ value: "", label: t("filters.allProjects") }, ...projectOptions]}
            />
          )}
        </Field>
        <Field label={t("filters.month")}>
          {({ id }) => (
            <MonthPicker
              id={id}
              name="month"
              label={t("filters.month")}
              locale={locale}
              defaultValue={month}
              placeholder={t("filters.allMonths")}
              labels={pickerLabels.month}
            />
          )}
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" icon={Filter}>
          {t("filters.apply")}
        </Button>
        <Button asChild variant="ghost">
          <Link href={"/admin/timesheets" as Route}>
            <X className="size-4" aria-hidden />
            {t("filters.clear")}
          </Link>
        </Button>
      </div>
    </form>
  );
}
