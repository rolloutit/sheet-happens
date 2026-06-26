"use client";

import { CheckCircle2, FileWarning } from "lucide-react";

import { Avatar } from "@/src/components/ui/Avatar";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Checkbox } from "@/src/components/ui/Checkbox";
import { cn } from "@/src/lib/utils";
import type {
  FlaggedUserItem,
  FlaggedUserListProps,
  FlaggedUserSeverity,
} from "./FlaggedUserList.types";

const severityTone: Record<FlaggedUserSeverity, "info" | "warning" | "danger"> = {
  info: "info",
  warning: "warning",
  danger: "danger",
};

const severityIconClass: Record<FlaggedUserSeverity, string> = {
  info: "text-accent",
  warning: "text-warning",
  danger: "text-destructive",
};

function toggleId(ids: string[], id: string, checked: boolean) {
  if (checked) return ids.includes(id) ? ids : [...ids, id];
  return ids.filter((selectedId) => selectedId !== id);
}

function enabledIds(items: FlaggedUserItem[]) {
  return items.filter((item) => !item.disabled).map((item) => item.id);
}

export function FlaggedUserList({
  title = "Figyelmet igényel",
  description = "Admin teendők a zárás előtt",
  badge,
  badgeTone = "warning",
  items,
  selectedIds = [],
  onSelectedIdsChange,
  onRemind,
  reminderSent,
  labels,
  className,
}: FlaggedUserListProps) {
  const selectableIds = enabledIds(items);
  const selectedSelectableIds = selectedIds.filter((id) => selectableIds.includes(id));
  const allSelected =
    selectableIds.length > 0 && selectedSelectableIds.length === selectableIds.length;
  const someSelected = selectedSelectableIds.length > 0 && !allSelected;
  const selectedCopy =
    labels?.selected?.(selectedSelectableIds.length) ?? `${selectedSelectableIds.length} selected`;

  return (
    <Card variant="elevated" className={className}>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <Badge tone={badgeTone}>{badge ?? `${items.length} jelzés`}</Badge>
      </CardHeader>
      <CardContent>
        {items.length > 0 ? (
          <>
            <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-secondary p-3">
              <label className="flex items-center gap-3 text-sm font-medium">
                <Checkbox
                  aria-label={labels?.selectAll ?? "Select all flagged users"}
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={(checked) => {
                    onSelectedIdsChange?.(checked ? selectableIds : []);
                  }}
                />
                {labels?.selectAll ?? "Összes kijelölése"}
              </label>
              <span className="text-xs text-muted-foreground">{selectedCopy}</span>
            </div>
            {reminderSent ? (
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-success/30 bg-success/10 p-3 text-sm text-success">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                {labels?.sent ?? "Reminder sent"}
              </div>
            ) : null}
            {items.map((item) => {
              const severity = item.severity ?? "warning";
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-secondary p-3",
                    item.disabled && "opacity-60",
                  )}
                >
                  <label className="flex min-w-0 items-center gap-3">
                    <Checkbox
                      aria-label={`Select ${item.name}`}
                      checked={selectedIds.includes(item.id)}
                      disabled={item.disabled}
                      onCheckedChange={(checked) => {
                        onSelectedIdsChange?.(toggleId(selectedIds, item.id, Boolean(checked)));
                      }}
                    />
                    <Avatar name={item.name} size="sm" tone={item.avatarTone ?? "deep"} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{item.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.detail}
                      </span>
                    </span>
                  </label>
                  <Badge tone={severityTone[severity]}>
                    <FileWarning
                      className={cn("size-3.5", severityIconClass[severity])}
                      aria-hidden="true"
                    />
                    {severity}
                  </Badge>
                </div>
              );
            })}
            {onRemind ? (
              <Button
                type="button"
                variant="cta"
                disabled={selectedSelectableIds.length === 0}
                onClick={() => onRemind(selectedSelectableIds)}
              >
                {labels?.remind ?? "Remind selected"}
              </Button>
            ) : null}
          </>
        ) : (
          <div className="rounded-[var(--radius-md)] bg-secondary p-4 text-sm text-muted-foreground">
            {labels?.empty ?? "No flagged users"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
