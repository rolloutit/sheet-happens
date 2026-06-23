import { cn } from "@/src/lib/utils";
import type { DataTableProps } from "./Table.types";

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  getRowKey,
  empty,
  selectedRowKeys = [],
  onRowClick,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        {empty ?? "No rows to show"}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-secondary/80 text-left font-ui text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  style={{ width: column.width }}
                  className={cn(
                    "px-4 py-3 font-semibold",
                    column.align === "right" && "text-right",
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const key = getRowKey(row, index);
              const selected = selectedRowKeys.includes(key);
              return (
                <tr
                  key={key}
                  className={cn(
                    "border-t border-border transition",
                    selected && "bg-primary/10",
                    onRowClick && "cursor-pointer hover:bg-secondary/60",
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={cn(
                        "px-4 py-3 text-muted-foreground",
                        column.align === "right" && "text-right",
                        column.align === "center" && "text-center",
                      )}
                    >
                      {column.cell
                        ? column.cell(row)
                        : String(row[column.accessor ?? column.id] ?? "")}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
