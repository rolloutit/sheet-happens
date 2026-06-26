import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { cn } from "@/src/lib/utils";
import type { DataTableProps, TableColumn, TableSortDirection } from "./Table.types";

function getCellValue<T extends Record<string, unknown>>(row: T, column: TableColumn<T>) {
  if (column.cell) return column.cell(row);
  return String(row[column.accessor ?? column.id] ?? "");
}

function getSortLabel<T extends Record<string, unknown>>(column: TableColumn<T>) {
  if (column.sortLabel) return column.sortLabel;
  return typeof column.header === "string" ? column.header : column.id;
}

function getNextSortDirection(
  currentDirection: TableSortDirection | undefined,
  defaultDirection: TableSortDirection,
) {
  if (!currentDirection) return defaultDirection;
  return currentDirection === "ascending" ? "descending" : "ascending";
}

function SortIcon({ direction }: { direction?: TableSortDirection }) {
  if (direction === "ascending") return <ArrowUp className="size-3.5" aria-hidden="true" />;
  if (direction === "descending") return <ArrowDown className="size-3.5" aria-hidden="true" />;
  return <ArrowUpDown className="size-3.5" aria-hidden="true" />;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  getRowKey,
  caption,
  "aria-label": ariaLabel,
  empty,
  selectedRowKeys = [],
  onRowClick,
  rowActionLabel,
  rowActions,
  rowActionsHeader,
  rowActionsLabel = "Row actions",
  sort,
  onSortChange,
  defaultSortDirection = "ascending",
  displayMode = "table",
  density = "comfortable",
  loading,
  loadingRows = 4,
  className,
}: DataTableProps<T>) {
  const cellPadding = density === "compact" ? "px-3 py-2" : "px-4 py-3";
  const responsiveMode = displayMode === "responsive";
  const renderTable = displayMode !== "cards";
  const renderCards = displayMode !== "table";

  if (!loading && rows.length === 0) {
    return (
      <div
        className={cn(
          "rounded-[var(--radius-lg)] border border-border bg-card p-8 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        {empty ?? "No rows to show"}
      </div>
    );
  }

  return (
    <div
      aria-busy={loading || undefined}
      className={cn(
        "overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card",
        className,
      )}
    >
      {renderTable ? (
        <div className={cn("overflow-x-auto", responsiveMode && "hidden md:block")}>
          <table className="min-w-full border-collapse text-sm" aria-label={ariaLabel}>
            {caption ? <caption className="sr-only">{caption}</caption> : null}
            <thead className="bg-secondary/80 text-left font-ui text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {columns.map((column) => {
                  const currentDirection =
                    sort?.columnId === column.id ? sort.direction : undefined;
                  const sortable = Boolean(column.sortable && onSortChange);
                  const nextDirection = getNextSortDirection(
                    currentDirection,
                    defaultSortDirection,
                  );
                  const sortLabel = getSortLabel(column);

                  return (
                    <th
                      key={column.id}
                      style={{ width: column.width }}
                      aria-sort={column.sortable ? (currentDirection ?? "none") : undefined}
                      className={cn(
                        cellPadding,
                        "font-semibold",
                        column.align === "right" && "text-right",
                      )}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            column.align === "right" && "justify-end",
                            column.align === "center" && "justify-center",
                          )}
                          aria-label={`Sort by ${sortLabel} ${nextDirection}`}
                          onClick={() =>
                            onSortChange?.({
                              columnId: column.id,
                              direction: nextDirection,
                            })
                          }
                        >
                          <span>{column.header}</span>
                          <SortIcon direction={currentDirection} />
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
                {rowActions ? (
                  <th className={cn(cellPadding, "text-right font-semibold")}>
                    {rowActionsHeader ?? <span className="sr-only">{rowActionsLabel}</span>}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: loadingRows }, (_, rowIndex) => (
                    <tr key={`loading-${rowIndex}`} className="border-t border-border">
                      {columns.map((column) => (
                        <td key={column.id} className={cn(cellPadding)}>
                          <span className="block h-4 w-full animate-pulse rounded bg-muted" />
                        </td>
                      ))}
                      {rowActions ? (
                        <td className={cn(cellPadding)}>
                          <span className="ml-auto block h-4 w-16 animate-pulse rounded bg-muted" />
                        </td>
                      ) : null}
                    </tr>
                  ))
                : rows.map((row, index) => {
                    const key = getRowKey(row, index);
                    const selected = selectedRowKeys.includes(key);
                    const interactive = Boolean(onRowClick && !rowActions);
                    return (
                      <tr
                        key={key}
                        tabIndex={interactive ? 0 : undefined}
                        role={interactive ? "button" : undefined}
                        aria-label={interactive ? rowActionLabel?.(row, index) : undefined}
                        aria-selected={selected || undefined}
                        className={cn(
                          "border-t border-border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                          selected && "bg-primary/10",
                          onRowClick && "cursor-pointer hover:bg-secondary/60",
                        )}
                        onClick={() => onRowClick?.(row)}
                        onKeyDown={(event) => {
                          if (!interactive) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onRowClick?.(row);
                          }
                        }}
                      >
                        {columns.map((column) => (
                          <td
                            key={column.id}
                            className={cn(
                              cellPadding,
                              "text-muted-foreground",
                              column.align === "right" && "text-right",
                              column.align === "center" && "text-center",
                            )}
                          >
                            {getCellValue(row, column)}
                          </td>
                        ))}
                        {rowActions ? (
                          <td className={cn(cellPadding, "text-right")}>
                            <div
                              className="inline-flex items-center justify-end gap-2"
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              {rowActions(row, index)}
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      ) : null}
      {renderCards ? (
        <div className={cn("grid gap-3 p-3", responsiveMode && "md:hidden")}>
          {loading
            ? Array.from({ length: loadingRows }, (_, rowIndex) => (
                <div
                  key={`mobile-loading-${rowIndex}`}
                  className="grid gap-3 rounded-[var(--radius-md)] border border-border bg-background/40 p-3"
                >
                  {columns.map((column) => (
                    <span key={column.id} className="block h-4 animate-pulse rounded bg-muted" />
                  ))}
                </div>
              ))
            : rows.map((row, index) => {
                const key = getRowKey(row, index);
                const selected = selectedRowKeys.includes(key);
                const interactive = Boolean(onRowClick && !rowActions);
                const content = (
                  <>
                    {columns.map((column) => (
                      <span key={column.id} className="grid grid-cols-[7rem_1fr] gap-3 text-sm">
                        <span className="font-ui text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {column.mobileLabel ?? column.header}
                        </span>
                        <span
                          className={cn(
                            "min-w-0 text-foreground",
                            column.align === "right" && "text-right",
                            column.align === "center" && "text-center",
                          )}
                        >
                          {getCellValue(row, column)}
                        </span>
                      </span>
                    ))}
                    {rowActions ? (
                      <span
                        className="flex justify-end gap-2 border-t border-border pt-3"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        {rowActions(row, index)}
                      </span>
                    ) : null}
                  </>
                );
                const cardClasses = cn(
                  "grid w-full gap-3 rounded-[var(--radius-md)] border border-border bg-background/40 p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected && "border-primary/55 bg-primary/12",
                  interactive && "hover:bg-secondary/70",
                );

                if (interactive) {
                  return (
                    <button
                      key={key}
                      type="button"
                      className={cardClasses}
                      aria-label={rowActionLabel?.(row, index)}
                      aria-pressed={selected || undefined}
                      onClick={() => onRowClick?.(row)}
                    >
                      <span className="grid gap-3">{content}</span>
                    </button>
                  );
                }

                return (
                  <div key={key} className={cardClasses} aria-selected={selected || undefined}>
                    {content}
                  </div>
                );
              })}
        </div>
      ) : null}
    </div>
  );
}
