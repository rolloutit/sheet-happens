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
  SquareStack,
  UserPlus,
  WalletCards,
  X,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Children, type FormEvent, useState, useTransition, type ReactNode } from "react";

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
import { Pager } from "@/src/components/ui/Pager";
import { SegmentedControl } from "@/src/components/ui/SegmentedControl";
import { DataTable } from "@/src/components/ui/Table";
import { Textarea } from "@/src/components/ui/Textarea";
import {
  DEFAULT_PROJECT_COLOR_TOKEN,
  isProjectColorToken,
  type ProjectColorToken,
} from "@/src/lib/project-colors";
import { cn } from "@/src/lib/utils";
import type {
  AdminProjectAssignmentRow,
  AdminProjectGroupRow,
  AdminProjectOptionRow,
  AdminProjectRow,
  ProjectAssignableMemberRow,
  ProjectAssignmentMemberProfile,
  ProjectAssignmentMemberStatus,
  ProjectListResult,
  ProjectLifecycleStatus,
} from "@/src/server/projects";
import type { AdminAssignmentRateRow } from "@/src/server/rates";
import {
  archiveProjectAction,
  assignProjectMemberAction,
  bulkAssignProjectMembersAction,
  closeProjectAssignmentAction,
  setProjectActiveAction,
  updateProjectAction,
  updateProjectAssignmentAction,
} from "./actions";
import type {
  AssignProjectMemberActionInput,
  BulkAssignProjectMembersActionInput,
  CloseProjectAssignmentActionInput,
  ProjectAssignmentActionState,
  ProjectAssignmentFormField,
  ProjectActionState,
  ProjectBulkAssignmentActionState,
  UpdateProjectAssignmentActionInput,
  UpdateProjectActionInput,
} from "./actions.types";
import { nativeCheckboxClassName, nativeSelectClassName } from "./formStyles";
import { ProjectColorField, ProjectColorSwatch } from "./ProjectColorField";

export type AdminProjectsTableProps = {
  result: ProjectListResult;
  projectOptions: AdminProjectOptionRow[];
  groups: AdminProjectGroupRow[];
  assignments: AdminProjectAssignmentRow[];
  assignmentRates: AdminAssignmentRateRow[];
  assignableMembers: ProjectAssignableMemberRow[];
  todayDate: string;
};

type ProjectTableRow = AdminProjectRow & Record<string, unknown>;
type PendingAction = "edit" | "status" | "archive";
type AdminProjectsTranslator = ReturnType<typeof useTranslations>;
type ProjectFilterFormState = {
  assignment: ProjectListResult["filters"]["assignment"];
  group: string;
  query: string;
  status: ProjectListResult["filters"]["status"];
  timeline: ProjectListResult["filters"]["timeline"];
  type: ProjectListResult["filters"]["type"];
};

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
  result,
  projectOptions,
  groups,
  assignments,
  assignmentRates,
  assignableMembers,
  todayDate,
}: AdminProjectsTableProps) {
  const t = useTranslations("AdminProjects");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rows = result.rows;
  const [message, setMessage] = useState<ProjectActionState | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<AdminProjectRow | null>(null);
  const [editState, setEditState] = useState<ProjectActionState | null>(null);
  const [archivingProject, setArchivingProject] = useState<AdminProjectRow | null>(null);
  const [detailProject, setDetailProject] = useState<AdminProjectRow | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<ProjectBulkAssignmentActionState | null>(null);
  const [assignmentMessage, setAssignmentMessage] = useState<ProjectAssignmentActionState | null>(
    null,
  );
  const [assignmentPendingKey, setAssignmentPendingKey] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [, startTransition] = useTransition();
  const tableRows = rows as ProjectTableRow[];

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

  function updatePage(page: number) {
    const params = new URLSearchParams(searchParams.toString());

    if (page <= 1) params.delete("page");
    else params.set("page", String(page));

    router.push(buildUrl(pathname, params) as Route);
  }

  function applyFilters(filters: ProjectFilterFormState) {
    const params = new URLSearchParams(searchParams.toString());

    setParam(params, "q", filters.query);
    setParam(params, "status", filters.status);
    setParam(params, "type", filters.type);
    setParam(params, "timeline", filters.timeline);
    setParam(params, "group", filters.group);
    setParam(params, "assignment", filters.assignment);
    params.delete("page");
    setMessage(null);

    router.push(buildUrl(pathname, params) as Route);
  }

  function clearFilters() {
    setMessage(null);
    router.push(pathname as Route);
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

  function runBulkAssignmentAction(input: BulkAssignProjectMembersActionInput) {
    setBulkPending(true);
    setBulkMessage(null);

    startTransition(async () => {
      const result = await bulkAssignProjectMembersAction(input);
      setBulkMessage(result);
      setBulkPending(false);

      if (result.status === "success" && result.createdCount && result.createdCount > 0) {
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
              ? "border-destructive/40 bg-destructive-soft text-destructive"
              : "border-success/40 bg-success-soft text-success",
          )}
        >
          {message.message}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="soft"
          icon={SquareStack}
          onClick={() => {
            setBulkDialogOpen(true);
            setBulkMessage(null);
          }}
        >
          {t("actions.bulkAssign")}
        </Button>
      </div>

      <ProjectDirectoryFilters
        key={getProjectFilterKey(result.filters)}
        result={result}
        groups={groups}
        onApply={applyFilters}
        onClear={clearFilters}
      />

      <DataTable
        caption={t("table.caption")}
        aria-label={t("table.ariaLabel")}
        rows={tableRows}
        empty={rows.length ? t("table.emptyFiltered") : t("table.empty")}
        getRowKey={(row) => row.id}
        displayMode="responsive"
        density="comfortable"
        columns={[
          {
            id: "name",
            header: t("table.columns.project"),
            mobileLabel: t("table.columns.project"),
            cell: (row) => (
              <div className="grid grid-cols-[auto_1fr] gap-3">
                <ProjectColorSwatch colorToken={row.colorToken} size="lg" className="mt-1" />
                <div className="grid min-w-0 gap-1">
                  <p className="font-ui text-sm font-semibold text-foreground">{row.name}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded-[var(--radius-sm)] bg-secondary px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {row.slug}
                    </code>
                    {row.isInternal ? <Badge tone="cta">{t("states.internal")}</Badge> : null}
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
              </div>
            ),
          },
          {
            id: "status",
            header: t("table.columns.state"),
            accessor: "status",
            mobileLabel: t("table.columns.state"),
            cell: (row) => (
              <Badge tone={statusTone[row.status]}>{getProjectStatusLabel(row.status, t)}</Badge>
            ),
          },
          {
            id: "timeline",
            header: t("table.columns.timeline"),
            mobileLabel: t("table.columns.timeline"),
            cell: (row) => (
              <span className="text-sm text-muted-foreground">{formatProjectTimeline(row, t)}</span>
            ),
          },
          {
            id: "usage",
            header: t("table.columns.usage"),
            mobileLabel: t("table.columns.usage"),
            cell: (row) => (
              <div className="grid gap-1 text-sm text-muted-foreground">
                <span>{t("table.assignmentCount", { count: row.assignmentCount })}</span>
                <span>{t("table.groupCount", { count: row.groupCount })}</span>
              </div>
            ),
          },
          {
            id: "updatedAt",
            header: t("table.columns.updated"),
            accessor: "updatedAt",
            mobileLabel: t("table.columns.updated"),
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

      <Pager
        page={result.filters.page}
        totalPages={result.totalPages}
        totalItems={result.totalItems}
        showPageNumbers
        onPageChange={updatePage}
        labels={{
          navigation: t("pager.navigation"),
          previous: t("pager.previous"),
          next: t("pager.next"),
          previousPage: (page) => t("pager.previousPage", { page }),
          nextPage: (page) => t("pager.nextPage", { page }),
          page: (page) => t("pager.page", { page }),
          currentPage: (page) => t("pager.currentPage", { page }),
          summary: (page, totalPages, totalItems) =>
            t("pager.summary", { page, totalPages, totalItems: totalItems ?? 0 }),
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

      <BulkAssignmentDialog
        open={bulkDialogOpen}
        projects={projectOptions}
        members={assignableMembers}
        assignments={assignments}
        todayDate={todayDate}
        actionState={bulkMessage}
        pending={bulkPending}
        onOpenChange={(open) => {
          setBulkDialogOpen(open);
          if (!open) setBulkMessage(null);
        }}
        onSubmit={runBulkAssignmentAction}
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

function ProjectDirectoryFilters({
  result,
  groups,
  onApply,
  onClear,
}: {
  result: ProjectListResult;
  groups: AdminProjectGroupRow[];
  onApply: (filters: ProjectFilterFormState) => void;
  onClear: () => void;
}) {
  const t = useTranslations("AdminProjects");
  const [filterForm, setFilterForm] = useState<ProjectFilterFormState>(() => ({
    query: result.filters.query,
    status: result.filters.status,
    type: result.filters.type,
    timeline: result.filters.timeline,
    group: result.filters.group,
    assignment: result.filters.assignment,
  }));

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply(filterForm);
  }

  function clearFilters() {
    setFilterForm({
      query: "",
      status: "",
      type: "",
      timeline: "",
      group: "",
      assignment: "",
    });
    onClear();
  }

  return (
    <form
      className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-background/45 p-4"
      onSubmit={submitFilters}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(16rem,1.4fr)_repeat(5,minmax(8.5rem,1fr))]">
        <Field label={t("filters.search")} htmlFor="project-search">
          <Input
            id="project-search"
            name="q"
            type="search"
            value={filterForm.query}
            placeholder={t("filters.searchPlaceholder")}
            onChange={(event) => {
              const query = event.currentTarget.value;
              setFilterForm((current) => ({
                ...current,
                query,
              }));
            }}
          />
        </Field>
        <Field label={t("filters.state")} htmlFor="project-status">
          <select
            id="project-status"
            name="status"
            value={filterForm.status}
            className={nativeSelectClassName}
            onChange={(event) => {
              const status = event.currentTarget.value as ProjectFilterFormState["status"];
              setFilterForm((current) => ({
                ...current,
                status,
              }));
            }}
          >
            <option value="">{t("filters.all")}</option>
            <option value="ACTIVE">{t("states.active")}</option>
            <option value="INACTIVE">{t("states.inactive")}</option>
          </select>
        </Field>
        <Field label={t("filters.type")} htmlFor="project-type">
          <select
            id="project-type"
            name="type"
            value={filterForm.type}
            className={nativeSelectClassName}
            onChange={(event) => {
              const type = event.currentTarget.value as ProjectFilterFormState["type"];
              setFilterForm((current) => ({
                ...current,
                type,
              }));
            }}
          >
            <option value="">{t("filters.all")}</option>
            <option value="external">{t("states.external")}</option>
            <option value="internal">{t("states.internal")}</option>
          </select>
        </Field>
        <Field label={t("filters.timeline")} htmlFor="project-timeline">
          <select
            id="project-timeline"
            name="timeline"
            value={filterForm.timeline}
            className={nativeSelectClassName}
            onChange={(event) => {
              const timeline = event.currentTarget.value as ProjectFilterFormState["timeline"];
              setFilterForm((current) => ({
                ...current,
                timeline,
              }));
            }}
          >
            <option value="">{t("filters.all")}</option>
            <option value="current">{t("filters.current")}</option>
            <option value="future">{t("filters.future")}</option>
            <option value="ended">{t("filters.ended")}</option>
          </select>
        </Field>
        <Field label={t("filters.group")} htmlFor="project-group">
          <select
            id="project-group"
            name="group"
            value={filterForm.group}
            className={nativeSelectClassName}
            onChange={(event) => {
              const group = event.currentTarget.value;
              setFilterForm((current) => ({
                ...current,
                group,
              }));
            }}
          >
            <option value="">{t("filters.all")}</option>
            <option value="ungrouped">{t("states.ungrouped")}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("filters.assignment")} htmlFor="project-assignment">
          <select
            id="project-assignment"
            name="assignment"
            value={filterForm.assignment}
            className={nativeSelectClassName}
            onChange={(event) => {
              const assignment = event.currentTarget.value as ProjectFilterFormState["assignment"];
              setFilterForm((current) => ({
                ...current,
                assignment,
              }));
            }}
          >
            <option value="">{t("filters.all")}</option>
            <option value="assigned">{t("filters.assigned")}</option>
            <option value="unassigned">{t("filters.unassigned")}</option>
          </select>
        </Field>
      </div>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
          {t("filters.showing", {
            start: result.pageStart,
            end: result.pageEnd,
            total: result.totalItems,
          })}
        </p>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button type="submit" icon={Search}>
            {t("filters.apply")}
          </Button>
          <Button type="button" variant="ghost" icon={X} onClick={clearFilters}>
            {t("filters.clear")}
          </Button>
        </div>
      </div>
    </form>
  );
}

function getProjectFilterKey(filters: ProjectListResult["filters"]) {
  return [
    filters.query,
    filters.status,
    filters.type,
    filters.timeline,
    filters.group,
    filters.assignment,
    filters.page,
    filters.pageSize,
  ].join(":");
}

function setParam(params: URLSearchParams, key: string, value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim() : "";

  if (normalized) params.set(key, normalized);
  else params.delete(key);
}

function buildUrl(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
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
  const t = useTranslations("AdminProjects");
  const nextActive = project.status !== "ACTIVE";

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <IconButton
          icon={MoreHorizontal}
          label={t("actions.openFor", { name: project.name })}
          size="sm"
          variant="ghost"
        />
      </DropdownTrigger>
      <DropdownContent align="end">
        <DropdownLabel>{t("actions.menuLabel")}</DropdownLabel>
        <DropdownItem onSelect={onOpenDetails}>
          <FolderOpen className="size-4" aria-hidden="true" />
          {t("actions.openDetails")}
        </DropdownItem>
        <DropdownItem disabled={isPending("edit")} onSelect={onEdit}>
          <Edit3 className="size-4" aria-hidden="true" />
          {t("actions.editProject")}
        </DropdownItem>
        <DropdownItem disabled={isPending("status")} onSelect={() => onSetActive(nextActive)}>
          {nextActive ? (
            <CheckCircle2 className="size-4" aria-hidden="true" />
          ) : (
            <PauseCircle className="size-4" aria-hidden="true" />
          )}
          {nextActive ? t("actions.activate") : t("actions.deactivate")}
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem tone="danger" disabled={isPending("archive")} onSelect={onArchive}>
          <Archive className="size-4" aria-hidden="true" />
          {t("actions.archive")}
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}

type BulkAssignmentMode = "people-to-projects" | "projects-to-people";

function BulkAssignmentDialog({
  open,
  projects,
  members,
  assignments,
  todayDate,
  actionState,
  pending,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  projects: AdminProjectOptionRow[];
  members: ProjectAssignableMemberRow[];
  assignments: AdminProjectAssignmentRow[];
  todayDate: string;
  actionState: ProjectBulkAssignmentActionState | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: BulkAssignProjectMembersActionInput) => void;
}) {
  const t = useTranslations("AdminProjects");
  const [mode, setMode] = useState<BulkAssignmentMode>("people-to-projects");
  const [memberQuery, setMemberQuery] = useState("");
  const [projectQuery, setProjectQuery] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [validFrom, setValidFrom] = useState(todayDate);
  const [validTo, setValidTo] = useState("");
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState("");

  const activeProjects = projects.filter((project) => project.status !== "ARCHIVED");
  const filteredMembers = filterMembers(members, memberQuery);
  const filteredProjects = filterProjects(activeProjects, projectQuery);
  const summary = getBulkAssignmentSummary({
    assignments,
    memberIds: selectedMemberIds,
    projectIds: selectedProjectIds,
    validFrom,
    validTo,
  });
  const submitDisabled =
    pending ||
    selectedMemberIds.length === 0 ||
    selectedProjectIds.length === 0 ||
    !validFrom ||
    summary.newCount === 0;

  function reset() {
    setMode("people-to-projects");
    setMemberQuery("");
    setProjectQuery("");
    setSelectedMemberIds([]);
    setSelectedProjectIds([]);
    setValidFrom(todayDate);
    setValidTo("");
    setActive(true);
    setNotes("");
  }

  function toggleMember(memberId: string) {
    setSelectedMemberIds((current) => toggleSelection(current, memberId));
  }

  function toggleProject(projectId: string) {
    setSelectedProjectIds((current) => toggleSelection(current, projectId));
  }

  const peoplePanel = (
    <BulkSelectionPanel
      title={t("bulk.people")}
      searchLabel={t("bulk.searchPeople")}
      searchValue={memberQuery}
      onSearchChange={setMemberQuery}
      empty={t("bulk.noMembers")}
    >
      {filteredMembers.map((member) => {
        const duplicateCount = getDuplicateCountForMember(member.id, summary.duplicates);

        return (
          <BulkSelectionRow
            key={member.id}
            checked={selectedMemberIds.includes(member.id)}
            title={member.name}
            subtitle={member.email}
            badges={[
              {
                label: getAssignmentProfileLabel(member.profile, t),
                tone: assignmentProfileTone[member.profile],
              },
              {
                label: getAssignmentStatusLabel(member.status, t),
                tone: assignmentStatusTone[member.status],
              },
              duplicateCount
                ? {
                    label: t("bulk.duplicateCount", { count: duplicateCount }),
                    tone: "warning",
                  }
                : null,
            ]}
            onToggle={() => toggleMember(member.id)}
          />
        );
      })}
    </BulkSelectionPanel>
  );

  const projectsPanel = (
    <BulkSelectionPanel
      title={t("bulk.projects")}
      searchLabel={t("bulk.searchProjects")}
      searchValue={projectQuery}
      onSearchChange={setProjectQuery}
      empty={t("bulk.noProjects")}
    >
      {filteredProjects.map((project) => {
        const duplicateCount = getDuplicateCountForProject(project.id, summary.duplicates);

        return (
          <BulkSelectionRow
            key={project.id}
            checked={selectedProjectIds.includes(project.id)}
            colorToken={project.colorToken}
            title={project.name}
            subtitle={formatProjectTimeline(project, t)}
            badges={[
              {
                label: getProjectStatusLabel(project.status, t),
                tone: statusTone[project.status],
              },
              project.isInternal
                ? {
                    label: t("states.internal"),
                    tone: "cta",
                  }
                : null,
              duplicateCount
                ? {
                    label: t("bulk.duplicateCount", { count: duplicateCount }),
                    tone: "warning",
                  }
                : null,
            ]}
            onToggle={() => toggleProject(project.id)}
          />
        );
      })}
    </BulkSelectionPanel>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t("bulk.title")}</DialogTitle>
          <DialogDescription>{t("bulk.description")}</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[74vh] gap-5 overflow-y-auto pr-1">
          {actionState?.message ? (
            <p
              role={actionState.status === "error" ? "alert" : "status"}
              className={cn(
                "rounded-[var(--radius-md)] border px-3 py-2 text-sm",
                actionState.status === "error"
                  ? "border-destructive/40 bg-destructive-soft text-destructive"
                  : "border-success/40 bg-success-soft text-success",
              )}
            >
              {actionState.message}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <SegmentedControl
              label={t("bulk.mode")}
              size="sm"
              value={mode}
              onValueChange={(value) => setMode(value as BulkAssignmentMode)}
              items={[
                { value: "people-to-projects", label: t("bulk.peopleToProjects") },
                { value: "projects-to-people", label: t("bulk.projectsToPeople") },
              ]}
            />
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link href="/admin/rates">
                <WalletCards className="size-4" aria-hidden="true" />
                {t("actions.manageRates")}
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {mode === "people-to-projects" ? peoplePanel : projectsPanel}
            {mode === "people-to-projects" ? projectsPanel : peoplePanel}
          </div>

          <div className="grid gap-4 rounded-[var(--radius-lg)] border border-border bg-background/45 p-4 md:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_auto] md:items-start">
            <Field
              label={t("assignment.validFrom")}
              required
              reserveMessageSpace
              error={actionState?.fieldErrors?.validFrom}
            >
              {({ id, describedBy, invalid, required }) => (
                <Input
                  id={id}
                  type="date"
                  value={validFrom}
                  onChange={(event) => setValidFrom(event.target.value)}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  required={required}
                />
              )}
            </Field>
            <Field
              label={t("assignment.validTo")}
              reserveMessageSpace
              error={actionState?.fieldErrors?.validTo}
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  type="date"
                  value={validTo}
                  onChange={(event) => setValidTo(event.target.value)}
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>
            <label className="mt-8 inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
                className={nativeCheckboxClassName}
              />
              {t("states.active")}
            </label>
            <div className="md:col-span-3">
              <Field
                label={t("form.notes")}
                reserveMessageSpace
                error={actionState?.fieldErrors?.notes}
              >
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    placeholder={t("bulk.notesPlaceholder")}
                  />
                )}
              </Field>
            </div>
          </div>

          <div className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <ProjectFact label={t("bulk.newAssignments")} value={String(summary.newCount)} />
              <ProjectFact label={t("bulk.duplicates")} value={String(summary.duplicateCount)} />
              <ProjectFact label={t("bulk.selectedPairs")} value={String(summary.totalCount)} />
            </div>
            <p className="text-sm leading-6 text-muted-foreground">{t("bulk.rateHint")}</p>
            {summary.totalCount > 0 && summary.newCount === 0 ? (
              <p className="rounded-[var(--radius-md)] border border-warning/35 bg-warning-soft px-3 py-2 text-sm text-warning">
                {t("bulk.allDuplicates")}
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={pending}>
              {t("actions.cancel")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            icon={UserPlus}
            loading={pending}
            disabled={submitDisabled}
            onClick={() =>
              onSubmit({
                memberIds: selectedMemberIds,
                projectIds: selectedProjectIds,
                validFrom,
                validTo,
                active,
                notes,
              })
            }
          >
            {t("actions.assignCount", { count: summary.newCount })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkSelectionPanel({
  title,
  searchLabel,
  searchValue,
  onSearchChange,
  empty,
  children,
}: {
  title: string;
  searchLabel: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  empty: string;
  children: ReactNode;
}) {
  const childCount = Children.count(children);

  return (
    <section className="grid min-h-80 gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-3">
      <div className="grid gap-2">
        <h3 className="font-ui text-sm font-semibold text-foreground">{title}</h3>
        <label className="flex h-9 items-center gap-2 rounded-[var(--radius-md)] border border-border bg-background px-3">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">{searchLabel}</span>
          <input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search..."
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-subtle-foreground"
          />
        </label>
      </div>
      <div className="grid max-h-80 content-start gap-2 overflow-y-auto pr-1">
        {childCount > 0 ? children : <p className="p-3 text-sm text-muted-foreground">{empty}</p>}
      </div>
    </section>
  );
}

function BulkSelectionRow({
  checked,
  colorToken,
  title,
  subtitle,
  badges,
  onToggle,
}: {
  checked: boolean;
  colorToken?: ProjectColorToken;
  title: string;
  subtitle: string;
  badges: Array<{ label: string; tone: BadgeProps["tone"] } | null>;
  onToggle: () => void;
}) {
  const visibleBadges = badges.filter(
    (badge): badge is { label: string; tone: BadgeProps["tone"] } => Boolean(badge),
  );

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "grid gap-2 rounded-[var(--radius-md)] border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked
          ? "border-primary bg-accent-soft"
          : "border-border bg-background hover:bg-secondary/45",
      )}
    >
      <span className="grid grid-cols-[auto_1fr] gap-3">
        <span
          className={cn(
            "mt-0.5 grid size-5 place-items-center rounded border",
            checked ? "border-primary bg-primary text-primary-foreground" : "border-border",
          )}
          aria-hidden="true"
        >
          {checked ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : null}
        </span>
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-2 font-ui text-sm font-semibold text-foreground">
            {colorToken ? <ProjectColorSwatch colorToken={colorToken} size="sm" /> : null}
            <span className="truncate">{title}</span>
          </span>
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        </span>
      </span>
      <span className="flex flex-wrap gap-1.5">
        {visibleBadges.map((badge) => (
          <Badge key={`${badge.label}-${badge.tone}`} tone={badge.tone}>
            {badge.label}
          </Badge>
        ))}
      </span>
    </button>
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
  const t = useTranslations("AdminProjects");
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
                <div className="flex min-w-0 gap-3">
                  <ProjectColorSwatch colorToken={project.colorToken} size="lg" className="mt-1" />
                  <div className="grid min-w-0 gap-2">
                    <p className="font-ui text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                      {t("detail.eyebrow")}
                    </p>
                    <DrawerTitle className="text-2xl font-semibold text-foreground">
                      {project.name}
                    </DrawerTitle>
                    <DrawerDescription className="text-sm leading-6 text-muted-foreground">
                      {formatProjectTimeline(project, t)}
                    </DrawerDescription>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon={Edit3}
                    onClick={onEditProject}
                  >
                    {t("actions.edit")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon={nextActive ? CheckCircle2 : PauseCircle}
                    loading={projectPendingAction}
                    onClick={() => onSetProjectActive(nextActive)}
                  >
                    {nextActive ? t("actions.activate") : t("actions.deactivate")}
                  </Button>
                </div>
              </div>
            </DrawerHeader>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge tone={statusTone[project.status]}>
                {getProjectStatusLabel(project.status, t)}
              </Badge>
              {project.isInternal ? <Badge tone="cta">{t("states.internal")}</Badge> : null}
              {project.groups.length === 0 ? (
                <Badge tone="neutral">{t("states.ungrouped")}</Badge>
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
              <div className="rounded-[var(--radius-lg)] border border-warning/35 bg-warning-soft px-4 py-3 text-sm leading-6 text-warning">
                {t("detail.inactiveWarning")}
              </div>
            ) : null}

            {actionState?.message ? (
              <p
                role={actionState.status === "error" ? "alert" : "status"}
                className={cn(
                  "rounded-[var(--radius-md)] border px-3 py-2 text-sm",
                  actionState.status === "error"
                    ? "border-destructive/40 bg-destructive-soft text-destructive"
                    : "border-success/40 bg-success-soft text-success",
                )}
              >
                {actionState.message}
              </p>
            ) : null}

            <section className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <ProjectFact label={t("detail.assignments")} value={String(assignments.length)} />
                <ProjectFact label={t("detail.groups")} value={String(project.groupCount)} />
                <ProjectFact
                  label={t("detail.updated")}
                  value={formatTimestamp(project.updatedAt)}
                />
              </div>
              <div className="rounded-[var(--radius-lg)] border border-border bg-card p-4">
                <p className="font-ui text-sm font-semibold text-foreground">{t("form.notes")}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {project.notes || t("detail.noNotes")}
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
                <h3 className="font-ui text-sm font-semibold text-foreground">
                  {t("assignment.addTitle")}
                </h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t("assignment.addDescription")}
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(14rem,1.4fr)_minmax(9rem,0.7fr)_minmax(9rem,0.7fr)]">
                <Field
                  label={t("assignment.member")}
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
                        {t("assignment.chooseMember")}
                      </option>
                      {assignableMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} - {getAssignmentProfileLabel(member.profile, t)},{" "}
                          {getAssignmentStatusLabel(member.status, t)}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field
                  label={t("assignment.validFrom")}
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
                  label={t("assignment.validTo")}
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
                <Field
                  label={t("form.notes")}
                  reserveMessageSpace
                  error={actionState?.fieldErrors?.notes}
                >
                  {({ id, describedBy, invalid }) => (
                    <Input
                      id={id}
                      name="notes"
                      aria-describedby={describedBy}
                      invalid={invalid}
                      placeholder={t("assignment.notesPlaceholder")}
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

              <div className="flex justify-end">
                <Button
                  type="submit"
                  icon={UserPlus}
                  loading={assignPending}
                  disabled={assignableMembers.length === 0}
                >
                  {t("actions.assignMember")}
                </Button>
              </div>
            </form>

            <div className="grid gap-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-ui text-sm font-semibold text-foreground">
                    {t("assignment.assignedMembers")}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {t("assignment.assignedMembersDescription")}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" asChild>
                  <Link href="/admin/rates">
                    <WalletCards className="size-4" aria-hidden="true" />
                    {t("actions.manageRates")}
                  </Link>
                </Button>
              </div>

              {assignments.length === 0 ? (
                <div className="rounded-[var(--radius-lg)] border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                  {t("assignment.empty")}
                </div>
              ) : (
                assignments.map((assignment) => {
                  const editing = editingAssignmentId === assignment.id;
                  const updatePending = pendingKey === `${assignment.id}:update`;
                  const closePending = pendingKey === `${assignment.id}:close`;
                  const canEndToday = assignment.active && todayDate >= assignment.validFrom;
                  const rateSource = getAssignmentRateSource(assignment, assignmentRates, t);

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
                              {getAssignmentProfileLabel(assignment.memberProfile, t)}
                            </Badge>
                            <Badge tone={assignmentStatusTone[assignment.memberStatus]}>
                              {getAssignmentStatusLabel(assignment.memberStatus, t)}
                            </Badge>
                            <Badge tone={assignment.active ? "success" : "neutral"}>
                              {assignment.active ? t("states.active") : t("states.inactive")}
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
                              {editing ? t("actions.cancel") : t("actions.edit")}
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
                              {t("actions.endToday")}
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
  const t = useTranslations("AdminProjects");

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
          label={t("assignment.validFrom")}
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
        <Field
          label={t("assignment.validTo")}
          reserveMessageSpace
          error={actionState?.fieldErrors?.validTo}
        >
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
          {t("states.active")}
        </label>
      </div>
      <Field label={t("form.notes")} reserveMessageSpace error={actionState?.fieldErrors?.notes}>
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
          {t("actions.cancel")}
        </Button>
        <Button type="submit" icon={Save} loading={pending}>
          {t("actions.saveAssignment")}
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
  const t = useTranslations("AdminProjects");

  return (
    <Dialog open={Boolean(project)} onOpenChange={onOpenChange}>
      {project ? (
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("editDialog.title", { name: project.name })}</DialogTitle>
            <DialogDescription>{t("editDialog.description")}</DialogDescription>
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
                colorToken: getProjectEditFormColorToken(formData),
                startsOn: getProjectEditFormString(formData, "startsOn"),
                endsOn: getProjectEditFormString(formData, "endsOn"),
                isInternal: formData.get("isInternal") === "true",
                notes: getProjectEditFormString(formData, "notes"),
              });
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label={t("form.projectName")}
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
              <Field
                label={t("form.slug")}
                reserveMessageSpace
                error={actionState?.fieldErrors?.slug}
              >
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

            <ProjectColorField
              label={t("form.projectColor")}
              defaultValue={project.colorToken}
              error={actionState?.fieldErrors?.colorToken}
              reserveMessageSpace
            />

            <div className="grid gap-4 md:grid-cols-[minmax(9rem,1fr)_minmax(9rem,1fr)]">
              <Field
                label={t("form.startsOn")}
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
              <Field
                label={t("form.endsOn")}
                reserveMessageSpace
                error={actionState?.fieldErrors?.endsOn}
              >
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
                  {t("form.internalProject")}
                </span>
                <span className="text-xs leading-5 text-muted-foreground">
                  {t("form.internalProjectDescription")}
                </span>
              </span>
            </label>

            <Field
              label={t("form.notes")}
              reserveMessageSpace
              error={actionState?.fieldErrors?.notes}
            >
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
                className="rounded-[var(--radius-md)] border border-destructive/40 bg-destructive-soft px-3 py-2 text-sm text-destructive"
              >
                {actionState.message}
              </p>
            ) : null}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost" disabled={pending}>
                  {t("actions.cancel")}
                </Button>
              </DialogClose>
              <Button type="submit" icon={Edit3} loading={pending}>
                {t("actions.saveChanges")}
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
  const t = useTranslations("AdminProjects");

  return (
    <Dialog open={Boolean(project)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {project
              ? t("archiveDialog.titleNamed", { name: project.name })
              : t("archiveDialog.title")}
          </DialogTitle>
          <DialogDescription>{t("archiveDialog.description")}</DialogDescription>
        </DialogHeader>
        <div className="rounded-[var(--radius-md)] border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive">
          {t("archiveDialog.warning")}
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
              if (project) onConfirm(project);
            }}
          >
            {t("actions.archiveProject")}
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

function filterMembers(members: ProjectAssignableMemberRow[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return members;

  return members.filter((member) =>
    [member.name, member.email, formatProfile(member.profile), formatStatus(member.status)].some(
      (value) => value.toLowerCase().includes(normalizedQuery),
    ),
  );
}

function filterProjects(projects: AdminProjectOptionRow[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return projects;

  return projects.filter((project) =>
    [
      project.name,
      project.slug,
      formatStatus(project.status),
      project.isInternal ? "internal" : "",
    ].some((value) => value.toLowerCase().includes(normalizedQuery)),
  );
}

function toggleSelection(current: string[], value: string) {
  return current.includes(value)
    ? current.filter((candidate) => candidate !== value)
    : [...current, value];
}

function getBulkAssignmentSummary({
  assignments,
  memberIds,
  projectIds,
  validFrom,
  validTo,
}: {
  assignments: AdminProjectAssignmentRow[];
  memberIds: string[];
  projectIds: string[];
  validFrom: string;
  validTo: string;
}) {
  const duplicates: Array<{ memberId: string; projectId: string }> = [];
  const validRange = isDateOnlyString(validFrom) && (!validTo || isDateOnlyString(validTo));

  for (const memberId of memberIds) {
    for (const projectId of projectIds) {
      const duplicate =
        validRange &&
        assignments.some(
          (assignment) =>
            assignment.memberId === memberId &&
            assignment.projectId === projectId &&
            assignmentRangesOverlapStrings(
              { validFrom, validTo: validTo || null },
              { validFrom: assignment.validFrom, validTo: assignment.validTo },
            ),
        );

      if (duplicate) {
        duplicates.push({
          memberId,
          projectId,
        });
      }
    }
  }

  const totalCount = memberIds.length * projectIds.length;

  return {
    totalCount,
    newCount: validRange ? totalCount - duplicates.length : 0,
    duplicateCount: duplicates.length,
    duplicates,
  };
}

function getDuplicateCountForMember(
  memberId: string,
  duplicates: Array<{ memberId: string; projectId: string }>,
) {
  return duplicates.filter((duplicate) => duplicate.memberId === memberId).length;
}

function getDuplicateCountForProject(
  projectId: string,
  duplicates: Array<{ memberId: string; projectId: string }>,
) {
  return duplicates.filter((duplicate) => duplicate.projectId === projectId).length;
}

function assignmentRangesOverlapStrings(
  left: { validFrom: string; validTo: string | null },
  right: { validFrom: string; validTo: string | null },
) {
  const leftStart = Date.parse(`${left.validFrom}T00:00:00.000Z`);
  const rightStart = Date.parse(`${right.validFrom}T00:00:00.000Z`);
  const leftEnd = left.validTo ? Date.parse(`${left.validTo}T00:00:00.000Z`) : Infinity;
  const rightEnd = right.validTo ? Date.parse(`${right.validTo}T00:00:00.000Z`) : Infinity;

  return leftStart <= rightEnd && rightStart <= leftEnd;
}

function isDateOnlyString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function getProjectStatusLabel(status: ProjectLifecycleStatus, t: AdminProjectsTranslator) {
  if (status === "ACTIVE") return t("states.active");
  if (status === "INACTIVE") return t("states.inactive");
  return t("states.archived");
}

function getAssignmentStatusLabel(
  status: ProjectAssignmentMemberStatus,
  t: AdminProjectsTranslator,
) {
  if (status === "ACTIVE") return t("states.active");
  if (status === "INACTIVE") return t("states.inactive");
  if (status === "INVITED") return t("states.invited");
  return t("states.deleted");
}

function getAssignmentProfileLabel(
  profile: ProjectAssignmentMemberProfile,
  t: AdminProjectsTranslator,
) {
  return profile === "CONTRACTOR" ? t("profiles.contractor") : t("profiles.employee");
}

function formatProjectTimeline(
  project: Pick<AdminProjectRow, "startsOn" | "endsOn">,
  t: AdminProjectsTranslator,
) {
  if (project.startsOn && project.endsOn) {
    return t("timeline.range", { from: project.startsOn, to: project.endsOn });
  }
  if (project.startsOn) return t("timeline.from", { from: project.startsOn });
  if (project.endsOn) return t("timeline.until", { to: project.endsOn });
  return t("timeline.openEnded");
}

function formatAssignmentTimeline(assignment: AdminProjectAssignmentRow) {
  if (assignment.validTo) return `${assignment.validFrom} to ${assignment.validTo}`;
  return `From ${assignment.validFrom}`;
}

function getAssignmentRateSource(
  assignment: AdminProjectAssignmentRow,
  assignmentRates: AdminAssignmentRateRow[],
  t: AdminProjectsTranslator,
): {
  label: string;
  detail: string;
  tone: BadgeProps["tone"];
} {
  if (assignment.memberProfile === "EMPLOYEE") {
    return {
      label: t("rateSource.centralRate"),
      detail: t("rateSource.employeeCentralRate"),
      tone: "neutral",
    };
  }

  const rate = assignmentRates.find((candidate) => candidate.assignmentId === assignment.id);

  if (rate?.currentOverrideRate) {
    return {
      label: t("rateSource.projectOverride"),
      detail: t("rateSource.currentOverride", {
        rate: formatRatePeriodAmount(rate.currentOverrideRate),
      }),
      tone: "info",
    };
  }

  if (rate?.overrideRatePeriods.length) {
    return {
      label: t("rateSource.scheduledOverride"),
      detail: t("rateSource.scheduledOverrideDetail", {
        count: rate.overrideRatePeriods.length,
      }),
      tone: "warning",
    };
  }

  return {
    label: t("rateSource.centralRate"),
    detail: t("rateSource.contractorCentralRate"),
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

function getProjectEditFormColorToken(formData: FormData) {
  const value = getProjectEditFormString(formData, "colorToken");
  return isProjectColorToken(value) ? value : DEFAULT_PROJECT_COLOR_TOKEN;
}

function getAssignmentFormString(formData: FormData, name: ProjectAssignmentFormField) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
