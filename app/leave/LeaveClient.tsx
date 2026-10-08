"use client";

import { CalendarDays, List, Plus } from "lucide-react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { LeaveCalendar } from "@/src/components/sheet/LeaveCalendar";
import { notify } from "@/src/components/sheet/Toast";
import { Button } from "@/src/components/ui/Button";
import { SectionHead } from "@/src/components/ui/SectionHead";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import { formatList } from "@/src/lib/formatting";
import { useOverlayParam } from "@/src/lib/use-overlay-param";
import { createLeaveAction } from "./actions";
import { LeaveDetailsDialog } from "./LeaveDetailsDialog";
import { LeaveFormDrawer } from "./LeaveFormDrawer";
import { LeaveMonthNav } from "./LeaveMonthNav";
import type { LeaveHoliday, LeaveView } from "./leave-view-types";
import { OwnLeaveList } from "./OwnLeaveList";
import { useLeaveCalendarLabels, useLeaveText } from "./use-leave-labels";

export type LeaveClientProps = {
  view: "calendar" | "list";
  /** `YYYY-MM`. */
  month: string;
  currentMonth: string;
  todayIso: string;
  calendarLeaves: LeaveView[];
  holidays: LeaveHoliday[];
  ownSummary: { vacation: number; sick: number };
  upcoming: LeaveView[];
  past: LeaveView[];
  /** First day the employee may still record leave for. */
  minDate: string;
  /** Holidays of this year and next, for the form's live workday count. */
  formHolidayDates: string[];
};

export function LeaveClient({
  view,
  month,
  currentMonth,
  todayIso,
  calendarLeaves,
  holidays,
  ownSummary,
  upcoming,
  past,
  minDate,
  formHolidayDates,
}: LeaveClientProps) {
  const text = useLeaveText();
  const { t } = text;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useOverlayParam("new", "leave");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const calendarLabels = useLeaveCalendarLabels(`${month}-01`);

  // The dialog looks its leave up in the latest props, so an uploaded note shows up in place.
  const selected = useMemo(
    () =>
      selectedId
        ? ([...calendarLeaves, ...upcoming, ...past].find((leave) => leave.id === selectedId) ??
          null)
        : null,
    [selectedId, calendarLeaves, upcoming, past],
  );

  const changeView = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "list") params.set("view", "list");
    else params.delete("view");
    const query = params.toString();
    router.push((query ? `/leave?${query}` : "/leave") as Route, { scroll: false });
  };

  const handleCreated = useCallback((message: string) => notify("success", message), []);
  const summaryEmpty = ownSummary.vacation === 0 && ownSummary.sick === 0;

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <SectionHead
        title={t("page.title")}
        subtitle={t("page.subtitle")}
        actions={
          <Button type="button" icon={Plus} onClick={() => setCreateOpen(true)}>
            {t("actions.add")}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label={t("views.label")}
          value={view}
          onValueChange={changeView}
          items={[
            { value: "calendar", label: t("views.calendar"), icon: CalendarDays },
            { value: "list", label: t("views.list"), icon: List },
          ]}
        />
        {view === "calendar" ? (
          <LeaveMonthNav pathname="/leave" month={month} currentMonth={currentMonth} />
        ) : null}
      </div>

      {view === "calendar" ? (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            {summaryEmpty
              ? t("summary.none")
              : t("summary.month", {
                  parts: formatList(
                    [
                      ownSummary.vacation > 0
                        ? t("summary.vacation", { days: text.workdays(ownSummary.vacation) })
                        : null,
                      ownSummary.sick > 0
                        ? t("summary.sick", { days: text.workdays(ownSummary.sick) })
                        : null,
                    ].filter((part): part is string => part !== null),
                    text.locale,
                  ),
                })}
          </p>
          <LeaveCalendar
            monthStart={`${month}-01`}
            todayIso={todayIso}
            leaves={calendarLeaves}
            holidays={holidays}
            locale={text.locale}
            labels={calendarLabels}
            onSelectLeave={(leave) => setSelectedId(leave.id)}
          />
        </div>
      ) : (
        <OwnLeaveList
          upcoming={upcoming}
          past={past}
          onSelect={(leave) => setSelectedId(leave.id)}
        />
      )}

      <LeaveFormDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        onDone={handleCreated}
        action={createLeaveAction}
        mode="create"
        minDate={minDate}
        holidayDates={formHolidayDates}
      />

      <LeaveDetailsDialog
        leave={selected}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </section>
  );
}
