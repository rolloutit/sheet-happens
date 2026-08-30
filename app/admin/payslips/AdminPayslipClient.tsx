"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileText,
  FileUp,
  ReceiptText,
  Trash2,
  UploadCloud,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useActionState, useEffect, useId, useMemo, useState, useTransition } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/src/components/ui/Button";
import { Combobox } from "@/src/components/ui/Combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/Dialog";
import { Field } from "@/src/components/ui/Field";
import { IconButton } from "@/src/components/ui/IconButton";
import { Pager } from "@/src/components/ui/Pager";
import { cn } from "@/src/lib/utils";
import {
  getPayslipYearPage,
  getPayslipMonthWindow,
  type AdminPayslipMonthOption,
} from "@/src/lib/payslip-month-options";
import { deletePayslipAction, uploadPayslipAction } from "./actions";
import { initialAdminPayslipActionState } from "./action-state";

export type AdminPayslipItem = {
  id: string;
  employeeMemberId: string;
  employeeName: string;
  employeeEmail: string;
  employeeStatus: string;
  month: string;
  monthValue: string;
  filename: string;
  fileSize: string;
  publishedAt: string | null;
  publishedByName: string | null;
};

export type AdminPayslipEmployeeOption = {
  id: string;
  name: string;
  email: string;
  status: string;
};

export function AdminPayslipClient({
  rows,
  employees,
  months,
  selectedMonth,
  overview,
  pagination,
}: {
  rows: AdminPayslipItem[];
  employees: AdminPayslipEmployeeOption[];
  months: AdminPayslipMonthOption[];
  selectedMonth: string;
  overview: {
    postedCount: number;
    expectedCount: number;
    missingEmployees: Array<Pick<AdminPayslipEmployeeOption, "id" | "name" | "email">>;
  };
  pagination: {
    page: number;
    totalPages: number;
    totalItems: number;
  };
}) {
  const t = useTranslations("Payslips");
  const router = useRouter();
  const [uploadContext, setUploadContext] = useState<{
    employeeMemberId?: string;
    month?: string;
    replacing?: boolean;
  } | null>(null);
  const [preview, setPreview] = useState<AdminPayslipItem | null>(null);
  const [deleting, setDeleting] = useState<AdminPayslipItem | null>(null);
  const [deleteResult, setDeleteResult] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const visibleMonth =
    months.find((month) => month.value === selectedMonth)?.label ?? selectedMonth;

  function changePage(page: number) {
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(page));
    router.push(`/admin/payslips?${params.toString()}` as Route);
  }

  function deleteSelectedPayslip() {
    if (!deleting) return;

    startDeleteTransition(async () => {
      const result = await deletePayslipAction({ payslipId: deleting.id });
      setDeleteResult(result.message);
      if (result.status === "success") {
        setDeleting(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-6">
      {deleteResult ? (
        <div className="rounded-[var(--radius-md)] border border-accent/30 bg-accent-soft px-4 py-3 text-sm font-medium text-accent">
          {deleteResult}
        </div>
      ) : null}

      <section className="grid gap-4 rounded-[var(--radius-lg)] border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">{t("admin.overview.title")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {visibleMonth} ·{" "}
              {t("admin.overview.posted", {
                posted: overview.postedCount,
                expected: overview.expectedCount,
              })}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            icon={UploadCloud}
            onClick={() => setUploadContext({ month: selectedMonth })}
          >
            {t("actions.upload")}
          </Button>
        </div>
        {overview.missingEmployees.length === 0 ? (
          <p className="rounded-[var(--radius-md)] bg-success-soft px-3 py-2 text-sm font-medium text-success">
            {t("admin.overview.complete")}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <span className="self-center text-xs font-semibold text-muted-foreground">
              {t("admin.overview.missing")}
            </span>
            {overview.missingEmployees.map((employee) => (
              <button
                key={employee.id}
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-accent/40 hover:text-accent"
                title={t("admin.overview.uploadFor", { name: employee.name })}
                onClick={() =>
                  setUploadContext({ employeeMemberId: employee.id, month: selectedMonth })
                }
              >
                <span className="grid size-5 place-items-center rounded-full bg-accent-soft text-[9px] font-bold text-accent">
                  {initials(employee.name)}
                </span>
                {employee.name}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[var(--radius-lg)] border border-border bg-card">
        <div className="border-b border-border px-4 py-5 sm:px-6">
          <h2 className="font-semibold text-foreground">{t("admin.list.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.list.description")}</p>
        </div>
        {rows.length === 0 ? (
          <div className="grid min-h-52 place-items-center p-8 text-center">
            <div className="grid justify-items-center gap-3 text-muted-foreground">
              <ReceiptText className="size-7 text-accent" aria-hidden="true" />
              <p className="text-sm">{t("admin.list.empty")}</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[58rem] border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/45 text-left font-ui text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  <th className="px-4 py-3 sm:px-6">{t("admin.list.employee")}</th>
                  <th className="px-4 py-3">{t("admin.list.month")}</th>
                  <th className="px-4 py-3">{t("admin.list.file")}</th>
                  <th className="px-4 py-3">{t("admin.list.published")}</th>
                  <th className="px-4 py-3 text-right sm:px-6">{t("admin.list.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                          {initials(row.employeeName)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {row.employeeName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {row.employeeEmail}
                          </p>
                          {row.employeeStatus === "INACTIVE" ? (
                            <span className="mt-1 inline-flex rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              {t("admin.list.inactive")}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-foreground">{row.month}</td>
                    <td className="px-4 py-4">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="max-w-56 truncate text-sm font-medium text-foreground">
                            {row.filename}
                          </p>
                          <p className="text-xs text-muted-foreground">{row.fileSize} · PDF</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      <p>{row.publishedAt ?? "-"}</p>
                      {row.publishedByName ? (
                        <p className="mt-1 text-xs">
                          {t("admin.list.uploadedBy", { name: row.publishedByName })}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 sm:px-6">
                      <div className="flex justify-end gap-1.5">
                        <IconAction
                          label={t("actions.preview")}
                          icon={Eye}
                          onClick={() => setPreview(row)}
                        />
                        <a
                          href={`/api/payslips/${row.id}?download=1`}
                          className="grid size-8 place-items-center rounded-[var(--radius-sm)] text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                          aria-label={t("actions.download")}
                          title={t("actions.download")}
                        >
                          <Download className="size-4" aria-hidden="true" />
                        </a>
                        <IconAction
                          label={t("actions.replace")}
                          icon={UploadCloud}
                          onClick={() =>
                            setUploadContext({
                              employeeMemberId: row.employeeMemberId,
                              month: row.monthValue,
                              replacing: true,
                            })
                          }
                        />
                        <IconAction
                          label={t("actions.delete")}
                          icon={Trash2}
                          tone="danger"
                          onClick={() => {
                            setDeleteResult(null);
                            setDeleting(row);
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-border px-4 py-3 sm:px-6">
          <Pager
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
        </div>
      </section>

      {uploadContext ? (
        <PayslipUploadDialog
          context={uploadContext}
          employees={employees}
          months={months}
          onOpenChange={(open) => !open && setUploadContext(null)}
        />
      ) : null}
      <PayslipPreviewDialog item={preview} onOpenChange={(open) => !open && setPreview(null)} />
      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent closeLabel={t("actions.close")}>
          {deleting ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("admin.delete.title")}</DialogTitle>
                <DialogDescription>
                  {t("admin.delete.description", {
                    name: deleting.employeeName,
                    month: deleting.month,
                  })}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setDeleting(null)}>
                  {t("actions.cancel")}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  icon={Trash2}
                  loading={isDeleting}
                  onClick={deleteSelectedPayslip}
                >
                  {t("actions.confirmDelete")}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PayslipUploadDialog({
  context,
  employees,
  months,
  onOpenChange,
}: {
  context: { employeeMemberId?: string; month?: string; replacing?: boolean };
  employees: AdminPayslipEmployeeOption[];
  months: AdminPayslipMonthOption[];
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Payslips");
  const locale = useLocale();
  const router = useRouter();
  const currentMonth = months[0]?.value ?? context.month ?? "";
  const [selectedEmployee, setSelectedEmployee] = useState(context.employeeMemberId ?? "");
  const [selectedMonth, setSelectedMonth] = useState(context.month ?? currentMonth);
  const [yearPage, setYearPage] = useState(() =>
    context.month && currentMonth ? getPayslipYearPage(currentMonth, context.month) : 0,
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const inputId = useId();
  const [state, formAction, isPending] = useActionState(
    uploadPayslipAction,
    initialAdminPayslipActionState,
  );
  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        value: employee.id,
        label: employee.name,
        meta: employee.email,
      })),
    [employees],
  );
  const visibleMonths = useMemo(
    () => getPayslipMonthWindow(locale, currentMonth, yearPage),
    [currentMonth, locale, yearPage],
  );
  const visibleYear = visibleMonths[0]?.yearLabel ?? "";

  useEffect(() => {
    if (state.status !== "success") return;
    onOpenChange(false);
    router.refresh();
  }, [onOpenChange, router, state.status]);

  function selectFile(file: File | null) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setSelectedFile(null);
      setClientError(t("errors.pdfRequired"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSelectedFile(null);
      setClientError(t("errors.fileTooLarge"));
      return;
    }
    setClientError(null);
    setSelectedFile(file);
  }

  function changeYearPage(nextPage: number) {
    setYearPage(nextPage);
    setSelectedMonth("");
  }

  return (
    <Dialog open={Boolean(context)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" closeLabel={t("actions.close")}>
        <form action={formAction} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{t("admin.upload.title")}</DialogTitle>
            <DialogDescription>{t("admin.upload.description")}</DialogDescription>
          </DialogHeader>
          <Field label={t("admin.upload.employee")} required>
            <Combobox
              name="employeeMemberId"
              label={t("admin.upload.employee")}
              options={employeeOptions}
              value={selectedEmployee}
              placeholder={t("admin.upload.employeePlaceholder")}
              labels={{
                search: t("admin.filters.search"),
                searchPlaceholder: t("admin.filters.search"),
                empty: t("admin.list.empty"),
              }}
              required
              onValueChange={setSelectedEmployee}
            />
          </Field>
          <Field label={t("admin.upload.month")} required>
            <input
              type="hidden"
              name="periodStart"
              value={selectedMonth ? `${selectedMonth}-01` : ""}
            />
            <div
              className="mb-2 flex items-center justify-between gap-3"
              role="group"
              aria-label={t("admin.upload.monthNavigation")}
            >
              <IconButton
                icon={ChevronLeft}
                label={t("admin.upload.previousYear")}
                size="sm"
                variant="ghost"
                onClick={() => changeYearPage(yearPage + 1)}
              />
              <span className="text-center font-ui text-xs font-semibold text-muted-foreground">
                {visibleYear}
              </span>
              <IconButton
                icon={ChevronRight}
                label={t("admin.upload.nextYear")}
                size="sm"
                variant="ghost"
                onClick={() => changeYearPage(yearPage - 1)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {visibleMonths.map((month) => (
                <button
                  key={month.value}
                  type="button"
                  aria-pressed={month.value === selectedMonth}
                  className={cn(
                    "grid min-h-16 place-items-center rounded-[var(--radius-md)] border px-2 py-2 font-ui text-xs font-bold transition",
                    month.value === selectedMonth
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border bg-secondary/40 text-muted-foreground hover:border-accent/40 hover:text-foreground",
                  )}
                  onClick={() => setSelectedMonth(month.value)}
                >
                  <span className="uppercase">{month.shortLabel}</span>
                  <span className="text-[10px] font-medium">{month.yearLabel}</span>
                </button>
              ))}
            </div>
          </Field>
          <Field label={t("admin.upload.file")} required>
            <label
              htmlFor={inputId}
              className="grid min-h-40 cursor-pointer place-items-center rounded-[var(--radius-lg)] border border-dashed border-accent/45 bg-accent-soft/50 p-6 text-center transition hover:bg-accent-soft"
            >
              <input
                id={inputId}
                name="payslipFile"
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
              />
              {selectedFile ? (
                <span className="grid justify-items-center gap-2">
                  <FileText className="size-7 text-destructive" aria-hidden="true" />
                  <span className="max-w-full truncate font-ui text-sm font-semibold text-foreground">
                    {selectedFile.name}
                  </span>
                  <span className="text-xs text-success">{formatFileSize(selectedFile.size)}</span>
                </span>
              ) : (
                <span className="grid justify-items-center gap-2">
                  <FileUp className="size-7 text-accent" aria-hidden="true" />
                  <span className="font-ui text-sm font-semibold text-foreground">
                    {t("admin.upload.dropzone")}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {t("admin.upload.dropzoneDescription")}
                  </span>
                </span>
              )}
            </label>
            {clientError ? (
              <p className="text-sm font-medium text-destructive">{clientError}</p>
            ) : null}
          </Field>
          {context.replacing ? (
            <p className="rounded-[var(--radius-md)] border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-foreground">
              {t("admin.upload.existing")}
            </p>
          ) : null}
          {state.status === "error" ? (
            <p className="text-sm font-medium text-destructive">{state.message}</p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              {t("actions.cancel")}
            </Button>
            <Button type="submit" icon={UploadCloud} loading={isPending}>
              {context.replacing ? t("actions.confirmReplace") : t("actions.confirmUpload")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PayslipPreviewDialog({
  item,
  onOpenChange,
}: {
  item: AdminPayslipItem | null;
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
              <DialogDescription>{item.employeeName}</DialogDescription>
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

function IconAction({
  label,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  tone?: "danger";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "grid size-8 place-items-center rounded-[var(--radius-sm)] text-muted-foreground transition hover:bg-secondary hover:text-foreground",
        tone === "danger" && "hover:bg-destructive-soft hover:text-destructive",
      )}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
