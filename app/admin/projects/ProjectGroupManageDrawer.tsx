"use client";

import { Edit3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ProjectPicker } from "@/src/components/sheet/ProjectPicker";
import type {
  ProjectPickerFilter,
  ProjectPickerOption,
} from "@/src/components/sheet/ProjectPicker";
import { Button } from "@/src/components/ui/Button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/src/components/ui/Drawer";
import type { AdminProjectGroupRow, AdminProjectOptionRow } from "@/src/server/projects";

export type ProjectGroupManageDrawerProps = {
  /** `null` closes the drawer. */
  group: AdminProjectGroupRow | null;
  projects: AdminProjectOptionRow[];
  /** Project ids with an add/remove request in flight for this group. */
  pendingProjectIds: string[];
  onOpenChange: (open: boolean) => void;
  onEditGroup: () => void;
  onToggleProject: (projectId: string, next: boolean) => void;
};

/**
 * Where group membership is edited. Every toggle applies immediately through
 * `addProjectToGroupAction` / `removeProjectFromGroupAction` — there is no draft state and no
 * save step, so this drawer never guards its own dismissal the way `FormDrawer` does.
 */
export function ProjectGroupManageDrawer({
  group,
  projects,
  pendingProjectIds,
  onOpenChange,
  onEditGroup,
  onToggleProject,
}: ProjectGroupManageDrawerProps) {
  const t = useTranslations("AdminProjects");

  return (
    <Drawer open={Boolean(group)} onOpenChange={onOpenChange}>
      {group ? (
        <DrawerContent className="flex w-[min(36rem,100vw)] flex-col gap-0 overflow-hidden p-0">
          <div className="border-b border-border px-5 py-5">
            <DrawerHeader className="p-0 pr-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid min-w-0 gap-1">
                  <DrawerTitle className="text-lg font-semibold text-foreground">
                    {t("groupsPanel.manageTitle", { name: group.name })}
                  </DrawerTitle>
                  <DrawerDescription className="text-sm text-muted-foreground">
                    <code className="rounded-[var(--radius-sm)] bg-secondary px-1.5 py-0.5 font-mono text-xs">
                      {group.slug}
                    </code>{" "}
                    · {group.active ? t("states.active") : t("states.inactive")}
                    {group.description ? ` · ${group.description}` : ""}
                  </DrawerDescription>
                </div>
                <Button type="button" size="sm" variant="ghost" icon={Edit3} onClick={onEditGroup}>
                  {t("actions.editGroup")}
                </Button>
              </div>
            </DrawerHeader>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {/* Remounted per group so its filter/search state doesn't leak into the next group
                opened in the same drawer instance. */}
            <ProjectGroupManageBody
              key={group.id}
              group={group}
              projects={projects}
              pendingProjectIds={pendingProjectIds}
              onToggleProject={onToggleProject}
            />
          </div>

          <DrawerFooter className="border-t border-border px-5 py-4">
            <Button type="button" onClick={() => onOpenChange(false)}>
              {t("groupsPanel.done")}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      ) : null}
    </Drawer>
  );
}

function ProjectGroupManageBody({
  group,
  projects,
  pendingProjectIds,
  onToggleProject,
}: {
  group: AdminProjectGroupRow;
  projects: AdminProjectOptionRow[];
  pendingProjectIds: string[];
  onToggleProject: (projectId: string, next: boolean) => void;
}) {
  const t = useTranslations("AdminProjects");
  const [filter, setFilter] = useState<ProjectPickerFilter>("all");
  const [query, setQuery] = useState("");

  const pickerOptions: ProjectPickerOption[] = projects.map((project) => ({
    id: project.id,
    name: project.name,
    slug: project.slug,
    colorToken: project.colorToken,
    isInternal: project.isInternal,
    status: project.status,
  }));

  return (
    <ProjectPicker
      projects={pickerOptions}
      selectedIds={group.projects.map((project) => project.id)}
      pendingIds={pendingProjectIds}
      onToggle={onToggleProject}
      filter={filter}
      onFilterChange={setFilter}
      query={query}
      onQueryChange={setQuery}
      labels={{
        filterGroupLabel: t("groupsPanel.membership.filterLabel"),
        filters: {
          all: t("groupsPanel.membership.all"),
          inGroup: t("groupsPanel.membership.inGroup"),
          available: t("groupsPanel.membership.available"),
        },
        searchLabel: t("groupsPanel.membership.searchLabel"),
        searchPlaceholder: t("groupsPanel.membership.searchPlaceholder"),
        noMatches: t("groupsPanel.membership.noMatches"),
        noneAvailable: t("groupsPanel.membership.noneAvailable"),
        toggleLabel: (project) =>
          t("groupsPanel.membership.toggleLabel", { project: project.name }),
        badges: {
          internal: t("states.internal"),
          inactive: t("states.inactive"),
          archived: t("states.archived"),
        },
      }}
    />
  );
}
