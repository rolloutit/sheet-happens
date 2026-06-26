"use client";

import { Download, Eye, Upload } from "lucide-react";

import { Avatar } from "@/src/components/ui/Avatar";
import { Badge } from "@/src/components/ui/Badge";
import { IconButton } from "@/src/components/ui/IconButton";
import { DataTable } from "@/src/components/ui/Table";
import { payslipStatusLabels, payslipStatusTone } from "../PayslipStatus";
import type { PayslipAdminRow, PayslipAdminTableProps } from "./PayslipAdminTable.types";

function isAvailable(row: PayslipAdminRow) {
  return row.status === "available";
}

export function PayslipAdminTable({
  rows,
  sort,
  onSortChange,
  onPreview,
  onDownload,
  onUpload,
  onRowOpen,
  loading,
  labels,
  className,
}: PayslipAdminTableProps) {
  return (
    <DataTable
      className={className}
      caption="Payslip admin table"
      aria-label="Payslip admin table"
      rows={rows}
      loading={loading}
      empty={labels?.empty ?? "No payslip rows match the current filters."}
      getRowKey={(row) => row.id}
      rowActionLabel={onRowOpen ? (row) => labels?.open?.(row) ?? `Open ${row.person}` : undefined}
      onRowClick={onRowOpen}
      sort={sort}
      onSortChange={onSortChange}
      displayMode="responsive"
      columns={[
        {
          id: "person",
          header: "Employee",
          sortable: true,
          sortLabel: "employee",
          cell: (row) => (
            <div className="flex items-center gap-3">
              <Avatar name={row.person} size="sm" tone={row.avatarTone} />
              <div>
                <p className="font-ui text-sm font-semibold text-foreground">{row.person}</p>
                {row.email ? <p className="text-xs text-muted-foreground">{row.email}</p> : null}
              </div>
            </div>
          ),
        },
        { id: "month", header: "Month", accessor: "month", sortable: true },
        {
          id: "status",
          header: "Status",
          accessor: "status",
          sortable: true,
          cell: (row) => (
            <Badge tone={payslipStatusTone[row.status]}>{payslipStatusLabels[row.status]}</Badge>
          ),
        },
        {
          id: "file",
          header: "File",
          cell: (row) => row.fileName ?? "No file",
        },
        {
          id: "actions",
          header: "",
          cell: (row) => {
            const available = isAvailable(row);
            return (
              <div className="flex justify-end gap-2">
                {onPreview ? (
                  <IconButton
                    type="button"
                    icon={Eye}
                    label={labels?.preview?.(row) ?? `Preview ${row.person} payslip`}
                    size="sm"
                    disabled={!available}
                    onClick={(event) => {
                      event.stopPropagation();
                      onPreview(row);
                    }}
                  />
                ) : null}
                {onDownload ? (
                  <IconButton
                    type="button"
                    icon={Download}
                    label={labels?.download?.(row) ?? `Download ${row.person} payslip`}
                    size="sm"
                    disabled={!available}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDownload(row);
                    }}
                  />
                ) : null}
                {onUpload ? (
                  <IconButton
                    type="button"
                    icon={Upload}
                    label={labels?.upload?.(row) ?? `Upload ${row.person} payslip`}
                    size="sm"
                    variant="primary"
                    onClick={(event) => {
                      event.stopPropagation();
                      onUpload(row);
                    }}
                  />
                ) : null}
              </div>
            );
          },
          align: "right",
          mobileLabel: "Actions",
        },
      ]}
    />
  );
}
