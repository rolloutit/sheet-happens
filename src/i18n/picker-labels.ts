"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import type { ComboboxLabels } from "@/src/components/ui/Combobox";
import type { DatePickerLabels } from "@/src/components/ui/DatePicker";
import type { DateRangePickerLabels } from "@/src/components/ui/DateRangePicker";
import type { MonthPickerLabels } from "@/src/components/ui/MonthPicker";

export type PickerLabels = {
  combobox: ComboboxLabels;
  date: DatePickerLabels;
  range: DateRangePickerLabels;
  month: MonthPickerLabels;
};

/**
 * The localized chrome for every picker, ready to spread onto a control's `labels` prop.
 *
 * Components under `src/components/ui` never call `useTranslations` — they take strings as
 * props, which keeps them usable from Storybook and from either locale. That rule would
 * otherwise mean repeating a dozen label props across roughly twenty call sites, so the
 * strings live in one shared `Pickers` namespace and this hook assembles them.
 *
 * Lives in `src/i18n` rather than `src/components/ui` on purpose: it is the translation
 * layer, not part of the component library's public surface.
 */
export function usePickerLabels(): PickerLabels {
  const t = useTranslations("Pickers");

  return useMemo(() => {
    const combobox: ComboboxLabels = {
      search: t("search"),
      searchPlaceholder: t("searchPlaceholder"),
      empty: t("noResults"),
      // Both only reach a multi-select, which has no "All …" option to lean on.
      selected: (count) => t("selectedCount", { count }),
      clear: t("clear"),
    };

    const date: DatePickerLabels = {
      previousMonth: t("previousMonth"),
      nextMonth: t("nextMonth"),
      monthGrid: t("calendar"),
      clear: t("clear"),
      today: t("today"),
    };

    return {
      combobox,
      date,
      range: { ...date, to: t("rangeEnd"), done: t("done") },
      month: {
        previousYear: t("previousYear"),
        nextYear: t("nextYear"),
        monthGrid: t("selectMonth"),
        clear: t("clear"),
        thisMonth: t("thisMonth"),
      },
    };
  }, [t]);
}
