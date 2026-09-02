"use client";

import { Badge } from "@/src/components/ui/Badge";
import { ProjectColorSwatch } from "@/src/components/ui/ProjectColorSwatch";
import { DataTable } from "@/src/components/ui/Table";
import type { ProjectGroupTableRow, ProjectGroupsTableProps } from "./ProjectGroupsTable.types";

/** Swatch dots collapse into "+N" past this count so a large group doesn't blow out the row. */
const MAX_VISIBLE_SWATCHES = 6;
/** Named projects shown inline before folding the rest into "+N more". */
const MAX_VISIBLE_NAMES = 2;

export function ProjectGroupsTable({
  rows,
  onOpenGroup,
  rowActions,
  sort,
  onSortChange,
  loading,
  labels,
  className,
}: ProjectGroupsTableProps) {
  return (
    <DataTable
      className={className}
      caption={labels.caption}
      aria-label={labels.ariaLabel}
      rows={rows}
      loading={loading}
      empty={labels.empty}
      getRowKey={(row) => row.id}
      // Row click is a mouse convenience only — DataTable drops keyboard interactivity on the
      // row itself once `rowActions` is set (see Table.tsx), so the group name below carries its
      // own `aria-label` and renders as a real button, and "Manage projects" is also the first
      // item in the row's ⋯ menu. `rowActionLabel` is intentionally not passed: DataTable only
      // reads it on the keyboard-interactive path, which `rowActions` here rules out.
      onRowClick={onOpenGroup}
      rowActions={rowActions}
      rowActionsLabel={labels.rowActionsLabel}
      sort={sort}
      onSortChange={onSortChange}
      displayMode="responsive"
      density="comfortable"
      columns={[
        {
          id: "name",
          header: labels.columns.group,
          mobileLabel: labels.columns.group,
          sortable: true,
          cell: (row) => (
            <div className="grid min-w-0 gap-1">
              <button
                type="button"
                aria-label={labels.openGroup(row)}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenGroup(row);
                }}
                className="w-fit truncate text-left font-ui text-sm font-semibold text-foreground underline-offset-2 hover:text-accent hover:underline"
              >
                {row.name}
              </button>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <code className="rounded-[var(--radius-sm)] bg-secondary px-1.5 py-0.5 font-mono">
                  {row.slug}
                </code>
              </div>
              {row.description ? (
                <p className="line-clamp-1 max-w-md text-xs leading-5 text-muted-foreground">
                  {row.description}
                </p>
              ) : null}
            </div>
          ),
        },
        {
          id: "projects",
          header: labels.columns.projects,
          mobileLabel: labels.columns.projects,
          sortable: true,
          sortLabel: labels.columns.projects,
          cell: (row) => <ProjectGroupProjectsCell row={row} labels={labels} />,
        },
        {
          id: "state",
          header: labels.columns.state,
          mobileLabel: labels.columns.state,
          sortable: true,
          cell: (row) => (
            <Badge tone={row.active ? "success" : "neutral"}>
              {row.active ? labels.states.active : labels.states.inactive}
            </Badge>
          ),
        },
        {
          id: "updated",
          header: labels.columns.updated,
          mobileLabel: labels.columns.updated,
          sortable: true,
          cell: (row) => (
            <span className="text-sm text-muted-foreground">{row.updatedAtLabel}</span>
          ),
        },
      ]}
    />
  );
}

function ProjectGroupProjectsCell({
  row,
  labels,
}: {
  row: ProjectGroupTableRow;
  labels: ProjectGroupsTableProps["labels"];
}) {
  if (row.projects.length === 0) {
    return <span className="text-sm text-muted-foreground">{labels.noProjects}</span>;
  }

  const visibleSwatches = row.projects.slice(0, MAX_VISIBLE_SWATCHES);
  const hiddenSwatchCount = row.projects.length - visibleSwatches.length;
  const visibleNames = row.projects.slice(0, MAX_VISIBLE_NAMES).map((project) => project.name);
  const hiddenNameCount = row.projects.length - visibleNames.length;

  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1">
        {visibleSwatches.map((project) => (
          <ProjectColorSwatch key={project.id} colorToken={project.colorToken} size="sm" />
        ))}
        {hiddenSwatchCount > 0 ? (
          <span className="font-ui text-[10px] font-semibold text-muted-foreground">
            +{hiddenSwatchCount}
          </span>
        ) : null}
        <span className="ml-1 text-sm text-muted-foreground">
          {labels.projectCount(row.projectCount)}
        </span>
      </div>
      <p className="max-w-xs truncate text-xs text-muted-foreground">
        {visibleNames.join(", ")}
        {hiddenNameCount > 0 ? ` ${labels.moreProjects(hiddenNameCount)}` : ""}
      </p>
    </div>
  );
}
