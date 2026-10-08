"use client";

import { CalendarDays, CircleCheck, List, Paperclip, Pencil, Sunrise, Sunset } from "lucide-react";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";

import { LeaveCalendar } from "@/src/components/sheet/LeaveCalendar";
import { LeaveKindBadge } from "@/src/components/sheet/LeaveKindBadge";
import { notify } from "@/src/components/sheet/Toast";
import { BulkBar } from "@/src/components/ui/BulkBar";
import { Button } from "@/src/components/ui/Button";
import { Checkbox } from "@/src/components/ui/Checkbox";
import { IconButton } from "@/src/components/ui/IconButton";
import { Pager } from "@/src/components/ui/Pager";
import { SectionHead } from "@/src/components/ui/SectionHead";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import { DataTable, type TableColumn } from "@/src/components/ui/Table";
import { formatDateTime } from "@/src/lib/formatting";
import { LeaveDetailsDialog, type LeaveAdminControls } from "@/app/leave/LeaveDetailsDialog";
import { LeaveFormDrawer } from "@/app/leave/LeaveFormDrawer";
import { LeaveMonthNav } from "@/app/leave/LeaveMonthNav";
import type { AdminLeaveView, LeaveHoliday } from "@/app/leave/leave-view-types";
import { useLeaveCalendarLabels, useLeaveText } from "@/app/leave/use-leave-labels";
import {
  deleteLeaveAction,
  removeLeaveAttachmentAction,
  setLeaveHrProcessedAction,
  updateLeaveAction,
} from "./actions";
import { AdminLeaveFilterBar, type AdminLeaveFilterBarProps } from "./AdminLeaveFilterBar";

export type AdminLeaveClientProps = {
  view: "list" | "calendar";
  filters: Omit<AdminLeaveFilterBarProps, "view" | "employeeOptions">;
  employeeOptions: AdminLeaveFilterBarProps["employeeOptions"];
  rows: AdminLeaveView[];
  page: number;
  totalPages: number;
  totalItems: number;
  pendingCount: number;
  calendar: {
    month: string;
    currentMonth: string;
    todayIso: string;
    holidays: LeaveHoliday[];
  } | null;
  /** Holidays of last year to next year, for the edit form's live workday count. */
  formHolidayDates: string[];
};

type Row = AdminLeaveView & Record<string, unknown>;

export function AdminLeaveClient({
  view,
  filters,
  employeeOptions,
  rows,
  page,
  totalPages,
  totalItems,
  pendingCount,
  calendar,
  formHolidayDates,
}: AdminLeaveClientProps) {
  const text = useLeaveText();
  const { t, locale } = text;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminLeaveView | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const calendarLabels = useLeaveCalendarLabels(`${calendar?.month ?? "2000-01"}-01`);

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId],
  );
  const visibleChecked = checked.filter((id) => rows.some((row) => row.id === id));

  const pushParams = (update: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    update(params);
    const query = params.toString();
    router.push((query ? `/admin/leave?${query}` : "/admin/leave") as Route, { scroll: false });
  };

  const setHr = useCallback(
    (leaveIds: string[], processed: boolean) => setLeaveHrProcessedAction({ leaveIds, processed }),
    [],
  );

  const adminControls: LeaveAdminControls = {
    onEdit: (leave) => {
      setSelectedId(null);
      setEditing(leave);
    },
    deleteLeave: (leaveId) => deleteLeaveAction({ leaveId }),
    setHrProcessed: setHr,
    removeAttachment: (leaveId) => removeLeaveAttachmentAction({ leaveId }),
  };

  const toggleHr = (leaveIds: string[], processed: boolean, after?: () => void) =>
    startTransition(async () => {
      const result = await setHr(leaveIds, processed);
      notify(result.status === "success" ? "success" : "error", result.message);
      if (result.status === "success") after?.();
    });

  const columns: TableColumn<Row>[] = [
    {
      id: "select",
      header: (
        <Checkbox
          aria-label={t("admin.table.selectAll")}
          checked={
            rows.length > 0 && visibleChecked.length === rows.length
              ? true
              : visibleChecked.length > 0
                ? "indeterminate"
                : false
          }
          onCheckedChange={(value) => setChecked(value === true ? rows.map((row) => row.id) : [])}
        />
      ),
      width: "2.5rem",
      mobileLabel: null,
      cell: (row) => (
        <Checkbox
          aria-label={t("admin.table.select", { name: row.memberName, range: text.range(row) })}
          checked={visibleChecked.includes(row.id)}
          onCheckedChange={(value) =>
            setChecked((current) =>
              value === true ? [...current, row.id] : current.filter((id) => id !== row.id),
            )
          }
        />
      ),
    },
    {
      id: "member",
      header: t("admin.table.member"),
      mobileLabel: null,
      cell: (row) => (
        <span className="grid">
          <span className="font-ui text-sm font-semibold text-foreground">{row.memberName}</span>
          <span className="text-xs text-muted-foreground">{row.memberEmail}</span>
        </span>
      ),
    },
    {
      id: "period",
      header: t("admin.table.period"),
      cell: (row) => (
        <span className="grid">
          <span className="text-sm text-foreground">{text.range(row)}</span>
          {row.dayPart !== "FULL" ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {row.dayPart === "MORNING" ? (
                <Sunrise className="size-3" aria-hidden="true" />
              ) : (
                <Sunset className="size-3" aria-hidden="true" />
              )}
              {text.dayPart(row)}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "workdays",
      header: t("admin.table.workdays"),
      align: "right",
      cell: (row) => <span className="text-sm tabular-nums">{text.workdays(row.workdays)}</span>,
    },
    {
      id: "kind",
      header: t("admin.table.kind"),
      cell: (row) => <LeaveKindBadge kind={row.kind} label={text.kind(row)} size="sm" />,
    },
    {
      id: "details",
      header: t("admin.table.details"),
      cell: (row) => (
        <span className="flex max-w-64 flex-col gap-0.5">
          {row.kind === "sick" ? (
            <span
              className={
                row.attachment
                  ? "inline-flex items-center gap-1 text-xs text-muted-foreground"
                  : "inline-flex items-center gap-1 text-xs font-medium text-warning"
              }
            >
              <Paperclip className="size-3" aria-hidden="true" />
              {row.attachment ? t("list.noteAttached") : t("list.noteMissing")}
            </span>
          ) : null}
          {row.note ? (
            <span className="truncate text-xs text-muted-foreground">{row.note}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: "hr",
      header: t("admin.table.hr"),
      cell: (row) => (
        <label className="inline-flex items-center gap-2">
          <Checkbox
            checked={Boolean(row.hrProcessedAt)}
            disabled={pending}
            aria-label={t("admin.hr.toggle", { name: row.memberName, range: text.range(row) })}
            onCheckedChange={(value) => toggleHr([row.id], value === true)}
          />
          <span className="grid text-xs">
            {row.hrProcessedAt ? (
              <>
                <span className="font-medium text-success">{t("admin.hr.done")}</span>
                <span className="text-muted-foreground">
                  {formatDateTime(row.hrProcessedAt, locale)}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">{t("admin.hr.todo")}</span>
            )}
          </span>
        </label>
      ),
    },
  ];

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <SectionHead title={t("admin.title")} subtitle={t("admin.subtitle")} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label={t("views.label")}
          value={view}
          onValueChange={(next) =>
            pushParams((params) => {
              params.delete("page");
              params.delete("hr");
              if (next === "calendar") params.set("view", "calendar");
              else params.delete("view");
            })
          }
          items={[
            { value: "list", label: t("views.list"), icon: List },
            { value: "calendar", label: t("views.calendar"), icon: CalendarDays },
          ]}
        />
        {calendar ? (
          <LeaveMonthNav
            pathname="/admin/leave"
            month={calendar.month}
            currentMonth={calendar.currentMonth}
          />
        ) : (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {pendingCount > 0
              ? t("admin.pending", { count: pendingCount })
              : t("admin.allProcessed")}
          </p>
        )}
      </div>

      <AdminLeaveFilterBar view={view} employeeOptions={employeeOptions} {...filters} />

      {calendar ? (
        <LeaveCalendar
          monthStart={`${calendar.month}-01`}
          todayIso={calendar.todayIso}
          leaves={rows}
          holidays={calendar.holidays}
          locale={locale}
          labels={calendarLabels}
          onSelectLeave={(leave) => setSelectedId(leave.id)}
        />
      ) : (
        <div className="grid gap-3">
          {visibleChecked.length > 0 ? (
            <BulkBar
              selectedCount={visibleChecked.length}
              labels={{
                region: t("admin.bulk.region"),
                selected: (count) => t("admin.bulk.selected", { count }),
              }}
              primaryAction={
                <Button
                  type="button"
                  size="sm"
                  icon={CircleCheck}
                  disabled={pending}
                  onClick={() => toggleHr(visibleChecked, true, () => setChecked([]))}
                >
                  {t("admin.bulk.markProcessed")}
                </Button>
              }
              secondaryAction={
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => toggleHr(visibleChecked, false, () => setChecked([]))}
                >
                  {t("admin.bulk.markUnprocessed")}
                </Button>
              }
            />
          ) : null}
          <DataTable
            aria-label={t("admin.table.label")}
            columns={columns}
            rows={rows as Row[]}
            getRowKey={(row) => row.id}
            selectedRowKeys={visibleChecked}
            displayMode="responsive"
            density="compact"
            rowActionsHeader={t("admin.table.actions")}
            rowActions={(row) => (
              <span className="flex justify-end gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedId(row.id)}
                >
                  {t("admin.table.open")}
                </Button>
                <IconButton
                  icon={Pencil}
                  label={t("admin.editLeave", { name: row.memberName, range: text.range(row) })}
                  onClick={() => setEditing(row)}
                />
              </span>
            )}
            empty={
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                {t("admin.empty")}
              </p>
            }
          />
          {totalPages > 1 ? (
            <Pager
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              onPageChange={(next) => pushParams((params) => params.set("page", String(next)))}
            />
          ) : null}
        </div>
      )}

      <LeaveDetailsDialog
        leave={selected}
        admin={adminControls}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />

      <LeaveFormDrawer
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onDone={(message) => notify("success", message)}
        action={updateLeaveAction}
        mode="edit"
        memberName={editing?.memberName}
        initial={
          editing
            ? {
                leaveId: editing.id,
                type: editing.kind === "sick" ? "SICK" : "VACATION",
                startDate: editing.startDate,
                endDate: editing.endDate,
                dayPart: editing.dayPart,
                note: editing.note ?? "",
              }
            : undefined
        }
        holidayDates={formHolidayDates}
      />
    </section>
  );
}
