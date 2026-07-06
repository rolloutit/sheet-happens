"use client";

import {
  Archive,
  Ban,
  LogOut,
  Mail,
  MoreHorizontal,
  RotateCcw,
  ShieldCheck,
  UserMinus,
} from "lucide-react";
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
  "resend" | "revoke" | "sessions" | "deactivate" | "reactivate" | "role" | "archive";

export function AdminPeopleTable({
  rows,
  currentMemberId,
  preferenceOptions,
  todayDate,
}: AdminPeopleTableProps) {
  const router = useRouter();
  const [message, setMessage] = useState<AdminPeopleActionState | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<AdminPersonRow | null>(null);
  const [archivingMember, setArchivingMember] = useState<AdminPersonRow | null>(null);
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
          empty: "No members have been invited yet.",
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
              onDeactivate={() =>
                runAction(row, "deactivate", () => deactivateMemberAction(row.id))
              }
              onReactivate={() =>
                runAction(row, "reactivate", () => reactivateMemberAction(row.id))
              }
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
  onDeactivate,
  onReactivate,
  onArchive,
}: {
  row: PersonTableRow;
  currentMemberId: string;
  isPending: (action: PendingAction) => boolean;
  onChangeRole: (role: PersonRoleValue) => void;
  onResend: () => void;
  onRevokeInvite: () => void;
  onRevokeSessions: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  onArchive: () => void;
}) {
  if (row.state === "locked") {
    return null;
  }

  const isSelf = row.id === currentMemberId;
  const nextRole: PersonRoleValue = row.roleValue === "ADMIN" ? "MEMBER" : "ADMIN";

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <IconButton
          icon={MoreHorizontal}
          label={`Open actions for ${row.name}`}
          size="sm"
          variant="ghost"
        />
      </DropdownTrigger>
      <DropdownContent align="end">
        <DropdownLabel>Actions</DropdownLabel>
        {!isSelf ? (
          <DropdownItem disabled={isPending("role")} onSelect={() => onChangeRole(nextRole)}>
            <ShieldCheck className="size-4" aria-hidden="true" />
            {nextRole === "ADMIN" ? "Make admin" : "Make member"}
          </DropdownItem>
        ) : null}
        {row.state === "invited" ? (
          <>
            <DropdownItem disabled={isPending("resend")} onSelect={onResend}>
              <Mail className="size-4" aria-hidden="true" />
              Resend invitation
            </DropdownItem>
            <DropdownItem disabled={isPending("revoke")} onSelect={onRevokeInvite}>
              <Ban className="size-4" aria-hidden="true" />
              Revoke invitation
            </DropdownItem>
          </>
        ) : null}
        {row.hasAuthUser && !isSelf ? (
          <DropdownItem disabled={isPending("sessions")} onSelect={onRevokeSessions}>
            <LogOut className="size-4" aria-hidden="true" />
            Revoke sessions
          </DropdownItem>
        ) : null}
        {row.state === "active" && !isSelf ? (
          <DropdownItem disabled={isPending("deactivate")} onSelect={onDeactivate}>
            <UserMinus className="size-4" aria-hidden="true" />
            Deactivate
          </DropdownItem>
        ) : null}
        {row.state === "inactive" && row.hasAuthUser ? (
          <DropdownItem disabled={isPending("reactivate")} onSelect={onReactivate}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Reactivate
          </DropdownItem>
        ) : null}
        {!isSelf ? (
          <>
            <DropdownSeparator />
            <DropdownItem tone="danger" onSelect={onArchive}>
              <Archive className="size-4" aria-hidden="true" />
              Archive
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
  return (
    <Dialog open={Boolean(member)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member ? `Archive ${member.name}?` : "Archive member?"}</DialogTitle>
          <DialogDescription>
            This blocks future app access and revokes active sessions, but keeps historical records
            for reporting, invoices, payslips, and audit history.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          This is not GDPR erasure. Personal data anonymization is a separate controlled workflow.
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
              if (member) onConfirm(member);
            }}
          >
            Archive member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
