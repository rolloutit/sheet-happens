"use client";

import { Archive, Edit3, FolderPlus, MoreHorizontal, Plus, Save, X } from "lucide-react";
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
import type { AdminProjectGroupRow, AdminProjectRow } from "@/src/server/projects";
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

export type AdminProjectGroupsPanelProps = {
  groups: AdminProjectGroupRow[];
  projects: AdminProjectRow[];
};

const initialGroupState: ProjectGroupActionState = {
  status: "idle",
  message: "",
};

const initialGroupProjectState: ProjectGroupProjectActionState = {
  status: "idle",
  message: "",
};

export function AdminProjectGroupsPanel({ groups, projects }: AdminProjectGroupsPanelProps) {
  const router = useRouter();
  const [createState, setCreateState] = useState<ProjectGroupActionState>(initialGroupState);
  const [linkState, setLinkState] =
    useState<ProjectGroupProjectActionState>(initialGroupProjectState);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<AdminProjectGroupRow | null>(null);
  const [editState, setEditState] = useState<ProjectGroupActionState>(initialGroupState);
  const [archivingGroup, setArchivingGroup] = useState<AdminProjectGroupRow | null>(null);
  const [, startTransition] = useTransition();

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
            label="Group name"
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
          <Field label="Slug" reserveMessageSpace error={createState.fieldErrors?.slug}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="slug"
                autoComplete="off"
                aria-describedby={describedBy}
                invalid={invalid}
                placeholder="Generated from name"
              />
            )}
          </Field>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <Field
            label="Description"
            reserveMessageSpace
            error={createState.fieldErrors?.description}
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="description"
                aria-describedby={describedBy}
                invalid={invalid}
                placeholder="Optional grouping note"
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
            Active
          </label>
        </div>

        {createState.status === "error" && createState.message ? (
          <ProjectGroupsMessage state={createState} />
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" icon={FolderPlus} loading={pendingKey === "group:create"}>
            Create group
          </Button>
        </div>
      </form>

      <div className="grid gap-3">
        {groups.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No project groups have been created yet.
          </div>
        ) : (
          groups.map((group) => (
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
  projects: AdminProjectRow[];
  pendingKey: string | null;
  onEdit: () => void;
  onArchive: () => void;
  onAddProject: (projectId: string) => void;
  onRemoveProject: (projectId: string) => void;
}) {
  const linkedProjectIds = new Set(group.projects.map((project) => project.id));
  const availableProjects = projects.filter((project) => !linkedProjectIds.has(project.id));

  return (
    <div className="grid gap-4 rounded-[var(--radius-lg)] border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-ui text-base font-semibold text-foreground">{group.name}</h3>
            <Badge tone={group.active ? "success" : "neutral"}>
              {group.active ? "active" : "inactive"}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <code className="rounded-[var(--radius-sm)] bg-secondary px-1.5 py-0.5 font-mono">
              {group.slug}
            </code>
            <span>{group.projectCount} projects</span>
          </div>
          {group.description ? (
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{group.description}</p>
          ) : null}
        </div>

        <Dropdown>
          <DropdownTrigger asChild>
            <IconButton
              icon={MoreHorizontal}
              label={`Open actions for ${group.name}`}
              size="sm"
              variant="ghost"
            />
          </DropdownTrigger>
          <DropdownContent align="end">
            <DropdownLabel>Actions</DropdownLabel>
            <DropdownItem onSelect={onEdit}>
              <Edit3 className="size-4" aria-hidden="true" />
              Edit group
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem tone="danger" onSelect={onArchive}>
              <Archive className="size-4" aria-hidden="true" />
              Archive
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>

      <div className="flex flex-wrap gap-2">
        {group.projects.length === 0 ? (
          <span className="text-sm text-muted-foreground">No projects in this group.</span>
        ) : (
          group.projects.map((project) => {
            const pending = pendingKey === `${group.id}:${project.id}:remove`;

            return (
              <span
                key={project.id}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-sm text-foreground"
              >
                {project.name}
                {project.isInternal ? <Badge tone="cta">Internal</Badge> : null}
                <button
                  type="button"
                  aria-label={`Remove ${project.name} from ${group.name}`}
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
            {availableProjects.length ? "Choose project" : "All projects are in this group"}
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
          Add project
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
  return (
    <Dialog open={Boolean(group)} onOpenChange={onOpenChange}>
      {group ? (
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit {group.name}</DialogTitle>
            <DialogDescription>
              Group changes affect filtering and project organization. They do not change project
              assignment or billing rules.
            </DialogDescription>
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
                label="Group name"
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
              <Field label="Slug" reserveMessageSpace error={actionState.fieldErrors?.slug}>
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
              label="Description"
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
              Active
            </label>

            {actionState.status === "error" && actionState.message ? (
              <ProjectGroupsMessage state={actionState} />
            ) : null}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost" disabled={pending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" icon={Save} loading={pending}>
                Save group
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
  return (
    <Dialog open={Boolean(group)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{group ? `Archive ${group.name}?` : "Archive project group?"}</DialogTitle>
          <DialogDescription>
            Archived groups are removed from filters and organization helpers. The projects stay
            unchanged.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          This is a soft delete for the group only.
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={pending}>
              Cancel
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
            Archive group
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
