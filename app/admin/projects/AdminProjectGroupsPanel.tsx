"use client";

import { Archive, Edit3, MoreHorizontal, Search, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { FilterChips } from "@/src/components/sheet/FilterChips";
import type { FilterChip } from "@/src/components/sheet/FilterChips";
import { ProjectGroupsTable } from "@/src/components/sheet/ProjectGroupsTable";
import type { ProjectGroupTableRow } from "@/src/components/sheet/ProjectGroupsTable";
import { Button } from "@/src/components/ui/Button";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from "@/src/components/ui/Dropdown";
import { IconButton } from "@/src/components/ui/IconButton";
import { Input } from "@/src/components/ui/Input";
import { ResultBanner } from "@/src/components/ui/ResultBanner";
import { Select } from "@/src/components/ui/Select";
import type { TableSort } from "@/src/components/ui/Table";
import { usePickerLabels } from "@/src/i18n/picker-labels";
import { formatTimestamp } from "@/src/lib/formatting/dates";
import { useOverlayParam } from "@/src/lib/use-overlay-param";
import type { AdminProjectGroupRow, AdminProjectOptionRow } from "@/src/server/projects";
import {
  addProjectToGroupAction,
  archiveProjectGroupAction,
  createProjectGroupAction,
  removeProjectFromGroupAction,
  updateProjectGroupAction,
} from "./actions";
import type { ProjectGroupActionState, ProjectGroupProjectActionState } from "./actions.types";
import { PROJECT_GROUP_OVERLAY_VALUE, PROJECT_OVERLAY_PARAM } from "./project-overlays";
import { ProjectGroupArchiveDialog } from "./ProjectGroupArchiveDialog";
import { ProjectGroupCreateButton } from "./ProjectGroupCreateButton";
import { ProjectGroupFormDrawer } from "./ProjectGroupFormDrawer";
import { ProjectGroupManageDrawer } from "./ProjectGroupManageDrawer";

export type AdminProjectGroupsPanelProps = {
  groups: AdminProjectGroupRow[];
  projects: AdminProjectOptionRow[];
};

const initialGroupState: ProjectGroupActionState = {
  status: "idle",
  message: "",
};

const initialGroupProjectState: ProjectGroupProjectActionState = {
  status: "idle",
  message: "",
};

type ProjectGroupStateFilter = "all" | "active" | "inactive";
type ProjectGroupOccupancyFilter = "all" | "empty" | "withProjects";
type ProjectGroupFilterKey = "q" | "state" | "occupancy";

export function AdminProjectGroupsPanel({ groups, projects }: AdminProjectGroupsPanelProps) {
  const t = useTranslations("AdminProjects");
  const locale = useLocale();
  const router = useRouter();

  const [groupQuery, setGroupQuery] = useState("");
  const [groupStateFilter, setGroupStateFilter] = useState<ProjectGroupStateFilter>("all");
  const [groupOccupancyFilter, setGroupOccupancyFilter] =
    useState<ProjectGroupOccupancyFilter>("all");
  const [sort, setSort] = useState<TableSort | null>(null);

  const [createOpen, setCreateOpen] = useOverlayParam(
    PROJECT_OVERLAY_PARAM,
    PROJECT_GROUP_OVERLAY_VALUE,
  );
  const [createState, setCreateState] = useState<ProjectGroupActionState>(initialGroupState);
  /** Results of the panel's own row actions — archiving a group has no form to report into. */
  const [panelState, setPanelState] = useState<ProjectGroupActionState>(initialGroupState);
  const [linkState, setLinkState] =
    useState<ProjectGroupProjectActionState>(initialGroupProjectState);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  // Ids rather than snapshots: `groups` refetches after every `router.refresh()`, so deriving
  // from the latest array below keeps an open drawer showing live membership instead of a stale
  // copy from the moment it opened.
  const [manageGroupId, setManageGroupId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editState, setEditState] = useState<ProjectGroupActionState>(initialGroupState);
  const [archivingGroupId, setArchivingGroupId] = useState<string | null>(null);

  const [, startTransition] = useTransition();

  const manageGroup = groups.find((group) => group.id === manageGroupId) ?? null;
  const editingGroup = groups.find((group) => group.id === editingGroupId) ?? null;
  const archivingGroup = groups.find((group) => group.id === archivingGroupId) ?? null;

  const filteredGroups = useMemo(() => {
    const normalizedQuery = groupQuery.trim().toLowerCase();

    return groups.filter((group) => {
      if (
        normalizedQuery &&
        !group.name.toLowerCase().includes(normalizedQuery) &&
        !group.slug.toLowerCase().includes(normalizedQuery) &&
        !(group.description ?? "").toLowerCase().includes(normalizedQuery) &&
        !group.projects.some((project) => project.name.toLowerCase().includes(normalizedQuery))
      ) {
        return false;
      }

      if (groupStateFilter === "active" && !group.active) return false;
      if (groupStateFilter === "inactive" && group.active) return false;
      if (groupOccupancyFilter === "empty" && group.projectCount > 0) return false;
      if (groupOccupancyFilter === "withProjects" && group.projectCount === 0) return false;

      return true;
    });
  }, [groups, groupQuery, groupStateFilter, groupOccupancyFilter]);

  const sortedGroups = useMemo(
    () => sortProjectGroups(filteredGroups, sort),
    [filteredGroups, sort],
  );

  const tableRows: ProjectGroupTableRow[] = useMemo(
    () =>
      sortedGroups.map((group) => ({
        id: group.id,
        name: group.name,
        slug: group.slug,
        description: group.description,
        active: group.active,
        projectCount: group.projectCount,
        projects: group.projects,
        updatedAtLabel: formatTimestamp(group.updatedAt, locale),
      })),
    [sortedGroups, locale],
  );

  const isFiltered =
    Boolean(groupQuery.trim()) || groupStateFilter !== "all" || groupOccupancyFilter !== "all";

  const activeFilters: FilterChip<ProjectGroupFilterKey>[] = [];

  if (groupQuery.trim()) {
    activeFilters.push({
      id: "q",
      label: groupQuery.trim(),
      aria: `${t("groupsPanel.filters.search")}: ${groupQuery.trim()}`,
      leading: <Search className="size-3" aria-hidden="true" />,
    });
  }
  if (groupStateFilter !== "all") {
    activeFilters.push({
      id: "state",
      label: `${t("groupsPanel.filters.state")}: ${
        groupStateFilter === "active" ? t("states.active") : t("states.inactive")
      }`,
    });
  }
  if (groupOccupancyFilter !== "all") {
    activeFilters.push({
      id: "occupancy",
      label: `${t("groupsPanel.filters.projects")}: ${
        groupOccupancyFilter === "withProjects"
          ? t("groupsPanel.filters.withProjects")
          : t("groupsPanel.filters.empty")
      }`,
    });
  }

  function clearFilters() {
    setGroupQuery("");
    setGroupStateFilter("all");
    setGroupOccupancyFilter("all");
  }

  function removeFilter(key: ProjectGroupFilterKey) {
    if (key === "q") setGroupQuery("");
    if (key === "state") setGroupStateFilter("all");
    if (key === "occupancy") setGroupOccupancyFilter("all");
  }

  function runGroupAction(
    key: string,
    callback: () => Promise<ProjectGroupActionState>,
    options: {
      onResult?: (result: ProjectGroupActionState) => void;
      onSuccess?: () => void;
    } = {},
  ) {
    setPendingKey(key);

    startTransition(async () => {
      const result = await callback();
      options.onResult?.(result);
      setPendingKey(null);

      if (result.status === "success") {
        options.onSuccess?.();
        router.refresh();
      }
    });
  }

  function toggleGroupProject(groupId: string, projectId: string, next: boolean) {
    const key = `${groupId}:${projectId}:${next ? "add" : "remove"}`;

    setPendingKey(key);
    setLinkState(initialGroupProjectState);

    startTransition(async () => {
      const result = next
        ? await addProjectToGroupAction({ projectGroupId: groupId, projectId })
        : await removeProjectFromGroupAction({ projectGroupId: groupId, projectId });

      setLinkState(result);
      setPendingKey(null);

      if (result.status === "success") router.refresh();
    });
  }

  const pendingProjectIds =
    manageGroupId && pendingKey?.startsWith(`${manageGroupId}:`) ? [pendingKey.split(":")[1]] : [];

  return (
    <div className="grid gap-4">
      {panelState.message ? (
        <ResultBanner tone={panelState.status === "error" ? "error" : "success"}>
          {panelState.message}
        </ResultBanner>
      ) : null}
      {linkState.message ? (
        <ResultBanner tone={linkState.status === "error" ? "error" : "success"}>
          {linkState.message}
        </ResultBanner>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-border bg-card p-3">
        <div className="min-w-[13rem] flex-1">
          <Input
            type="search"
            value={groupQuery}
            aria-label={t("groupsPanel.filters.search")}
            placeholder={t("groupsPanel.filters.searchPlaceholder")}
            onChange={(event) => setGroupQuery(event.currentTarget.value)}
          />
        </div>
        <div className="w-[calc(50%-0.25rem)] sm:w-auto sm:min-w-32 sm:max-w-64">
          <GroupStateSelect value={groupStateFilter} onValueChange={setGroupStateFilter} />
        </div>
        <div className="w-[calc(50%-0.25rem)] sm:w-auto sm:min-w-32 sm:max-w-64">
          <GroupOccupancySelect
            value={groupOccupancyFilter}
            onValueChange={setGroupOccupancyFilter}
          />
        </div>
      </div>

      <FilterChips
        chips={activeFilters}
        labels={{
          active: t("filters.active"),
          clear: t("filters.clear"),
          remove: (filter) => t("filters.removeFilter", { filter }),
        }}
        onRemove={removeFilter}
        onClear={clearFilters}
        summary={t("groupsPanel.filters.showing", {
          count: filteredGroups.length,
          total: groups.length,
        })}
      />

      <ProjectGroupsTable
        rows={tableRows}
        onOpenGroup={(row) => setManageGroupId(row.id)}
        sort={sort}
        onSortChange={setSort}
        labels={{
          caption: t("groupsTable.caption"),
          ariaLabel: t("groupsTable.ariaLabel"),
          openGroup: (row) => t("groupsTable.openGroup", { name: row.name }),
          rowActionsLabel: t("actions.menuLabel"),
          columns: {
            group: t("groupsTable.columns.group"),
            projects: t("groupsTable.columns.projects"),
            state: t("groupsTable.columns.state"),
            updated: t("groupsTable.columns.updated"),
          },
          states: { active: t("states.active"), inactive: t("states.inactive") },
          noProjects: t("groupsPanel.noProjects"),
          projectCount: (count) => t("groupsPanel.projectCount", { count }),
          moreProjects: (count) => t("groupsTable.moreProjects", { count }),
          empty: (
            <div className="grid justify-items-center gap-4">
              <p>{isFiltered ? t("groupsPanel.emptyFiltered") : t("groupsPanel.empty")}</p>
              {isFiltered ? (
                <Button type="button" variant="ghost" icon={X} onClick={clearFilters}>
                  {t("filters.clear")}
                </Button>
              ) : (
                <ProjectGroupCreateButton variant="soft" />
              )}
            </div>
          ),
        }}
        rowActions={(row) => (
          <Dropdown>
            <DropdownTrigger asChild>
              <IconButton
                icon={MoreHorizontal}
                label={t("actions.openFor", { name: row.name })}
                size="sm"
                variant="ghost"
              />
            </DropdownTrigger>
            <DropdownContent align="end">
              <DropdownLabel>{t("actions.menuLabel")}</DropdownLabel>
              <DropdownItem onSelect={() => setManageGroupId(row.id)}>
                {t("actions.manageProjects")}
              </DropdownItem>
              <DropdownItem onSelect={() => setEditingGroupId(row.id)}>
                <Edit3 className="size-4" aria-hidden="true" />
                {t("actions.editGroup")}
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem tone="danger" onSelect={() => setArchivingGroupId(row.id)}>
                <Archive className="size-4" aria-hidden="true" />
                {t("actions.archive")}
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        )}
      />

      <ProjectGroupManageDrawer
        group={manageGroup}
        projects={projects}
        pendingProjectIds={pendingProjectIds}
        onOpenChange={(open) => {
          if (!open) setManageGroupId(null);
        }}
        onEditGroup={() => {
          if (manageGroup) setEditingGroupId(manageGroup.id);
        }}
        onToggleProject={(projectId, next) => {
          if (manageGroup) toggleGroupProject(manageGroup.id, projectId, next);
        }}
      />

      <ProjectGroupFormDrawer
        open={createOpen || Boolean(editingGroup)}
        group={editingGroup}
        pending={
          editingGroup ? pendingKey === `${editingGroup.id}:edit` : pendingKey === "group:create"
        }
        actionState={editingGroup ? editState : createState}
        onOpenChange={(open) => {
          if (open) return;

          if (editingGroup) {
            setEditingGroupId(null);
            setEditState(initialGroupState);
            return;
          }

          setCreateOpen(false);
          setCreateState(initialGroupState);
        }}
        onSubmit={(values) => {
          if (editingGroup) {
            runGroupAction(
              `${editingGroup.id}:edit`,
              () => updateProjectGroupAction({ projectGroupId: editingGroup.id, ...values }),
              {
                onResult: setEditState,
                onSuccess: () => {
                  setEditingGroupId(null);
                  setEditState(initialGroupState);
                },
              },
            );
            return;
          }

          runGroupAction("group:create", () => createProjectGroupAction(values), {
            onResult: setCreateState,
            onSuccess: () => {
              setCreateOpen(false);
              setCreateState(initialGroupState);
            },
          });
        }}
      />

      <ProjectGroupArchiveDialog
        group={archivingGroup}
        pending={archivingGroup ? pendingKey === `${archivingGroup.id}:archive` : false}
        onOpenChange={(open) => {
          if (!open) setArchivingGroupId(null);
        }}
        onConfirm={(group) => {
          runGroupAction(`${group.id}:archive`, () => archiveProjectGroupAction(group.id), {
            onResult: setPanelState,
            onSuccess: () => setArchivingGroupId(null),
          });
        }}
      />
    </div>
  );
}

function GroupStateSelect({
  value,
  onValueChange,
}: {
  value: ProjectGroupStateFilter;
  onValueChange: (value: ProjectGroupStateFilter) => void;
}) {
  const t = useTranslations("AdminProjects");
  const pickerLabels = usePickerLabels();

  return (
    <Select
      label={t("groupsPanel.filters.state")}
      value={value}
      labels={pickerLabels.combobox}
      onValueChange={(next) => onValueChange(next as ProjectGroupStateFilter)}
      options={[
        { value: "all", label: t("filters.all") },
        { value: "active", label: t("states.active") },
        { value: "inactive", label: t("states.inactive") },
      ]}
    />
  );
}

function GroupOccupancySelect({
  value,
  onValueChange,
}: {
  value: ProjectGroupOccupancyFilter;
  onValueChange: (value: ProjectGroupOccupancyFilter) => void;
}) {
  const t = useTranslations("AdminProjects");
  const pickerLabels = usePickerLabels();

  return (
    <Select
      label={t("groupsPanel.filters.projects")}
      value={value}
      labels={pickerLabels.combobox}
      onValueChange={(next) => onValueChange(next as ProjectGroupOccupancyFilter)}
      options={[
        { value: "all", label: t("filters.all") },
        { value: "withProjects", label: t("groupsPanel.filters.withProjects") },
        { value: "empty", label: t("groupsPanel.filters.empty") },
      ]}
    />
  );
}

function sortProjectGroups(rows: AdminProjectGroupRow[], sort: TableSort | null) {
  if (!sort) return rows;

  const direction = sort.direction === "ascending" ? 1 : -1;

  return [...rows].sort((a, b) => {
    switch (sort.columnId) {
      case "projects":
        return (a.projectCount - b.projectCount) * direction;
      case "state":
        return (Number(a.active) - Number(b.active)) * direction;
      case "updated":
        return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * direction;
      case "name":
      default:
        return a.name.localeCompare(b.name) * direction;
    }
  });
}
