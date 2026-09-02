"use client";

import { Loader2 } from "lucide-react";
import { useId, useMemo } from "react";

import { Badge } from "@/src/components/ui/Badge";
import { Checkbox } from "@/src/components/ui/Checkbox";
import { foldText } from "@/src/components/ui/Command";
import { Input } from "@/src/components/ui/Input";
import { ProjectColorSwatch } from "@/src/components/ui/ProjectColorSwatch";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import { cn } from "@/src/lib/utils";
import type {
  ProjectPickerFilter,
  ProjectPickerLabels,
  ProjectPickerOption,
  ProjectPickerProps,
} from "./ProjectPicker.types";

/**
 * A searchable, filterable checkbox list for adding/removing projects from a group.
 *
 * Each toggle is applied immediately by the caller (there is no "save" step here — see
 * `onToggle`), so this component only ever renders the current membership plus an in-flight
 * spinner for rows the caller has marked `pendingIds`.
 */
export function ProjectPicker({
  projects,
  selectedIds,
  pendingIds = [],
  onToggle,
  filter,
  onFilterChange,
  query,
  onQueryChange,
  labels,
  className,
}: ProjectPickerProps) {
  const baseId = useId();
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const pendingIdSet = useMemo(() => new Set(pendingIds), [pendingIds]);

  const scopedProjects = useMemo(() => {
    if (filter === "inGroup") return projects.filter((project) => selectedIdSet.has(project.id));
    if (filter === "available") return projects.filter((project) => !selectedIdSet.has(project.id));
    return projects;
  }, [projects, filter, selectedIdSet]);

  const visibleProjects = useMemo(() => {
    const needle = foldText(query.trim());

    if (!needle) return scopedProjects;

    return scopedProjects.filter((project) => {
      const haystack = foldText(`${project.name} ${project.slug}`);
      return haystack.includes(needle);
    });
  }, [scopedProjects, query]);

  const availableCount = projects.length - selectedIdSet.size;
  const emptyMessage =
    filter === "available" && availableCount === 0 && !query.trim()
      ? labels.noneAvailable
      : labels.noMatches;

  return (
    <div className={cn("grid gap-3", className)}>
      <SegmentedControl
        label={labels.filterGroupLabel}
        value={filter}
        onValueChange={(value) => onFilterChange(value as ProjectPickerFilter)}
        size="sm"
        width="full"
        items={[
          { value: "all", label: labels.filters.all, count: projects.length },
          { value: "inGroup", label: labels.filters.inGroup, count: selectedIdSet.size },
          { value: "available", label: labels.filters.available, count: availableCount },
        ]}
      />

      <Input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.currentTarget.value)}
        aria-label={labels.searchLabel}
        placeholder={labels.searchPlaceholder}
      />

      <div className="grid max-h-[24rem] content-start gap-1 overflow-y-auto rounded-[var(--radius-lg)] border border-border bg-card p-2">
        {visibleProjects.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          visibleProjects.map((project) => (
            <ProjectPickerRow
              key={project.id}
              id={`${baseId}-${project.id}`}
              project={project}
              checked={selectedIdSet.has(project.id)}
              pending={pendingIdSet.has(project.id)}
              labels={labels}
              onToggle={onToggle}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ProjectPickerRow({
  id,
  project,
  checked,
  pending,
  labels,
  onToggle,
}: {
  id: string;
  project: ProjectPickerOption;
  checked: boolean;
  pending: boolean;
  labels: ProjectPickerLabels;
  onToggle: (id: string, next: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 transition",
        checked ? "bg-accent-soft" : "hover:bg-secondary/45",
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        disabled={pending}
        aria-label={labels.toggleLabel(project)}
        onCheckedChange={(next) => onToggle(project.id, next === true)}
      />
      <label htmlFor={id} className="flex min-w-0 cursor-pointer items-center gap-2">
        <ProjectColorSwatch colorToken={project.colorToken} size="sm" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">{project.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{project.slug}</span>
        </span>
        {project.isInternal ? <Badge tone="cta">{labels.badges.internal}</Badge> : null}
        {project.status === "INACTIVE" ? (
          <Badge tone="neutral">{labels.badges.inactive}</Badge>
        ) : null}
        {project.status === "ARCHIVED" ? (
          <Badge tone="neutral">{labels.badges.archived}</Badge>
        ) : null}
      </label>
      {pending ? (
        <Loader2
          className="size-4 shrink-0 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      ) : (
        <span aria-hidden="true" />
      )}
    </div>
  );
}
