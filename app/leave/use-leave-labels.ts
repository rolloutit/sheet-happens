"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import type { LeaveCalendarLabels, LeaveCalendarLeave } from "@/src/components/sheet/LeaveCalendar";
import { formatDateRangeLabel, formatDayHeading, formatMonthLabel } from "@/src/lib/formatting";

/**
 * The words the leave screens share: kind names, a leave's date range, its workday count. One hook
 * so the calendar, the list and the dialog never describe the same leave two different ways.
 */
export function useLeaveText() {
  const t = useTranslations("Leave");
  const locale = useLocale();

  return useMemo(() => {
    const kind = (leave: Pick<LeaveCalendarLeave, "kind">) => t(`kinds.${leave.kind}`);
    const range = (leave: Pick<LeaveCalendarLeave, "startDate" | "endDate">) =>
      formatDateRangeLabel(leave.startDate, leave.endDate, locale);
    const workdays = (count: number) => t("workdays", { count });
    const dayPart = (leave: Pick<LeaveCalendarLeave, "dayPart">) =>
      leave.dayPart === "FULL" ? null : t(`dayParts.${leave.dayPart}`);
    const who = (leave: Pick<LeaveCalendarLeave, "isOwn" | "memberName">) =>
      leave.isOwn ? t("you") : leave.memberName;

    return { t, locale, kind, range, workdays, dayPart, who };
  }, [t, locale]);
}

export function useLeaveCalendarLabels(monthStart: string): LeaveCalendarLabels {
  const text = useLeaveText();
  const { t, locale } = text;

  return useMemo(
    () => ({
      calendar: t("calendar.label", { month: formatMonthLabel(monthStart, locale) }),
      week: (weekNumber) => t("calendar.week", { week: weekNumber }),
      leave: (leave) =>
        [
          text.who(leave),
          text.kind(leave),
          text.range(leave),
          text.dayPart(leave),
          text.workdays(leave.workdays),
        ]
          .filter(Boolean)
          .join(", "),
      ribbon: (leave) =>
        leave.isOwn ? t("calendar.ownRibbon", { kind: text.kind(leave) }) : leave.memberName,
      day: (isoDate) => formatDayHeading(isoDate, locale),
      kinds: {
        vacation: t("kinds.vacation"),
        sick: t("kinds.sick"),
        absent: t("kinds.absent"),
      },
      holiday: t("calendar.holiday"),
      today: t("calendar.today"),
      morning: t("dayParts.MORNING"),
      afternoon: t("dayParts.AFTERNOON"),
      empty: t("calendar.empty"),
      away: (count) => t("calendar.away", { count }),
      more: (count) => t("calendar.more", { count }),
      awayOn: (isoDate) => t("calendar.awayOn", { day: formatDayHeading(isoDate, locale) }),
    }),
    [monthStart, locale, t, text],
  );
}
