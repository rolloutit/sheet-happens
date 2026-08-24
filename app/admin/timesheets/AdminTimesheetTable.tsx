"use client";

import { CalendarDays, CheckCheck, Eye, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { StatusPill } from "@/src/components/sheet/StatusPill";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Checkbox } from "@/src/components/ui/Checkbox";
import type { DurationDisplayFormat } from "@/src/lib/formatting";
import type { AdminTimesheetRow } from "@/src/server/timesheets";
import { bulkApproveTimesheetsReviewAction } from "./actions";
import {
  formatHours,
  formatMoney,
  formatMonthLabel,
  formatPeriodRange,
  formatTimestamp,
  getStatusLabel,
  toTimesheetPreviewStatus,
} from "./formatting";

export type AdminTimesheetTableProps = {
  rows: AdminTimesheetRow[];
  returnTo: string;
  durationDisplayFormat: DurationDisplayFormat;
};

export function AdminTimesheetTable({
  rows,
  returnTo,
  durationDisplayFormat,
}: AdminTimesheetTableProps) {
  const t = useTranslations("AdminTimesheets");
  const locale = useLocale();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectableIds = useMemo(
    () => rows.filter((row) => row.status === "SUBMITTED").map((row) => row.id),
    [rows],
  );
  const selectedSelectableIds = selectedIds.filter((id) => selectableIds.includes(id));
  const allSelected =
    selectableIds.length > 0 && selectedSelectableIds.length === selectableIds.length;
  const someSelected = selectedSelectableIds.length > 0 && !allSelected;

  if (rows.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-border bg-secondary/45 px-5 py-8 text-center text-sm text-muted-foreground">
        {t("list.empty")}
      </div>
    );
  }

  return (
    <form action={bulkApproveTimesheetsReviewAction} className="grid gap-3">
      <input type="hidden" name="returnTo" value={returnTo} />
      {selectedSelectableIds.map((id) => (
        <input key={id} type="hidden" name="timesheetIds" value={id} />
      ))}

      {selectedSelectableIds.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-accent/30 bg-accent-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="font-ui text-sm font-semibold text-foreground">
              {t("bulk.selected", { count: selectedSelectableIds.length })}
            </p>
            <p className="text-xs text-muted-foreground">{t("bulk.eligibilityHint")}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={X}
              onClick={() => setSelectedIds([])}
            >
              {t("bulk.clear")}
            </Button>
            <BulkApproveButton count={selectedSelectableIds.length} />
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[68rem] border-collapse">
            <caption className="sr-only">{t("list.caption")}</caption>
            <thead>
              <tr className="border-b border-border bg-background/45">
                <th className="w-12 px-4 py-3 text-left">
                  <Checkbox
                    aria-label={t("bulk.selectAll")}
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    disabled={selectableIds.length === 0}
                    onCheckedChange={(checked) => {
                      setSelectedIds(checked ? selectableIds : []);
                    }}
                  />
                </th>
                <HeadCell>{t("table.contractor")}</HeadCell>
                <HeadCell>{t("table.month")}</HeadCell>
                <HeadCell>{t("table.status")}</HeadCell>
                <HeadCell>{t("table.hours")}</HeadCell>
                <HeadCell>{t("table.amount")}</HeadCell>
                <HeadCell>{t("table.submitted")}</HeadCell>
                <HeadCell>{t("table.snapshot")}</HeadCell>
                <HeadCell>{t("table.action")}</HeadCell>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const selectable = row.status === "SUBMITTED";
                const selected = selectedIds.includes(row.id);

                return (
                  <tr
                    key={row.id}
                    className="border-b border-border transition-colors last:border-b-0 data-[selected=true]:bg-accent-soft/70"
                    data-selected={selected}
                  >
                    <td className="px-4 py-4">
                      <Checkbox
                        aria-label={
                          selectable
                            ? t("bulk.selectRow", { name: row.contractorName })
                            : t("bulk.notSelectable", { name: row.contractorName })
                        }
                        checked={selected}
                        disabled={!selectable}
                        onCheckedChange={(checked) => {
                          setSelectedIds((current) =>
                            checked
                              ? current.includes(row.id)
                                ? current
                                : [...current, row.id]
                              : current.filter((id) => id !== row.id),
                          );
                        }}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <AvatarLabel name={row.contractorName} />
                        <div>
                          <p className="font-ui text-sm font-semibold text-foreground">
                            {row.contractorName}
                          </p>
                          <p className="text-xs text-muted-foreground">{row.contractorEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-2">
                        <CalendarDays className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
                        <div>
                          <p className="font-ui text-sm font-semibold text-foreground">
                            {formatMonthLabel(row.periodStart, locale)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatPeriodRange(row.periodStart, row.periodEnd, locale)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <StatusPill
                        status={toTimesheetPreviewStatus(row.status)}
                        label={getStatusLabel(row.status, t)}
                      />
                    </td>
                    <td className="px-4 py-4 font-ui text-sm font-semibold text-foreground">
                      {formatHours(row.totalMinutes, locale, durationDisplayFormat)}
                    </td>
                    <td className="px-4 py-4 font-ui text-sm font-semibold text-foreground">
                      {formatMoney(row.totalAmount, row.currencyCode, locale)}
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      {formatTimestamp(row.submittedAt, locale)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone="info">{t("revision", { number: row.revisionNumber })}</Badge>
                        <Badge tone="neutral">{t("list.entries", { count: row.entryCount })}</Badge>
                        <Badge tone="neutral">
                          {t("list.projects", { count: row.projectCount })}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Button asChild variant="soft" size="sm">
                        <Link href={`/admin/timesheets/${row.id}` as Route}>
                          <Eye className="size-4" aria-hidden />
                          {t("list.review")}
                        </Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </form>
  );
}

function BulkApproveButton({ count }: { count: number }) {
  const t = useTranslations("AdminTimesheets");
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="sm" icon={CheckCheck} loading={pending}>
      {pending ? t("bulk.approving") : t("bulk.approve", { count })}
    </Button>
  );
}

function AvatarLabel({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((part) => part.at(0))
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft font-ui text-xs font-bold text-accent">
      {initials || "TS"}
    </span>
  );
}

function HeadCell({ children }: { children: string }) {
  return (
    <th className="px-4 py-3 text-left font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </th>
  );
}
