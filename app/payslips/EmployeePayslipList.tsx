"use client";

import { Download, Eye, FileText, LockKeyhole, ReceiptText } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@/src/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/Dialog";
import { Pager } from "@/src/components/ui/Pager";

export type EmployeePayslipItem = {
  id: string;
  month: string;
  filename: string;
  fileSize: string;
  publishedAt: string | null;
};

export function EmployeePayslipList({
  latest,
  history,
  pagination,
  availableYears,
  filters,
}: {
  latest: EmployeePayslipItem | null;
  history: EmployeePayslipItem[];
  pagination: { page: number; totalPages: number; totalItems: number };
  availableYears: number[];
  filters: { year: number | null; sort: "newest" | "oldest"; pageSize: number };
}) {
  const t = useTranslations("Payslips");
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = [latest, ...history].find((item) => item?.id === selectedId) ?? null;

  if (!latest) {
    return (
      <div className="grid min-h-72 place-items-center rounded-[var(--radius-lg)] border border-dashed border-border bg-card/65 p-8 text-center">
        <div className="grid max-w-sm justify-items-center gap-3">
          <span className="grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
            <ReceiptText className="size-7" aria-hidden="true" />
          </span>
          <h2 className="text-xl font-semibold text-foreground">{t("employee.empty.title")}</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {t("employee.empty.description")}
          </p>
        </div>
      </div>
    );
  }

  function changePage(page: number) {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(page));
    router.push(`/payslips?${params.toString()}` as Route);
  }

  function changeFilter(name: "year" | "sort" | "pageSize", value: string) {
    const params = new URLSearchParams(window.location.search);
    const defaults = { year: "", sort: "newest", pageSize: "12" };

    if (value === defaults[name]) {
      params.delete(name);
    } else {
      params.set(name, value);
    }
    params.delete("page");
    router.push(`/payslips${params.size > 0 ? `?${params.toString()}` : ""}` as Route);
  }

  function clearFilters() {
    const params = new URLSearchParams(window.location.search);
    params.delete("year");
    params.delete("sort");
    params.delete("pageSize");
    params.delete("page");
    router.push(`/payslips${params.size > 0 ? `?${params.toString()}` : ""}` as Route);
  }

  const filtersActive =
    filters.year !== null || filters.sort !== "newest" || filters.pageSize !== 12;
  const showHistory = history.length > 0 || pagination.totalItems > 0 || filtersActive;

  return (
    <div className="grid gap-6">
      <article className="grid gap-5 rounded-[var(--radius-lg)] border border-accent/30 bg-card p-5 shadow-panel sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-6">
        <MonthMarker label={latest.month} />
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-accent px-2.5 py-1 font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-accent-foreground">
              {t("employee.latest")}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
              <span className="size-1.5 rounded-full bg-success" />
              {t("employee.available")}
            </span>
          </div>
          <h2 className="text-2xl font-semibold text-foreground">{latest.month}</h2>
          <p className="mt-2 truncate text-sm text-muted-foreground">{latest.filename}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {latest.fileSize}
            {latest.publishedAt ? ` · ${latest.publishedAt}` : ""}
          </p>
        </div>
        <PayslipActions item={latest} onPreview={() => setSelectedId(latest.id)} primary />
      </article>

      {showHistory ? (
        <section className="grid gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="pb-1 font-ui text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              {t("employee.history")}
            </h2>
            <div className="flex flex-wrap items-end gap-2">
              <HistorySelect
                label={t("employee.filters.year")}
                value={filters.year?.toString() ?? ""}
                onChange={(value) => changeFilter("year", value)}
              >
                <option value="">{t("employee.filters.allYears")}</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </HistorySelect>
              <HistorySelect
                label={t("employee.filters.order")}
                value={filters.sort}
                onChange={(value) => changeFilter("sort", value)}
              >
                <option value="newest">{t("employee.filters.newest")}</option>
                <option value="oldest">{t("employee.filters.oldest")}</option>
              </HistorySelect>
              <HistorySelect
                label={t("employee.filters.pageSize")}
                value={String(filters.pageSize)}
                onChange={(value) => changeFilter("pageSize", value)}
              >
                {[12, 24, 48].map((pageSize) => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize}
                  </option>
                ))}
              </HistorySelect>
              {filtersActive ? (
                <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                  {t("employee.filters.clear")}
                </Button>
              ) : null}
            </div>
          </div>

          {history.length > 0 ? (
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-3 border-b border-border px-4 py-4 last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                >
                  <MonthMarker label={item.month} compact />
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{item.month}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {item.filename} · {item.fileSize}
                    </p>
                  </div>
                  <PayslipActions item={item} onPreview={() => setSelectedId(item.id)} />
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-[var(--radius-md)] border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              {t("employee.filters.empty")}
            </p>
          )}

          {pagination.totalItems > 0 ? (
            <Pager
              className="px-1 pt-2"
              page={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              onPageChange={changePage}
              labels={{
                navigation: t("pager.navigation"),
                summary: (page, totalPages, totalItems) =>
                  t("pager.summary", { page, totalPages, totalItems: totalItems ?? 0 }),
                previous: t("pager.previous"),
                next: t("pager.next"),
              }}
            />
          ) : null}
        </section>
      ) : null}

      <p className="flex items-center gap-2 text-xs leading-5 text-muted-foreground">
        <LockKeyhole className="size-4 shrink-0 text-accent" aria-hidden="true" />
        {t("employee.privateNote")}
      </p>

      <PayslipPreviewDialog item={selected} onOpenChange={(open) => !open && setSelectedId(null)} />
    </div>
  );
}

function HistorySelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1">
      <span className="font-ui text-[10px] font-bold uppercase text-muted-foreground">{label}</span>
      <select
        value={value}
        className="h-9 min-w-28 rounded-[var(--radius-sm)] border border-input bg-background px-2.5 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {children}
      </select>
    </label>
  );
}

function PayslipActions({
  item,
  onPreview,
  primary = false,
}: {
  item: EmployeePayslipItem;
  onPreview: () => void;
  primary?: boolean;
}) {
  const t = useTranslations("Payslips");

  return (
    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
      <Button type="button" variant="ghost" size="sm" icon={Eye} onClick={onPreview}>
        {t("actions.preview")}
      </Button>
      <Button asChild variant={primary ? "primary" : "soft"} size="sm" icon={Download}>
        <a href={`/api/payslips/${item.id}?download=1`}>{t("actions.download")}</a>
      </Button>
    </div>
  );
}

function PayslipPreviewDialog({
  item,
  onOpenChange,
}: {
  item: EmployeePayslipItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Payslips");

  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl gap-4 p-0" closeLabel={t("actions.close")}>
        {item ? (
          <>
            <DialogHeader className="border-b border-border px-6 py-5 pr-14">
              <DialogTitle className="flex min-w-0 items-center gap-2 text-base">
                <FileText className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                <span className="truncate">{item.filename}</span>
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2">
                <LockKeyhole className="size-3.5 text-accent" aria-hidden="true" />
                {t("viewer.signedLink")}
              </DialogDescription>
            </DialogHeader>
            <div className="bg-secondary/60 p-4 sm:p-6">
              <iframe
                src={`/api/payslips/${item.id}`}
                title={t("viewer.title", { filename: item.filename })}
                className="h-[min(70vh,54rem)] w-full rounded-[var(--radius-sm)] bg-white shadow-panel"
              />
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function MonthMarker({ label, compact = false }: { label: string; compact?: boolean }) {
  const year = label.match(/\d{4}/)?.[0] ?? "";
  const month = label.replace(year, "").replaceAll(".", "").trim();

  return (
    <div
      className={`grid shrink-0 place-items-center rounded-[var(--radius-md)] border border-border bg-secondary font-ui font-bold text-accent ${
        compact ? "size-11 text-[10px]" : "size-16 text-xs"
      }`}
    >
      <span className="leading-none">{month.slice(0, 3).toUpperCase()}</span>
      <span className="mt-1 text-[9px] leading-none text-muted-foreground">{year}</span>
    </div>
  );
}
