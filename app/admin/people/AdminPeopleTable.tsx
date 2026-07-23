"use client";

import {
  Archive,
  Ban,
  KeyRound,
  LogOut,
  Mail,
  MoreHorizontal,
  RotateCcw,
  ShieldCheck,
  UserMinus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
import { IconButton } from "@/src/components/ui/IconButton";
import type { MemberPreferenceOptions } from "@/src/lib/member-preferences";
import { cn } from "@/src/lib/utils";
import type { AdminPersonRow } from "@/src/server/users";
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
  rows: AdminPersonRow[];
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

export function AdminPeopleTable({
  rows,
  currentMemberId,
  preferenceOptions,
  todayDate,
}: AdminPeopleTableProps) {
  const t = useTranslations("AdminPeople");
  const router = useRouter();
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
      <PeopleTable
        rows={rows}
        labels={{
          caption: t("table.caption"),
          ariaLabel: t("table.ariaLabel"),
          rowActionsLabel: t("table.rowActions"),
          empty: t("table.emptyInvited"),
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
        <div className="rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
        <div className="rounded-[var(--radius-md)] border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
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
