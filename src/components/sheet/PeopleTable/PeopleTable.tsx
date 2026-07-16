"use client";

import { Edit3, Trash2 } from "lucide-react";

import { Avatar } from "@/src/components/ui/Avatar";
import { Badge } from "@/src/components/ui/Badge";
import { IconButton } from "@/src/components/ui/IconButton";
import { DataTable } from "@/src/components/ui/Table";
import type { BadgeProps } from "@/src/components/ui/Badge";
import type { PeopleTableProps, PersonRowState } from "./PeopleTable.types";

const stateTone: Record<PersonRowState, BadgeProps["tone"]> = {
  active: "success",
  inactive: "neutral",
  invited: "info",
  locked: "warning",
};

export function PeopleTable({
  rows,
  onEdit,
  onDelete,
  onRowOpen,
  rowActions,
  sort,
  onSortChange,
  loading,
  labels,
  className,
}: PeopleTableProps) {
  const columns = labels?.columns;

  return (
    <DataTable
      className={className}
      caption={labels?.caption ?? "People management table"}
      aria-label={labels?.ariaLabel ?? "People management table"}
      rows={rows}
      loading={loading}
      empty={labels?.empty ?? "No people match the current filters."}
      getRowKey={(row) => row.id}
      rowActionLabel={onRowOpen ? (row) => labels?.open?.(row) ?? `Open ${row.name}` : undefined}
      onRowClick={onRowOpen}
      rowActionsLabel={labels?.rowActionsLabel}
      sort={sort}
      onSortChange={onSortChange}
      displayMode="table"
      columns={[
        {
          id: "name",
          header: columns?.person ?? "Person",
          sortable: true,
          sortLabel: columns?.person?.toLowerCase() ?? "person",
          cell: (row) => (
            <div className="flex items-center gap-3">
              <Avatar name={row.name} size="sm" tone={row.avatarTone} />
              <div>
                <p className="font-ui text-sm font-semibold text-foreground">{row.name}</p>
                <p className="text-xs text-muted-foreground">{row.email}</p>
              </div>
            </div>
          ),
        },
        {
          id: "profile",
          header: columns?.profile ?? "Profile",
          accessor: "profile",
          sortable: true,
          cell: (row) => (
            <div className="grid gap-1">
              <Badge tone="cta">
                {row.profileValue
                  ? (labels?.profiles?.[row.profileValue] ?? row.profile)
                  : row.profile}
              </Badge>
              {row.scheduledProfile && row.scheduledProfileValidFrom ? (
                <p className="text-xs text-muted-foreground">
                  {labels?.scheduledProfile
                    ? labels.scheduledProfile(
                        row.scheduledProfileValue
                          ? (labels.profiles?.[row.scheduledProfileValue] ?? row.scheduledProfile)
                          : row.scheduledProfile,
                        row.scheduledProfileValidFrom,
                      )
                    : `Scheduled: ${row.scheduledProfile} on ${row.scheduledProfileValidFrom}`}
                </p>
              ) : null}
            </div>
          ),
        },
        {
          id: "role",
          header: columns?.role ?? "Role",
          accessor: "role",
          sortable: true,
          cell: (row) => (
            <Badge tone={row.roleValue === "ADMIN" ? "warning" : "neutral"}>
              {row.roleValue
                ? (labels?.roles?.[row.roleValue] ?? row.role)
                : (row.role ?? "Member")}
            </Badge>
          ),
        },
        {
          id: "state",
          header: columns?.state ?? "State",
          accessor: "state",
          sortable: true,
          cell: (row) => (
            <Badge tone={stateTone[row.state]}>{labels?.states?.[row.state] ?? row.state}</Badge>
          ),
        },
        {
          id: "currency",
          header: columns?.currency ?? "Currency",
          accessor: "currency",
          sortable: true,
        },
        {
          id: "actions",
          header: "",
          cell: (row) => (
            <div className="flex justify-end gap-2">
              {onEdit ? (
                <IconButton
                  type="button"
                  icon={Edit3}
                  label={labels?.edit?.(row) ?? `Edit ${row.name}`}
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdit(row);
                  }}
                />
              ) : null}
              {onDelete ? (
                <IconButton
                  type="button"
                  icon={Trash2}
                  label={labels?.delete?.(row) ?? `Delete ${row.name}`}
                  size="sm"
                  variant="danger"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(row);
                  }}
                />
              ) : null}
              {rowActions?.(row)}
            </div>
          ),
          align: "right",
        },
      ]}
    />
  );
}
