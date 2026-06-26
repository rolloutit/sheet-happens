"use client";

import { Checkbox } from "@/src/components/ui/Checkbox";
import { DataTable } from "@/src/components/ui/Table";
import { StatusPill } from "../StatusPill";
import type { ReviewQueueRow, ReviewQueueTableProps } from "./ReviewQueueTable.types";

function enabledRowIds(rows: ReviewQueueRow[]) {
  return rows.filter((row) => !row.disabled).map((row) => row.id);
}

function toggleId(ids: string[], id: string, checked: boolean) {
  if (checked) return ids.includes(id) ? ids : [...ids, id];
  return ids.filter((selectedId) => selectedId !== id);
}

export function ReviewQueueTable({
  rows,
  selectedIds = [],
  onSelectedIdsChange,
  onRowOpen,
  sort,
  onSortChange,
  loading,
  labels,
  className,
}: ReviewQueueTableProps) {
  const selectableIds = enabledRowIds(rows);
  const selectedSelectableIds = selectedIds.filter((id) => selectableIds.includes(id));
  const allSelected =
    selectableIds.length > 0 && selectedSelectableIds.length === selectableIds.length;
  const someSelected = selectedSelectableIds.length > 0 && !allSelected;

  return (
    <DataTable
      className={className}
      caption="Admin review queue"
      aria-label="Admin review queue"
      rows={rows}
      loading={loading}
      empty={labels?.empty ?? "No timesheets match the current filters."}
      getRowKey={(row) => row.id}
      selectedRowKeys={selectedIds}
      rowActionLabel={
        onRowOpen ? (row) => labels?.openRow?.(row) ?? `Open ${row.person}` : undefined
      }
      onRowClick={onRowOpen}
      sort={sort}
      onSortChange={onSortChange}
      displayMode="table"
      columns={[
        {
          id: "select",
          header: (
            <Checkbox
              aria-label={labels?.selectAll ?? "Select all submitted rows"}
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={(checked) => {
                onSelectedIdsChange?.(checked ? selectableIds : []);
              }}
            />
          ),
          cell: (row) => (
            <span
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <Checkbox
                aria-label={labels?.selectRow?.(row) ?? `Select ${row.person}`}
                checked={selectedIds.includes(row.id)}
                disabled={row.disabled}
                onCheckedChange={(checked) => {
                  onSelectedIdsChange?.(toggleId(selectedIds, row.id, Boolean(checked)));
                }}
              />
            </span>
          ),
          width: "3rem",
          mobileLabel: "Select",
        },
        {
          id: "person",
          header: "Person",
          accessor: "person",
          sortable: true,
          mobileLabel: "Person",
        },
        { id: "period", header: "Period", accessor: "period", sortable: true },
        { id: "project", header: "Project", accessor: "project", sortable: true },
        {
          id: "status",
          header: "Status",
          cell: (row) => <StatusPill status={row.status} />,
        },
        {
          id: "amount",
          header: "Amount",
          accessor: "amount",
          align: "right",
          sortable: true,
        },
      ]}
    />
  );
}
