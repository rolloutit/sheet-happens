"use client";

import {
  Archive,
  Ban,
  KeyRound,
  LogOut,
  Mail,
  MoreHorizontal,
  RotateCcw,
  Search,
  ShieldCheck,
  X,
  UserMinus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

import { PeopleTable } from "@/src/components/sheet/PeopleTable";
import type { PersonRoleValue, PersonTableRow } from "@/src/components/sheet/PeopleTable";
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
import { Pager } from "@/src/components/ui/Pager";
import type { MemberPreferenceOptions } from "@/src/lib/member-preferences";
import { cn } from "@/src/lib/utils";
import type { AdminPersonRow, PeopleListResult } from "@/src/server/users";
import {
  changeMemberRoleAction,
  deactivateMemberAction,
  reactivateMemberAction,
  restoreArchivedMemberAction,
  resetMemberTotpAction,
  resendMemberInviteAction,
  revokeMemberSessionsAction,
  revokeMemberInviteAction,
  softDeleteMemberAction,
} from "./actions";
import type { AdminPeopleActionState } from "./actions.types";
import { MemberEditDrawer } from "./MemberEditDrawer";

export type AdminPeopleTableProps = {
  result: PeopleListResult;
  currentMemberId: string;
  preferenceOptions: MemberPreferenceOptions;
  todayDate: string;
};

type PendingAction =
  | "resend"
  | "revoke"
  | "sessions"
  | "totp"
  | "deactivate"
  | "reactivate"
  | "restore"
  | "role"
  | "archive";

type FilterFormState = {
  profile: PeopleListResult["filters"]["profile"];
  query: string;
  role: PeopleListResult["filters"]["role"];
  state: PeopleListResult["filters"]["state"];
};

const selectClassName =
  "flex h-10 w-full rounded-[var(--radius-md)] border border-input bg-background/50 px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35";

export function AdminPeopleTable({
  result,
  currentMemberId,
  preferenceOptions,
  todayDate,
}: AdminPeopleTableProps) {
  const t = useTranslations("AdminPeople");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rows = result.rows;
  const [message, setMessage] = useState<AdminPeopleActionState | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<AdminPersonRow | null>(null);
  const [archivingMember, setArchivingMember] = useState<AdminPersonRow | null>(null);
  const [resettingTotpMember, setResettingTotpMember] = useState<AdminPersonRow | null>(null);
  const [, startTransition] = useTransition();

  function runAction(
    row: PersonTableRow,
    action: PendingAction,
    callback: () => Promise<AdminPeopleActionState>,
    options: { onSuccess?: () => void } = {},
  ) {
    setPendingKey(`${row.id}:${action}`);
    setMessage(null);

    startTransition(async () => {
      const result = await callback();
      setMessage(result);
      setPendingKey(null);

      if (result.status === "success") {
        options.onSuccess?.();
        router.refresh();
      }
    });
  }

  function isPending(row: PersonTableRow, action: PendingAction) {
    return pendingKey === `${row.id}:${action}`;
  }

  function updatePage(page: number) {
    const params = new URLSearchParams(searchParams.toString());

    if (page <= 1) params.delete("page");
    else params.set("page", String(page));

    router.push(buildUrl(pathname, params) as Route);
  }

  function applyFilters(filters: FilterFormState) {
    const params = new URLSearchParams(searchParams.toString());

    setParam(params, "q", filters.query);
    setParam(params, "state", filters.state);
    setParam(params, "role", filters.role);
    setParam(params, "profile", filters.profile);
    params.delete("page");
    setMessage(null);

    router.push(buildUrl(pathname, params) as Route);
  }

  function clearFilters() {
    setMessage(null);
    router.push(pathname as Route);
  }

  return (
    <div className="grid gap-4">
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
      <PeopleFiltersForm
        key={getFilterKey(result.filters)}
        result={result}
        onApply={applyFilters}
        onClear={clearFilters}
      />
      <PeopleTable
        rows={rows}
        labels={{
          caption: t("table.caption"),
          ariaLabel: t("table.ariaLabel"),
          rowActionsLabel: t("table.rowActions"),
          empty: t("table.emptyFiltered"),
          columns: {
            person: t("table.columns.person"),
            profile: t("table.columns.profile"),
            role: t("table.columns.role"),
            state: t("table.columns.state"),
            currency: t("table.columns.currency"),
          },
          profiles: {
            CONTRACTOR: t("profiles.contractor"),
            EMPLOYEE: t("profiles.employee"),
          },
          roles: {
            ADMIN: t("roles.admin"),
            MEMBER: t("roles.member"),
          },
          states: {
            active: t("states.active"),
            inactive: t("states.inactive"),
            invited: t("states.invited"),
            locked: t("states.locked"),
          },
          scheduledProfile: (profile, validFrom) =>
            t("table.scheduledProfile", { profile, validFrom }),
          edit: (row) => t("table.editMember", { name: row.name }),
        }}
        onEdit={(row) => {
          setEditingMember(getAdminPersonRow(rows, row));
          setMessage(null);
        }}
        rowActions={(row) => (
          <div className="flex justify-end">
            <PersonActionsMenu
              row={row}
              currentMemberId={currentMemberId}
              isPending={(action) => isPending(row, action)}
              onChangeRole={(role) => {
                runAction(row, "role", () => changeMemberRoleAction(row.id, role));
              }}
              onResend={() => runAction(row, "resend", () => resendMemberInviteAction(row.id))}
              onRevokeInvite={() =>
                runAction(row, "revoke", () => revokeMemberInviteAction(row.id))
              }
              onRevokeSessions={() =>
                runAction(row, "sessions", () => revokeMemberSessionsAction(row.id))
              }
              onResetTotp={() => {
                setResettingTotpMember(getAdminPersonRow(rows, row));
                setMessage(null);
              }}
              onDeactivate={() =>
                runAction(row, "deactivate", () => deactivateMemberAction(row.id))
              }
              onReactivate={() =>
                runAction(row, "reactivate", () => reactivateMemberAction(row.id))
              }
              onRestore={() => runAction(row, "restore", () => restoreArchivedMemberAction(row.id))}
              onArchive={() => {
                setArchivingMember(getAdminPersonRow(rows, row));
                setMessage(null);
              }}
            />
          </div>
        )}
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
      <ArchiveMemberDialog
        member={archivingMember}
        pending={archivingMember ? isPending(archivingMember, "archive") : false}
        onOpenChange={(open) => {
          if (!open) setArchivingMember(null);
        }}
        onConfirm={(row) => {
          runAction(row, "archive", () => softDeleteMemberAction(row.id), {
            onSuccess: () => setArchivingMember(null),
          });
        }}
      />
      <ResetTotpDialog
        member={resettingTotpMember}
        pending={resettingTotpMember ? isPending(resettingTotpMember, "totp") : false}
        onOpenChange={(open) => {
          if (!open) setResettingTotpMember(null);
        }}
        onConfirm={(row) => {
          runAction(row, "totp", () => resetMemberTotpAction(row.id), {
            onSuccess: () => setResettingTotpMember(null),
          });
        }}
      />
      <MemberEditDrawer
        member={editingMember}
        open={Boolean(editingMember)}
        preferenceOptions={preferenceOptions}
        todayDate={todayDate}
        onOpenChange={(open) => {
          if (!open) setEditingMember(null);
        }}
        onResult={setMessage}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

function getAdminPersonRow(rows: AdminPersonRow[], row: PersonTableRow) {
  return rows.find((candidate) => candidate.id === row.id) ?? null;
}

function PeopleFiltersForm({
  result,
  onApply,
  onClear,
}: {
  result: PeopleListResult;
  onApply: (filters: FilterFormState) => void;
  onClear: () => void;
}) {
  const t = useTranslations("AdminPeople");
  const [filterForm, setFilterForm] = useState<FilterFormState>(() => ({
    query: result.filters.query,
    state: result.filters.state,
    role: result.filters.role,
    profile: result.filters.profile,
  }));

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply(filterForm);
  }

  function clearFilters() {
    setFilterForm({
      query: "",
      state: "",
      role: "",
      profile: "",
    });
    onClear();
  }

  return (
    <form
      className="grid gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-4"
      onSubmit={submitFilters}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_repeat(3,minmax(9rem,12rem))]">
        <Field label={t("filters.search")} htmlFor="people-search">
          <Input
            id="people-search"
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
        <Field label={t("filters.state")} htmlFor="people-state">
          <select
            id="people-state"
            name="state"
            value={filterForm.state}
            className={selectClassName}
            onChange={(event) => {
              const state = event.currentTarget.value as FilterFormState["state"];

              setFilterForm((current) => ({
                ...current,
                state,
              }));
            }}
          >
            <option value="">{t("filters.allStates")}</option>
            <option value="active">{t("states.active")}</option>
            <option value="inactive">{t("states.inactive")}</option>
            <option value="invited">{t("states.invited")}</option>
            <option value="locked">{t("states.locked")}</option>
          </select>
        </Field>
        <Field label={t("filters.role")} htmlFor="people-role">
          <select
            id="people-role"
            name="role"
            value={filterForm.role}
            className={selectClassName}
            onChange={(event) => {
              const role = event.currentTarget.value as FilterFormState["role"];

              setFilterForm((current) => ({
                ...current,
                role,
              }));
            }}
          >
            <option value="">{t("filters.allRoles")}</option>
            <option value="ADMIN">{t("roles.admin")}</option>
            <option value="MEMBER">{t("roles.member")}</option>
          </select>
        </Field>
        <Field label={t("filters.profile")} htmlFor="people-profile">
          <select
            id="people-profile"
            name="profile"
            value={filterForm.profile}
            className={selectClassName}
            onChange={(event) => {
              const profile = event.currentTarget.value as FilterFormState["profile"];

              setFilterForm((current) => ({
                ...current,
                profile,
              }));
            }}
          >
            <option value="">{t("filters.allProfiles")}</option>
            <option value="CONTRACTOR">{t("profiles.contractor")}</option>
            <option value="EMPLOYEE">{t("profiles.employee")}</option>
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

function getFilterKey(filters: PeopleListResult["filters"]) {
  return [
    filters.query,
    filters.state,
    filters.role,
    filters.profile,
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

function PersonActionsMenu({
  row,
  currentMemberId,
  isPending,
  onChangeRole,
  onResend,
  onRevokeInvite,
  onRevokeSessions,
  onResetTotp,
  onDeactivate,
  onReactivate,
  onRestore,
  onArchive,
}: {
  row: PersonTableRow;
  currentMemberId: string;
  isPending: (action: PendingAction) => boolean;
  onChangeRole: (role: PersonRoleValue) => void;
  onResend: () => void;
  onRevokeInvite: () => void;
  onRevokeSessions: () => void;
  onResetTotp: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  onRestore: () => void;
  onArchive: () => void;
}) {
  const t = useTranslations("AdminPeople");

  if (row.state === "locked") {
    return (
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
          <DropdownItem disabled={isPending("restore")} onSelect={onRestore}>
            <RotateCcw className="size-4" aria-hidden="true" />
            {t("actions.restoreAccount")}
          </DropdownItem>
        </DropdownContent>
      </Dropdown>
    );
  }

  const isSelf = row.id === currentMemberId;
  const nextRole: PersonRoleValue = row.roleValue === "ADMIN" ? "MEMBER" : "ADMIN";

  return (
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
        {!isSelf ? (
          <DropdownItem disabled={isPending("role")} onSelect={() => onChangeRole(nextRole)}>
            <ShieldCheck className="size-4" aria-hidden="true" />
            {nextRole === "ADMIN" ? t("actions.makeAdmin") : t("actions.makeMember")}
          </DropdownItem>
        ) : null}
        {row.state === "invited" ? (
          <>
            <DropdownItem disabled={isPending("resend")} onSelect={onResend}>
              <Mail className="size-4" aria-hidden="true" />
              {t("actions.resendInvitation")}
            </DropdownItem>
            <DropdownItem disabled={isPending("revoke")} onSelect={onRevokeInvite}>
              <Ban className="size-4" aria-hidden="true" />
              {t("actions.revokeInvitation")}
            </DropdownItem>
          </>
        ) : null}
        {row.hasAuthUser && !isSelf ? (
          <>
            <DropdownItem disabled={isPending("sessions")} onSelect={onRevokeSessions}>
              <LogOut className="size-4" aria-hidden="true" />
              {t("actions.revokeSessions")}
            </DropdownItem>
            <DropdownItem disabled={isPending("totp")} onSelect={onResetTotp}>
              <KeyRound className="size-4" aria-hidden="true" />
              {t("actions.resetAuthenticator")}
            </DropdownItem>
          </>
        ) : null}
        {row.state === "active" && !isSelf ? (
          <DropdownItem disabled={isPending("deactivate")} onSelect={onDeactivate}>
            <UserMinus className="size-4" aria-hidden="true" />
            {t("actions.deactivate")}
          </DropdownItem>
        ) : null}
        {row.state === "inactive" && row.hasAuthUser ? (
          <DropdownItem disabled={isPending("reactivate")} onSelect={onReactivate}>
            <RotateCcw className="size-4" aria-hidden="true" />
            {t("actions.reactivate")}
          </DropdownItem>
        ) : null}
        {!isSelf ? (
          <>
            <DropdownSeparator />
            <DropdownItem tone="danger" onSelect={onArchive}>
              <Archive className="size-4" aria-hidden="true" />
              {t("actions.archive")}
            </DropdownItem>
          </>
        ) : null}
      </DropdownContent>
    </Dropdown>
  );
}

function ArchiveMemberDialog({
  member,
  pending,
  onOpenChange,
  onConfirm,
}: {
  member: AdminPersonRow | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (member: AdminPersonRow) => void;
}) {
  const t = useTranslations("AdminPeople");

  return (
    <Dialog open={Boolean(member)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {member
              ? t("archiveDialog.titleNamed", { name: member.name })
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
              if (member) onConfirm(member);
            }}
          >
            {t("actions.archiveMember")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetTotpDialog({
  member,
  pending,
  onOpenChange,
  onConfirm,
}: {
  member: AdminPersonRow | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (member: AdminPersonRow) => void;
}) {
  const t = useTranslations("AdminPeople");

  return (
    <Dialog open={Boolean(member)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {member
              ? t("resetTotpDialog.titleNamed", { name: member.name })
              : t("resetTotpDialog.title")}
          </DialogTitle>
          <DialogDescription>{t("resetTotpDialog.description")}</DialogDescription>
        </DialogHeader>
        <div className="rounded-[var(--radius-md)] border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning">
          {t("resetTotpDialog.warning")}
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
            icon={KeyRound}
            loading={pending}
            onClick={() => {
              if (member) onConfirm(member);
            }}
          >
            {t("actions.resetAuthenticator")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
