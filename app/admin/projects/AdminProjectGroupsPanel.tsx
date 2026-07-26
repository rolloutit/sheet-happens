"use client";

import { Archive, Edit3, FolderPlus, MoreHorizontal, Plus, Save, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/Dialog";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from "@/src/components/ui/Dropdown";
import { Field } from "@/src/components/ui/Field";
import { IconButton } from "@/src/components/ui/IconButton";
import { Input } from "@/src/components/ui/Input";
import { Textarea } from "@/src/components/ui/Textarea";
import { cn } from "@/src/lib/utils";
import type { AdminProjectGroupRow, AdminProjectOptionRow } from "@/src/server/projects";
import {
  addProjectToGroupAction,
  archiveProjectGroupAction,
  createProjectGroupAction,
  removeProjectFromGroupAction,
  updateProjectGroupAction,
} from "./actions";
import type {
  ProjectGroupActionState,
  ProjectGroupProjectActionState,
  UpdateProjectGroupActionInput,
} from "./actions.types";
import { nativeCheckboxClassName, nativeSelectClassName } from "./formStyles";
import { ProjectColorSwatch } from "./ProjectColorField";

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

export function AdminProjectGroupsPanel({ groups, projects }: AdminProjectGroupsPanelProps) {
  const t = useTranslations("AdminProjects");
  const router = useRouter();
  const [groupQuery, setGroupQuery] = useState("");
  const [groupStateFilter, setGroupStateFilter] = useState<ProjectGroupStateFilter>("all");
  const [groupOccupancyFilter, setGroupOccupancyFilter] =
    useState<ProjectGroupOccupancyFilter>("all");
  const [createState, setCreateState] = useState<ProjectGroupActionState>(initialGroupState);
  const [linkState, setLinkState] =
    useState<ProjectGroupProjectActionState>(initialGroupProjectState);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<AdminProjectGroupRow | null>(null);
  const [editState, setEditState] = useState<ProjectGroupActionState>(initialGroupState);
  const [archivingGroup, setArchivingGroup] = useState<AdminProjectGroupRow | null>(null);
  const [, startTransition] = useTransition();
  const filteredGroups = groups.filter((group) => {
    const normalizedQuery = groupQuery.trim().toLowerCase();

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

  function runLinkAction(key: string, callback: () => Promise<ProjectGroupProjectActionState>) {
    setPendingKey(key);
    setLinkState(initialGroupProjectState);

    startTransition(async () => {
      const result = await callback();
      setLinkState(result);
      setPendingKey(null);

      if (result.status === "success") {
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-5">
      {linkState.message ? <ProjectGroupsMessage state={linkState} /> : null}

      <form
        className="grid gap-4 rounded-[var(--radius-lg)] border border-border bg-background/45 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const formData = new FormData(form);

          runGroupAction(
            "group:create",
            () =>
              createProjectGroupAction({
                name: getGroupFormString(formData, "name"),
                slug: getGroupFormString(formData, "slug"),
                description: getGroupFormString(formData, "description"),
                active: formData.get("active") === "true",
              }),
            {
              onResult: setCreateState,
              onSuccess: () => {
                form.reset();
                setCreateState(initialGroupState);
              },
            },
          );
        }}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(13rem,1fr)_minmax(11rem,0.7fr)]">
          <Field
            label={t("groupsPanel.groupName")}
            required
            reserveMessageSpace
            error={createState.fieldErrors?.name}
          >
            {({ id, describedBy, invalid, required }) => (
              <Input
                id={id}
                name="name"
                autoComplete="off"
                aria-describedby={describedBy}
                invalid={invalid}
                required={required}
              />
            )}
          </Field>
          <Field label={t("form.slug")} reserveMessageSpace error={createState.fieldErrors?.slug}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="slug"
                autoComplete="off"
                aria-describedby={describedBy}
                invalid={invalid}
                placeholder={t("groupsPanel.generatedSlug")}
              />
            )}
          </Field>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <Field
            label={t("groupsPanel.description")}
            reserveMessageSpace
            error={createState.fieldErrors?.description}
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="description"
                aria-describedby={describedBy}
                invalid={invalid}
                placeholder={t("groupsPanel.descriptionPlaceholder")}
              />
            )}
          </Field>
          <label className="mb-6 inline-flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="active"
              value="true"
              defaultChecked
              className={nativeCheckboxClassName}
            />
            {t("states.active")}
          </label>
        </div>

        {createState.status === "error" && createState.message ? (
          <ProjectGroupsMessage state={createState} />
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" icon={FolderPlus} loading={pendingKey === "group:create"}>
            {t("actions.createGroup")}
          </Button>
        </div>
      </form>

      <div className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-background/45 p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(14rem,1fr)_minmax(10rem,14rem)_minmax(10rem,14rem)]">
          <Field label={t("groupsPanel.filters.search")} htmlFor="project-group-search">
            <Input
              id="project-group-search"
              type="search"
              value={groupQuery}
              placeholder={t("groupsPanel.filters.searchPlaceholder")}
              onChange={(event) => setGroupQuery(event.currentTarget.value)}
            />
          </Field>
          <Field label={t("groupsPanel.filters.state")} htmlFor="project-group-state">
            <select
              id="project-group-state"
              value={groupStateFilter}
              className={nativeSelectClassName}
              onChange={(event) =>
                setGroupStateFilter(event.currentTarget.value as ProjectGroupStateFilter)
              }
            >
              <option value="all">{t("filters.all")}</option>
              <option value="active">{t("states.active")}</option>
              <option value="inactive">{t("states.inactive")}</option>
            </select>
          </Field>
          <Field label={t("groupsPanel.filters.projects")} htmlFor="project-group-occupancy">
            <select
              id="project-group-occupancy"
              value={groupOccupancyFilter}
              className={nativeSelectClassName}
              onChange={(event) =>
                setGroupOccupancyFilter(event.currentTarget.value as ProjectGroupOccupancyFilter)
              }
            >
              <option value="all">{t("filters.all")}</option>
              <option value="withProjects">{t("groupsPanel.filters.withProjects")}</option>
              <option value="empty">{t("groupsPanel.filters.empty")}</option>
            </select>
          </Field>
        </div>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
            {t("groupsPanel.filters.showing", {
              count: filteredGroups.length,
              total: groups.length,
            })}
          </p>
          <Button
            type="button"
            variant="ghost"
            icon={X}
            onClick={() => {
              setGroupQuery("");
              setGroupStateFilter("all");
              setGroupOccupancyFilter("all");
            }}
          >
            {t("filters.clear")}
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        {groups.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {t("groupsPanel.empty")}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {t("groupsPanel.emptyFiltered")}
          </div>
        ) : (
          filteredGroups.map((group) => (
            <ProjectGroupCard
              key={group.id}
              group={group}
              projects={projects}
              pendingKey={pendingKey}
              onEdit={() => {
                setEditingGroup(group);
                setEditState(initialGroupState);
              }}
              onArchive={() => {
                setArchivingGroup(group);
              }}
              onAddProject={(projectId) =>
                runLinkAction(`${group.id}:${projectId}:add`, () =>
                  addProjectToGroupAction({
                    projectGroupId: group.id,
                    projectId,
                  }),
                )
              }
              onRemoveProject={(projectId) =>
                runLinkAction(`${group.id}:${projectId}:remove`, () =>
                  removeProjectFromGroupAction({
                    projectGroupId: group.id,
                    projectId,
                  }),
                )
              }
            />
          ))
        )}
      </div>

      <ProjectGroupEditDialog
        group={editingGroup}
        pending={editingGroup ? pendingKey === `${editingGroup.id}:edit` : false}
        actionState={editState}
        onOpenChange={(open) => {
          if (!open) {
            setEditingGroup(null);
            setEditState(initialGroupState);
          }
        }}
        onSubmit={(input) => {
          if (!editingGroup) return;

          runGroupAction(`${editingGroup.id}:edit`, () => updateProjectGroupAction(input), {
            onResult: setEditState,
            onSuccess: () => {
              setEditingGroup(null);
              setEditState(initialGroupState);
            },
          });
        }}
      />

      <ArchiveProjectGroupDialog
        group={archivingGroup}
        pending={archivingGroup ? pendingKey === `${archivingGroup.id}:archive` : false}
        onOpenChange={(open) => {
          if (!open) setArchivingGroup(null);
        }}
        onConfirm={(group) => {
          runGroupAction(`${group.id}:archive`, () => archiveProjectGroupAction(group.id), {
            onResult: setCreateState,
            onSuccess: () => setArchivingGroup(null),
          });
        }}
      />
    </div>
  );
}

function ProjectGroupCard({
  group,
  projects,
  pendingKey,
  onEdit,
  onArchive,
  onAddProject,
  onRemoveProject,
}: {
  group: AdminProjectGroupRow;
  projects: AdminProjectOptionRow[];
  pendingKey: string | null;
  onEdit: () => void;
  onArchive: () => void;
  onAddProject: (projectId: string) => void;
  onRemoveProject: (projectId: string) => void;
}) {
  const t = useTranslations("AdminProjects");
  const linkedProjectIds = new Set(group.projects.map((project) => project.id));
  const availableProjects = projects.filter((project) => !linkedProjectIds.has(project.id));

  return (
    <div className="grid gap-4 rounded-[var(--radius-lg)] border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-ui text-base font-semibold text-foreground">{group.name}</h3>
            <Badge tone={group.active ? "success" : "neutral"}>
              {group.active ? t("states.active") : t("states.inactive")}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <code className="rounded-[var(--radius-sm)] bg-secondary px-1.5 py-0.5 font-mono">
              {group.slug}
            </code>
            <span>{t("groupsPanel.projectCount", { count: group.projectCount })}</span>
          </div>
          {group.description ? (
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{group.description}</p>
          ) : null}
        </div>

        <Dropdown>
          <DropdownTrigger asChild>
            <IconButton
              icon={MoreHorizontal}
              label={t("actions.openFor", { name: group.name })}
              size="sm"
              variant="ghost"
            />
          </DropdownTrigger>
          <DropdownContent align="end">
            <DropdownLabel>{t("actions.menuLabel")}</DropdownLabel>
            <DropdownItem onSelect={onEdit}>
              <Edit3 className="size-4" aria-hidden="true" />
              {t("actions.editGroup")}
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem tone="danger" onSelect={onArchive}>
              <Archive className="size-4" aria-hidden="true" />
              {t("actions.archive")}
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>

      <div className="flex flex-wrap gap-2">
        {group.projects.length === 0 ? (
          <span className="text-sm text-muted-foreground">{t("groupsPanel.noProjects")}</span>
        ) : (
          group.projects.map((project) => {
            const pending = pendingKey === `${group.id}:${project.id}:remove`;

            return (
              <span
                key={project.id}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-sm text-foreground"
              >
                <ProjectColorSwatch colorToken={project.colorToken} size="sm" />
                {project.name}
                {project.isInternal ? <Badge tone="cta">{t("states.internal")}</Badge> : null}
                <button
                  type="button"
                  aria-label={t("groupsPanel.removeProjectLabel", {
                    project: project.name,
                    group: group.name,
                  })}
                  disabled={pending}
                  onClick={() => onRemoveProject(project.id)}
                  className="rounded-full text-muted-foreground outline-none transition hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </span>
            );
          })
        )}
      </div>

      <form
        className="grid gap-3 sm:grid-cols-[minmax(12rem,1fr)_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const formData = new FormData(form);
          const projectId = getGroupFormString(formData, "projectId");

          if (!projectId) return;

          onAddProject(projectId);
          form.reset();
        }}
      >
        <select
          name="projectId"
          defaultValue=""
          className={nativeSelectClassName}
          disabled={availableProjects.length === 0}
        >
          <option value="" disabled>
            {availableProjects.length
              ? t("groupsPanel.chooseProject")
              : t("groupsPanel.allProjectsLinked")}
          </option>
          {availableProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <Button
          type="submit"
          variant="ghost"
          icon={Plus}
          loading={pendingKey?.startsWith(`${group.id}:`) && pendingKey.endsWith(":add")}
          disabled={availableProjects.length === 0}
        >
          {t("actions.addProject")}
        </Button>
      </form>
    </div>
  );
}

function ProjectGroupEditDialog({
  group,
  pending,
  actionState,
  onOpenChange,
  onSubmit,
}: {
  group: AdminProjectGroupRow | null;
  pending: boolean;
  actionState: ProjectGroupActionState;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: UpdateProjectGroupActionInput) => void;
}) {
  const t = useTranslations("AdminProjects");

  return (
    <Dialog open={Boolean(group)} onOpenChange={onOpenChange}>
      {group ? (
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("groupsPanel.editTitle", { name: group.name })}</DialogTitle>
            <DialogDescription>{t("groupsPanel.editDescription")}</DialogDescription>
          </DialogHeader>

          <form
            key={group.id}
            className="grid gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);

              onSubmit({
                projectGroupId: group.id,
                name: getGroupFormString(formData, "name"),
                slug: getGroupFormString(formData, "slug"),
                description: getGroupFormString(formData, "description"),
                active: formData.get("active") === "true",
              });
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label={t("groupsPanel.groupName")}
                required
                reserveMessageSpace
                error={actionState.fieldErrors?.name}
              >
                {({ id, describedBy, invalid, required }) => (
                  <Input
                    id={id}
                    name="name"
                    defaultValue={group.name}
                    autoComplete="off"
                    aria-describedby={describedBy}
                    invalid={invalid}
                    required={required}
                  />
                )}
              </Field>
              <Field
                label={t("form.slug")}
                reserveMessageSpace
                error={actionState.fieldErrors?.slug}
              >
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    name="slug"
                    defaultValue={group.slug}
                    autoComplete="off"
                    aria-describedby={describedBy}
                    invalid={invalid}
                  />
                )}
              </Field>
            </div>

            <Field
              label={t("groupsPanel.description")}
              reserveMessageSpace
              error={actionState.fieldErrors?.description}
            >
              {({ id, describedBy, invalid }) => (
                <Textarea
                  id={id}
                  name="description"
                  defaultValue={group.description ?? ""}
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>

            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="active"
                value="true"
                defaultChecked={group.active}
                className={nativeCheckboxClassName}
              />
              {t("states.active")}
            </label>

            {actionState.status === "error" && actionState.message ? (
              <ProjectGroupsMessage state={actionState} />
            ) : null}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost" disabled={pending}>
                  {t("actions.cancel")}
                </Button>
              </DialogClose>
              <Button type="submit" icon={Save} loading={pending}>
                {t("actions.saveGroup")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function ArchiveProjectGroupDialog({
  group,
  pending,
  onOpenChange,
  onConfirm,
}: {
  group: AdminProjectGroupRow | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (group: AdminProjectGroupRow) => void;
}) {
  const t = useTranslations("AdminProjects");

  return (
    <Dialog open={Boolean(group)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {group
              ? t("groupsPanel.archiveTitleNamed", { name: group.name })
              : t("groupsPanel.archiveTitle")}
          </DialogTitle>
          <DialogDescription>{t("groupsPanel.archiveDescription")}</DialogDescription>
        </DialogHeader>
        <div className="rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("groupsPanel.archiveWarning")}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={pending}>
              {t("actions.cancel")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="danger"
            icon={Archive}
            loading={pending}
            onClick={() => {
              if (group) onConfirm(group);
            }}
          >
            {t("actions.archiveGroup")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectGroupsMessage({
  state,
}: {
  state: ProjectGroupActionState | ProjectGroupProjectActionState;
}) {
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={cn(
        "rounded-[var(--radius-md)] border px-3 py-2 text-sm",
        state.status === "error"
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-success/40 bg-success/10 text-success",
      )}
    >
      {state.message}
    </p>
  );
}

function getGroupFormString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
