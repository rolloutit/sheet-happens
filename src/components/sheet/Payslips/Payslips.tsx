"use client";

import { Download, Eye } from "lucide-react";

import { cn } from "@/src/lib/utils";
import { PayslipAdminTable } from "../PayslipAdminTable";
import { PayslipMonthList } from "../PayslipMonthList";
import { PayslipSummaryCard } from "../PayslipSummaryCard";
import { PayslipUploadPanel } from "../PayslipUploadPanel";
import { PayslipViewer } from "../PayslipViewer";
import type { PayslipAdminRow } from "../PayslipAdminTable";
import type { PayslipMonthItem } from "../PayslipMonthList";
import type { PayslipsProps } from "./Payslips.types";

const defaultMonths = [
  {
    id: "june-2026",
    month: "June 2026",
    status: "available",
    fileName: "payslip-june.pdf",
    meta: "Published by payroll today.",
  },
  {
    id: "may-2026",
    month: "May 2026",
    status: "available",
    fileName: "payslip-may.pdf",
    meta: "Downloaded 2 times.",
  },
  {
    id: "april-2026",
    month: "April 2026",
    status: "missing",
    meta: "Payroll has not published this payslip yet.",
  },
] satisfies PayslipMonthItem[];

const defaultAdminRows = [
  {
    id: "1",
    person: "Lena Kovacs",
    email: "lena@example.com",
    month: "June 2026",
    status: "available",
    fileName: "payslip-june.pdf",
  },
  {
    id: "2",
    person: "Mark Chen",
    email: "mark@example.com",
    month: "June 2026",
    status: "missing",
  },
] satisfies PayslipAdminRow[];

export function Payslips({
  role = "employee",
  latest,
  months = defaultMonths,
  selectedPayslipId,
  viewer,
  adminRows = defaultAdminRows,
  adminSort,
  uploadFiles = [{ id: "1", name: "lena-june.pdf", sizeLabel: "188 KB", status: "done" }],
  uploadEmployee = "Lena Kovacs",
  uploadMonth = "June 2026",
  onAdminSortChange,
  onPreviewPayslip,
  onDownloadPayslip,
  onUploadFilesSelected,
  onUpload,
  onAdminPreview,
  onAdminDownload,
  onAdminUpload,
  className,
}: PayslipsProps) {
  const latestPayslip = latest ?? months[0];
  const latestAvailable = latestPayslip?.status === "available";

  return (
    <div className={cn("grid gap-4", className)}>
      {role === "employee" && latestPayslip ? (
        <>
          <PayslipSummaryCard
            title={`${latestPayslip.month} payslip`}
            status={latestPayslip.status}
            statusLabel={latestAvailable ? "Latest available" : undefined}
            meta={latestPayslip.meta}
            secondaryAction={{
              label: "Preview",
              icon: Eye,
              variant: "soft",
              disabled: !latestAvailable,
              onClick: latestAvailable ? () => onPreviewPayslip?.(latestPayslip) : undefined,
            }}
            primaryAction={{
              label: "Download",
              icon: Download,
              variant: "cta",
              disabled: !latestAvailable,
              onClick: latestAvailable ? () => onDownloadPayslip?.(latestPayslip) : undefined,
            }}
          />
          <PayslipMonthList
            items={months}
            selectedId={selectedPayslipId}
            onPreview={onPreviewPayslip}
            onDownload={onDownloadPayslip}
          />
        </>
      ) : null}
      {role === "admin" ? (
        <>
          <PayslipUploadPanel
            selectedEmployee={uploadEmployee}
            selectedMonth={uploadMonth}
            files={uploadFiles}
            onFilesSelected={onUploadFilesSelected}
            onUpload={onUpload}
          />
          <PayslipAdminTable
            rows={adminRows}
            sort={adminSort}
            onSortChange={onAdminSortChange}
            onPreview={onAdminPreview}
            onDownload={onAdminDownload}
            onUpload={onAdminUpload}
          />
        </>
      ) : null}
      <PayslipViewer {...viewer} />
    </div>
  );
}
