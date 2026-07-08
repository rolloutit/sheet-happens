"use client";

import {
  Archive,
  CalendarX2,
  CheckCircle2,
  Edit3,
  FolderOpen,
  MoreHorizontal,
  PauseCircle,
  Save,
  Search,
  UserPlus,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/src/components/ui/Badge";
import type { BadgeProps } from "@/src/components/ui/Badge";
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
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/src/components/ui/Drawer";
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
import { DataTable } from "@/src/components/ui/Table";
import { Textarea } from "@/src/components/ui/Textarea";
import { cn } from "@/src/lib/utils";
import type {
  AdminProjectAssignmentRow,
  AdminProjectGroupRow,
  AdminProjectRow,
  ProjectAssignableMemberRow,
  ProjectAssignmentMemberProfile,
  ProjectAssignmentMemberStatus,
  ProjectLifecycleStatus,
} from "@/src/server/projects";
import type { AdminAssignmentRateRow } from "@/src/server/rates";
import {
  archiveProjectAction,
  assignProjectMemberAction,
  closeProjectAssignmentAction,
  setProjectActiveAction,
  updateProjectAction,
  updateProjectAssignmentAction,
} from "./actions";
import type {
  AssignProjectMemberActionInput,
  CloseProjectAssignmentActionInput,
  ProjectAssignmentActionState,
  ProjectAssignmentFormField,
  ProjectActionState,
  UpdateProjectAssignmentActionInput,
  UpdateProjectActionInput,
} from "./actions.types";
import { nativeCheckboxClassName, nativeSelectClassName } from "./formStyles";

export type AdminProjectsTableProps = {
  rows: AdminProjectRow[];
  groups: AdminProjectGroupRow[];
  assignments: AdminProjectAssignmentRow[];
  assignmentRates: AdminAssignmentRateRow[];
  assignableMembers: ProjectAssignableMemberRow[];
  todayDate: string;
};

type ProjectTableRow = AdminProjectRow & Record<string, unknown>;
type PendingAction = "edit" | "status" | "archive";
type ProjectStatusFilter = "all" | "ACTIVE" | "INACTIVE" | "internal";

const statusTone: Record<ProjectLifecycleStatus, BadgeProps["tone"]> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  ARCHIVED: "warning",
};

const assignmentStatusTone: Record<ProjectAssignmentMemberStatus, BadgeProps["tone"]> = {
  INVITED: "info",
  ACTIVE: "success",
  INACTIVE: "neutral",
  DELETED: "warning",
};

const assignmentProfileTone: Record<ProjectAssignmentMemberProfile, BadgeProps["tone"]> = {
  CONTRACTOR: "cta",
  EMPLOYEE: "info",
};

export function AdminProjectsTable({
  rows,
  groups,
  assignments,
  assignmentRates,
  assignableMembers,
  todayDate,
}: AdminProjectsTableProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [message, setMessage] = useState<ProjectActionState | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<AdminProjectRow | null>(null);
  const [editState, setEditState] = useState<ProjectActionState | null>(null);
  const [archivingProject, setArchivingProject] = useState<AdminProjectRow | null>(null);
  const [detailProject, setDetailProject] = useState<AdminProjectRow | null>(null);
  const [assignmentMessage, setAssignmentMessage] = useState<ProjectAssignmentActionState | null>(
    null,
  );
  const [assignmentPendingKey, setAssignmentPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const filteredRows = rows.filter((row) => {
    const normalizedQuery = query.trim().toLowerCase();

    if (
      normalizedQuery &&
      !row.name.toLowerCase().includes(normalizedQuery) &&
      !row.slug.toLowerCase().includes(normalizedQuery) &&
      !(row.notes ?? "").toLowerCase().includes(normalizedQuery) &&
      !row.groups.some((group) => group.name.toLowerCase().includes(normalizedQuery))
    ) {
      return false;
    }

    if (statusFilter === "internal" && !row.isInternal) return false;
    if (statusFilter !== "all" && statusFilter !== "internal" && row.status !== statusFilter) {
      return false;
    }

    if (groupFilter === "ungrouped" && row.groups.length > 0) return false;
    if (
      groupFilter !== "all" &&
      groupFilter !== "ungrouped" &&
      !row.groups.some((group) => group.id === groupFilter)
    ) {
      return false;
    }

    return true;
  });
  const tableRows = filteredRows as ProjectTableRow[];

  function runAction(
    row: AdminProjectRow,
    action: PendingAction,
    callback: () => Promise<ProjectActionState>,
    options: {
      onResult?: (result: ProjectActionState) => void;
      onSuccess?: () => void;
    } = {},
  ) {
    setPendingKey(`${row.id}:${action}`);
    setMessage(null);

    startTransition(async () => {
      const result = await callback();
      setMessage(result);
      options.onResult?.(result);
      setPendingKey(null);

      if (result.status === "success") {
        options.onSuccess?.();
        router.refresh();
      }
    });
  }

  function isPending(row: AdminProjectRow, action: PendingAction) {
    return pendingKey === `${row.id}:${action}`;
  }

  function runAssignmentAction(
    key: string,
    callback: () => Promise<ProjectAssignmentActionState>,
    options: { onSuccess?: () => void } = {},
  ) {
    setAssignmentPendingKey(key);
    setAssignmentMessage(null);

    startTransition(async () => {
      const result = await callback();
      setAssignmentMessage(result);
      setAssignmentPendingKey(null);

      if (result.status === "success") {
        options.onSuccess?.();
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-3">
      {message ? (
        <p
          role={message.status === "error" ? "alert" : "status"}
          className={cn(
            "rounded-[var(--radius-md)] border px-3 py-2 text-sm",
            message.status === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-success/40 bg-success/10 text-success",
          )}
        >
          {message.message}
        </p>
      ) : null}

      <div className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-background/45 p-3 lg:grid-cols-[minmax(16rem,1fr)_auto_auto]">
        <label className="flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-border bg-card px-3 shadow-soft">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Search projects</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects..."
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>

        <label className="grid h-10 grid-cols-[auto_1fr] items-center gap-2 rounded-[var(--radius-md)] border border-border bg-card px-3 shadow-soft">
          <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            State
          </span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ProjectStatusFilter)}
            className="min-w-28 bg-transparent text-sm font-semibold text-foreground outline-none"
          >
            <option value="all">All</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="internal">Internal</option>
          </select>
        </label>

        <label className="grid h-10 grid-cols-[auto_1fr] items-center gap-2 rounded-[var(--radius-md)] border border-border bg-card px-3 shadow-soft">
          <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Group
          </span>
          <select
            value={groupFilter}
            onChange={(event) => setGroupFilter(event.target.value)}
            className="min-w-36 bg-transparent text-sm font-semibold text-foreground outline-none"
          >
            <option value="all">All</option>
            <option value="ungrouped">Ungrouped</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <DataTable
        caption="Project management table"
        aria-label="Project management table"
        rows={tableRows}
        empty={
          rows.length
            ? "No projects match the current filters."
            : "No projects have been created yet."
        }
        getRowKey={(row) => row.id}
        displayMode="responsive"
        density="comfortable"
        columns={[
          {
            id: "name",
            header: "Project",
            mobileLabel: "Project",
            cell: (row) => (
              <div className="grid gap-1">
                <p className="font-ui text-sm font-semibold text-foreground">{row.name}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded-[var(--radius-sm)] bg-secondary px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    {row.slug}
                  </code>
                  {row.isInternal ? <Badge tone="cta">Internal</Badge> : null}
                  {row.groups.map((group) => (
                    <Badge key={group.id} tone="info">
                      <FolderOpen className="size-3" aria-hidden="true" />
                      {group.name}
                    </Badge>
                  ))}
                </div>
                {row.notes ? (
                  <p className="max-w-xl text-xs leading-5 text-muted-foreground">{row.notes}</p>
                ) : null}
              </div>
            ),
          },
          {
            id: "status",
            header: "State",
            accessor: "status",
            mobileLabel: "State",
            cell: (row) => <Badge tone={statusTone[row.status]}>{formatStatus(row.status)}</Badge>,
          },
          {
            id: "timeline",
            header: "Timeline",
            mobileLabel: "Timeline",
            cell: (row) => (
              <span className="text-sm text-muted-foreground">{formatProjectTimeline(row)}</span>
            ),
          },
          {
            id: "usage",
            header: "Usage",
            mobileLabel: "Usage",
            cell: (row) => (
              <div className="grid gap-1 text-sm text-muted-foreground">
                <span>{row.assignmentCount} assignments</span>
                <span>{row.groupCount} groups</span>
              </div>
            ),
          },
          {
            id: "updatedAt",
            header: "Updated",
            accessor: "updatedAt",
            mobileLabel: "Updated",
            cell: (row) => (
              <span className="text-sm text-muted-foreground">
                {formatTimestamp(row.updatedAt)}
              </span>
            ),
          },
        ]}
        rowActions={(row) => {
          const project = getAdminProjectRow(rows, row);

          if (!project) return null;

          return (
            <ProjectActionsMenu
              project={project}
              isPending={(action) => isPending(project, action)}
              onOpenDetails={() => {
                setDetailProject(project);
                setAssignmentMessage(null);
                setMessage(null);
              }}
              onEdit={() => {
                setEditingProject(project);
                setEditState(null);
                setMessage(null);
              }}
              onSetActive={(active) =>
                runAction(project, "status", () => setProjectActiveAction(project.id, active))
              }
              onArchive={() => {
                setArchivingProject(project);
                setMessage(null);
              }}
            />
          );
        }}
      />

      <ProjectDetailDrawer
        project={detailProject}
        assignments={assignments.filter((assignment) => assignment.projectId === detailProject?.id)}
        assignmentRates={assignmentRates.filter((rate) => rate.projectId === detailProject?.id)}
        assignableMembers={assignableMembers}
        todayDate={todayDate}
        actionState={assignmentMessage}
        pendingKey={assignmentPendingKey}
        projectPendingAction={Boolean(
          detailProject && pendingKey?.startsWith(`${detailProject.id}:`),
        )}
        onOpenChange={(open) => {
          if (!open) {
            setDetailProject(null);
            setAssignmentMessage(null);
          }
        }}
        onEditProject={() => {
          if (!detailProject) return;
          setEditingProject(detailProject);
          setEditState(null);
          setMessage(null);
        }}
        onSetProjectActive={(active) => {
          if (!detailProject) return;
          runAction(detailProject, "status", () =>
            setProjectActiveAction(detailProject.id, active),
          );
        }}
        onAssign={(input) => {
          if (!detailProject) return;

          runAssignmentAction(`${detailProject.id}:assign`, () => assignProjectMemberAction(input));
        }}
        onUpdate={(input) => {
          runAssignmentAction(`${input.assignmentId}:update`, () =>
            updateProjectAssignmentAction(input),
          );
        }}
        onClose={(input) => {
          runAssignmentAction(`${input.assignmentId}:close`, () =>
            closeProjectAssignmentAction(input),
          );
        }}
      />

      <ProjectEditDialog
        project={editingProject}
        pending={editingProject ? isPending(editingProject, "edit") : false}
        actionState={editState}
        onOpenChange={(open) => {
          if (!open) {
            setEditingProject(null);
            setEditState(null);
          }
        }}
        onSubmit={(input) => {
          if (!editingProject) return;

          runAction(editingProject, "edit", () => updateProjectAction(input), {
            onResult: setEditState,
            onSuccess: () => {
              setEditingProject(null);
              setEditState(null);
            },
          });
        }}
      />

      <ArchiveProjectDialog
        project={archivingProject}
        pending={archivingProject ? isPending(archivingProject, "archive") : false}
        onOpenChange={(open) => {
          if (!open) setArchivingProject(null);
        }}
        onConfirm={(project) => {
          runAction(project, "archive", () => archiveProjectAction(project.id), {
            onSuccess: () => setArchivingProject(null),
          });
        }}
      />
    </div>
  );
}

function ProjectActionsMenu({
  project,
  isPending,
  onOpenDetails,
  onEdit,
  onSetActive,
  onArchive,
}: {
  project: AdminProjectRow;
  isPending: (action: PendingAction) => boolean;
  onOpenDetails: () => void;
  onEdit: () => void;
  onSetActive: (active: boolean) => void;
  onArchive: () => void;
}) {
  const nextActive = project.status !== "ACTIVE";

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <IconButton
          icon={MoreHorizontal}
          label={`Open actions for ${project.name}`}
          size="sm"
          variant="ghost"
        />
      </DropdownTrigger>
      <DropdownContent align="end">
        <DropdownLabel>Actions</DropdownLabel>
        <DropdownItem onSelect={onOpenDetails}>
          <FolderOpen className="size-4" aria-hidden="true" />
          Open details
        </DropdownItem>
        <DropdownItem disabled={isPending("edit")} onSelect={onEdit}>
          <Edit3 className="size-4" aria-hidden="true" />
          Edit project
        </DropdownItem>
        <DropdownItem disabled={isPending("status")} onSelect={() => onSetActive(nextActive)}>
          {nextActive ? (
            <CheckCircle2 className="size-4" aria-hidden="true" />
          ) : (
            <PauseCircle className="size-4" aria-hidden="true" />
          )}
          {nextActive ? "Activate" : "Deactivate"}
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem tone="danger" disabled={isPending("archive")} onSelect={onArchive}>
          <Archive className="size-4" aria-hidden="true" />
          Archive
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}

function ProjectDetailDrawer({
  project,
  assignments,
  assignmentRates,
  assignableMembers,
  todayDate,
  actionState,
  pendingKey,
  projectPendingAction,
  onOpenChange,
  onEditProject,
  onSetProjectActive,
  onAssign,
  onUpdate,
  onClose,
}: {
  project: AdminProjectRow | null;
  assignments: AdminProjectAssignmentRow[];
  assignmentRates: AdminAssignmentRateRow[];
  assignableMembers: ProjectAssignableMemberRow[];
  todayDate: string;
  actionState: ProjectAssignmentActionState | null;
  pendingKey: string | null;
  projectPendingAction: boolean;
  onOpenChange: (open: boolean) => void;
  onEditProject: () => void;
  onSetProjectActive: (active: boolean) => void;
  onAssign: (input: AssignProjectMemberActionInput) => void;
  onUpdate: (input: UpdateProjectAssignmentActionInput) => void;
  onClose: (input: CloseProjectAssignmentActionInput) => void;
}) {
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const assignPending = project ? pendingKey === `${project.id}:assign` : false;
  const nextActive = project?.status !== "ACTIVE";

  return (
    <Drawer open={Boolean(project)} onOpenChange={onOpenChange}>
      {project ? (
        <DrawerContent className="w-[min(44rem,100vw)] gap-0 overflow-hidden p-0">
          <div className="border-b border-border px-5 py-5">
            <DrawerHeader className="p-0">
              <div className="flex flex-col gap-4 pr-8 sm:flex-row sm:items-start sm:justify-between">
                <div className="grid gap-2">
                  <p className="font-ui text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                    Project
                  </p>
                  <DrawerTitle className="text-2xl font-semibold text-foreground">
                    {project.name}
                  </DrawerTitle>
                  <DrawerDescription className="text-sm leading-6 text-muted-foreground">
                    {formatProjectTimeline(project)}
                  </DrawerDescription>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon={Edit3}
                    onClick={onEditProject}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon={nextActive ? CheckCircle2 : PauseCircle}
                    loading={projectPendingAction}
                    onClick={() => onSetProjectActive(nextActive)}
                  >
                    {nextActive ? "Activate" : "Deactivate"}
                  </Button>
                </div>
              </div>
            </DrawerHeader>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge tone={statusTone[project.status]}>{formatStatus(project.status)}</Badge>
              {project.isInternal ? <Badge tone="cta">Internal</Badge> : null}
              {project.groups.length === 0 ? (
                <Badge tone="neutral">Ungrouped</Badge>
              ) : (
                project.groups.map((group) => (
                  <Badge key={group.id} tone="info">
                    <FolderOpen className="size-3" aria-hidden="true" />
                    {group.name}
                  </Badge>
                ))
              )}
            </div>
          </div>

          <div className="grid max-h-[calc(100vh-9rem)] gap-6 overflow-y-auto px-5 py-5">
            {project.status !== "ACTIVE" ? (
              <div className="rounded-[var(--radius-lg)] border border-warning/35 bg-warning/12 px-4 py-3 text-sm leading-6 text-warning">
                This project is not active. It stays visible for admin work, but should not be used
                for new time-entry choices.
              </div>
            ) : null}

            {actionState?.message ? (
              <p
                role={actionState.status === "error" ? "alert" : "status"}
                className={cn(
                  "rounded-[var(--radius-md)] border px-3 py-2 text-sm",
                  actionState.status === "error"
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-success/40 bg-success/10 text-success",
                )}
              >
                {actionState.message}
              </p>
            ) : null}

            <section className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <ProjectFact label="Assignments" value={String(assignments.length)} />
                <ProjectFact label="Groups" value={String(project.groupCount)} />
                <ProjectFact label="Updated" value={formatTimestamp(project.updatedAt)} />
              </div>
              <div className="rounded-[var(--radius-lg)] border border-border bg-card p-4">
                <p className="font-ui text-sm font-semibold text-foreground">Notes</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {project.notes || "No project notes have been added."}
                </p>
              </div>
            </section>

            <form
              className="grid gap-4 rounded-[var(--radius-lg)] border border-border bg-background/45 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);

                onAssign({
                  projectId: project.id,
                  memberId: getAssignmentFormString(formData, "memberId"),
                  validFrom: getAssignmentFormString(formData, "validFrom"),
                  validTo: getAssignmentFormString(formData, "validTo"),
                  active: formData.get("active") === "true",
                  notes: getAssignmentFormString(formData, "notes"),
                });
              }}
            >
              <div>
                <h3 className="font-ui text-sm font-semibold text-foreground">Add assignment</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Invited and active members can be assigned before account activation.
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(14rem,1.4fr)_minmax(9rem,0.7fr)_minmax(9rem,0.7fr)]">
                <Field
                  label="Member"
                  required
                  reserveMessageSpace
                  error={actionState?.fieldErrors?.memberId}
                >
                  {({ id, describedBy, invalid, required }) => (
                    <select
                      id={id}
                      name="memberId"
                      defaultValue=""
                      aria-describedby={describedBy}
                      aria-invalid={invalid}
                      required={required}
                      className={nativeSelectClassName}
                    >
                      <option value="" disabled>
                        Choose member
                      </option>
                      {assignableMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} - {formatProfile(member.profile)},{" "}
                          {formatStatus(member.status)}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field
                  label="Valid from"
                  required
                  reserveMessageSpace
                  error={actionState?.fieldErrors?.validFrom}
                >
                  {({ id, describedBy, invalid, required }) => (
                    <Input
                      id={id}
                      name="validFrom"
                      type="date"
                      defaultValue={todayDate}
                      aria-describedby={describedBy}
                      invalid={invalid}
                      required={required}
                    />
                  )}
                </Field>
                <Field
                  label="Valid to"
                  reserveMessageSpace
                  error={actionState?.fieldErrors?.validTo}
                >
                  {({ id, describedBy, invalid }) => (
                    <Input
                      id={id}
                      name="validTo"
                      type="date"
                      aria-describedby={describedBy}
                      invalid={invalid}
                    />
                  )}
                </Field>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <Field label="Notes" reserveMessageSpace error={actionState?.fieldErrors?.notes}>
                  {({ id, describedBy, invalid }) => (
                    <Input
                      id={id}
                      name="notes"
                      aria-describedby={describedBy}
                      invalid={invalid}
                      placeholder="Optional assignment notes"
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

              <div className="flex justify-end">
                <Button
                  type="submit"
                  icon={UserPlus}
                  loading={assignPending}
                  disabled={assignableMembers.length === 0}
                >
                  Assign member
                </Button>
              </div>
            </form>

            <div className="grid gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-ui text-sm font-semibold text-foreground">
                    Assigned members
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Effective dates and rate source are shown per assignment.
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" asChild>
                  <Link href="/admin/rates">
                    <WalletCards className="size-4" aria-hidden="true" />
                    Manage rates
                  </Link>
                </Button>
              </div>

              {assignments.length === 0 ? (
                <div className="rounded-[var(--radius-lg)] border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                  No members are assigned to this project yet.
                </div>
              ) : (
                assignments.map((assignment) => {
                  const editing = editingAssignmentId === assignment.id;
                  const updatePending = pendingKey === `${assignment.id}:update`;
                  const closePending = pendingKey === `${assignment.id}:close`;
                  const canEndToday = assignment.active && todayDate >= assignment.validFrom;
                  const rateSource = getAssignmentRateSource(assignment, assignmentRates);

                  return (
                    <div
                      key={assignment.id}
                      className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="grid gap-2">
                          <div>
                            <p className="font-ui text-sm font-semibold text-foreground">
                              {assignment.memberName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {assignment.memberEmail}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={assignmentProfileTone[assignment.memberProfile]}>
                              {formatProfile(assignment.memberProfile)}
                            </Badge>
                            <Badge tone={assignmentStatusTone[assignment.memberStatus]}>
                              {formatStatus(assignment.memberStatus)}
                            </Badge>
                            <Badge tone={assignment.active ? "success" : "neutral"}>
                              {assignment.active ? "active" : "inactive"}
                            </Badge>
                            <Badge tone={rateSource.tone}>{rateSource.label}</Badge>
                          </div>
                        </div>
                        <div className="grid gap-2 text-sm text-muted-foreground lg:text-right">
                          <span>{formatAssignmentTimeline(assignment)}</span>
                          <span>{rateSource.detail}</span>
                          {assignment.notes ? <span>{assignment.notes}</span> : null}
                          <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              icon={Edit3}
                              disabled={updatePending || closePending}
                              onClick={() => setEditingAssignmentId(editing ? null : assignment.id)}
                            >
                              {editing ? "Cancel" : "Edit"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              icon={CalendarX2}
                              loading={closePending}
                              disabled={!canEndToday || updatePending}
                              onClick={() =>
                                onClose({
                                  assignmentId: assignment.id,
                                  validTo: todayDate,
                                })
                              }
                            >
                              End today
                            </Button>
                          </div>
                        </div>
                      </div>

                      {editing ? (
                        <ProjectAssignmentEditForm
                          assignment={assignment}
                          pending={updatePending}
                          actionState={actionState}
                          onCancel={() => setEditingAssignmentId(null)}
                          onSubmit={(input) => {
                            onUpdate(input);
                          }}
                        />
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DrawerContent>
      ) : null}
    </Drawer>
  );
}

function ProjectFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-card px-4 py-3">
      <p className="text-lg font-semibold text-foreground">{value}</p>
      <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function ProjectAssignmentEditForm({
  assignment,
  pending,
  actionState,
  onCancel,
  onSubmit,
}: {
  assignment: AdminProjectAssignmentRow;
  pending: boolean;
  actionState: ProjectAssignmentActionState | null;
  onCancel: () => void;
  onSubmit: (input: UpdateProjectAssignmentActionInput) => void;
}) {
  return (
    <form
      className="grid gap-4 border-t border-border pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        onSubmit({
          assignmentId: assignment.id,
          validFrom: getAssignmentFormString(formData, "validFrom"),
          validTo: getAssignmentFormString(formData, "validTo"),
          active: formData.get("active") === "true",
          notes: getAssignmentFormString(formData, "notes"),
        });
      }}
    >
      <div className="grid gap-4 md:grid-cols-[minmax(9rem,1fr)_minmax(9rem,1fr)_auto] md:items-end">
        <Field
          label="Valid from"
          required
          reserveMessageSpace
          error={actionState?.fieldErrors?.validFrom}
        >
          {({ id, describedBy, invalid, required }) => (
            <Input
              id={id}
              name="validFrom"
              type="date"
              defaultValue={assignment.validFrom}
              aria-describedby={describedBy}
              invalid={invalid}
              required={required}
            />
          )}
        </Field>
        <Field label="Valid to" reserveMessageSpace error={actionState?.fieldErrors?.validTo}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="validTo"
              type="date"
              defaultValue={assignment.validTo ?? ""}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
        <label className="mb-6 inline-flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="active"
            value="true"
            defaultChecked={assignment.active}
            className={nativeCheckboxClassName}
          />
          Active
        </label>
      </div>
      <Field label="Notes" reserveMessageSpace error={actionState?.fieldErrors?.notes}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            name="notes"
            defaultValue={assignment.notes ?? ""}
            aria-describedby={describedBy}
            invalid={invalid}
          />
        )}
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" icon={Save} loading={pending}>
          Save assignment
        </Button>
      </div>
    </form>
  );
}

function ProjectEditDialog({
  project,
  pending,
  actionState,
  onOpenChange,
  onSubmit,
}: {
  project: AdminProjectRow | null;
  pending: boolean;
  actionState: ProjectActionState | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: UpdateProjectActionInput) => void;
}) {
  return (
    <Dialog open={Boolean(project)} onOpenChange={onOpenChange}>
      {project ? (
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit {project.name}</DialogTitle>
            <DialogDescription>
              Project changes are audited. Deactivate a project to prevent future time entry while
              keeping historical records intact.
            </DialogDescription>
          </DialogHeader>

          <form
            key={project.id}
            className="grid gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);

              onSubmit({
                projectId: project.id,
                name: getProjectEditFormString(formData, "name"),
                slug: getProjectEditFormString(formData, "slug"),
                startsOn: getProjectEditFormString(formData, "startsOn"),
                endsOn: getProjectEditFormString(formData, "endsOn"),
                isInternal: formData.get("isInternal") === "true",
                notes: getProjectEditFormString(formData, "notes"),
              });
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Project name"
                required
                reserveMessageSpace
                error={actionState?.fieldErrors?.name}
              >
                {({ id, describedBy, invalid, required }) => (
                  <Input
                    id={id}
                    name="name"
                    defaultValue={project.name}
                    autoComplete="off"
                    aria-describedby={describedBy}
                    invalid={invalid}
                    required={required}
                  />
                )}
              </Field>
              <Field label="Slug" reserveMessageSpace error={actionState?.fieldErrors?.slug}>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    name="slug"
                    defaultValue={project.slug}
                    autoComplete="off"
                    aria-describedby={describedBy}
                    invalid={invalid}
                  />
                )}
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(9rem,1fr)_minmax(9rem,1fr)]">
              <Field
                label="Starts on"
                reserveMessageSpace
                error={actionState?.fieldErrors?.startsOn}
              >
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    name="startsOn"
                    type="date"
                    defaultValue={project.startsOn ?? ""}
                    aria-describedby={describedBy}
                    invalid={invalid}
                  />
                )}
              </Field>
              <Field label="Ends on" reserveMessageSpace error={actionState?.fieldErrors?.endsOn}>
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    name="endsOn"
                    type="date"
                    defaultValue={project.endsOn ?? ""}
                    aria-describedby={describedBy}
                    invalid={invalid}
                  />
                )}
              </Field>
            </div>

            <label className="grid grid-cols-[auto_1fr] gap-x-3 rounded-[var(--radius-md)] border border-border bg-background/45 px-3 py-3">
              <input
                type="checkbox"
                name="isInternal"
                value="true"
                defaultChecked={project.isInternal}
                className={nativeCheckboxClassName}
              />
              <span className="grid gap-1">
                <span className="font-ui text-sm font-semibold text-foreground">
                  Internal project
                </span>
                <span className="text-xs leading-5 text-muted-foreground">
                  Use for internal or collector work such as team building, communication, or
                  operational tasks.
                </span>
              </span>
            </label>

            <Field label="Notes" reserveMessageSpace error={actionState?.fieldErrors?.notes}>
              {({ id, describedBy, invalid }) => (
                <Textarea
                  id={id}
                  name="notes"
                  defaultValue={project.notes ?? ""}
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>

            {actionState?.status === "error" && actionState.message ? (
              <p
                role="alert"
                className="rounded-[var(--radius-md)] border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {actionState.message}
              </p>
            ) : null}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost" disabled={pending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" icon={Edit3} loading={pending}>
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function ArchiveProjectDialog({
  project,
  pending,
  onOpenChange,
  onConfirm,
}: {
  project: AdminProjectRow | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (project: AdminProjectRow) => void;
}) {
  return (
    <Dialog open={Boolean(project)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{project ? `Archive ${project.name}?` : "Archive project?"}</DialogTitle>
          <DialogDescription>
            Archived projects disappear from working admin lists and future assignment/time-entry
            flows, but historical records remain linked for reporting.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          This is a soft delete. Use it only when the project should no longer be selectable.
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
              if (project) onConfirm(project);
            }}
          >
            Archive project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getAdminProjectRow(rows: AdminProjectRow[], row: ProjectTableRow) {
  return rows.find((candidate) => candidate.id === row.id) ?? null;
}

function formatStatus(status: ProjectLifecycleStatus | ProjectAssignmentMemberStatus) {
  return status.toLowerCase();
}

function formatProfile(profile: ProjectAssignmentMemberProfile) {
  return profile.toLowerCase();
}

function formatProjectTimeline(project: AdminProjectRow) {
  if (project.startsOn && project.endsOn) return `${project.startsOn} to ${project.endsOn}`;
  if (project.startsOn) return `From ${project.startsOn}`;
  if (project.endsOn) return `Until ${project.endsOn}`;
  return "Open-ended";
}

function formatAssignmentTimeline(assignment: AdminProjectAssignmentRow) {
  if (assignment.validTo) return `${assignment.validFrom} to ${assignment.validTo}`;
  return `From ${assignment.validFrom}`;
}

function getAssignmentRateSource(
  assignment: AdminProjectAssignmentRow,
  assignmentRates: AdminAssignmentRateRow[],
): {
  label: string;
  detail: string;
  tone: BadgeProps["tone"];
} {
  if (assignment.memberProfile === "EMPLOYEE") {
    return {
      label: "Central rate",
      detail: "Employee assignments use the member central rate.",
      tone: "neutral",
    };
  }

  const rate = assignmentRates.find((candidate) => candidate.assignmentId === assignment.id);

  if (rate?.currentOverrideRate) {
    return {
      label: "Project override",
      detail: `${formatRatePeriodAmount(rate.currentOverrideRate)} current override.`,
      tone: "info",
    };
  }

  if (rate?.overrideRatePeriods.length) {
    return {
      label: "Scheduled override",
      detail: `${rate.overrideRatePeriods.length} override period${
        rate.overrideRatePeriods.length === 1 ? "" : "s"
      } scheduled.`,
      tone: "warning",
    };
  }

  return {
    label: "Central rate",
    detail: "Contractor assignment currently uses the member central rate.",
    tone: "neutral",
  };
}

function formatRatePeriodAmount(
  period: NonNullable<AdminAssignmentRateRow["currentOverrideRate"]>,
) {
  const numericAmount = Number(period.hourlyRate);
  const amount = Number.isFinite(numericAmount)
    ? new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2,
      }).format(numericAmount)
    : period.hourlyRate;

  return `${amount} ${period.currencyCode}/h`;
}

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toISOString().slice(0, 16).replace("T", " ");
}

function getProjectEditFormString(formData: FormData, name: keyof UpdateProjectActionInput) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function getAssignmentFormString(formData: FormData, name: ProjectAssignmentFormField) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
