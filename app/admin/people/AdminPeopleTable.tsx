"use client";

import { Ban, LogOut, Mail, RotateCcw, ShieldCheck, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { PeopleTable } from "@/src/components/sheet/PeopleTable";
import type { PersonRoleValue, PersonTableRow } from "@/src/components/sheet/PeopleTable";
import { Button } from "@/src/components/ui/Button";
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
} from "./actions";
import type { AdminPeopleActionState } from "./actions.types";
import { MemberEditDrawer } from "./MemberEditDrawer";

export type AdminPeopleTableProps = {
  rows: AdminPersonRow[];
  preferenceOptions: MemberPreferenceOptions;
};

type PendingAction = "resend" | "revoke" | "sessions" | "deactivate" | "reactivate" | "role";

export function AdminPeopleTable({ rows, preferenceOptions }: AdminPeopleTableProps) {
  const router = useRouter();
  const [message, setMessage] = useState<AdminPeopleActionState | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<AdminPersonRow | null>(null);
  const [, startTransition] = useTransition();

  function runAction(
    row: PersonTableRow,
    action: PendingAction,
    callback: () => Promise<AdminPeopleActionState>,
  ) {
    setPendingKey(`${row.id}:${action}`);
    setMessage(null);

    startTransition(async () => {
      const result = await callback();
      setMessage(result);
      setPendingKey(null);

      if (result.status === "success") {
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
          <div className="flex flex-wrap justify-end gap-2">
            <RoleSelect
              row={row}
              pending={isPending(row, "role")}
              onChange={(role) => {
                runAction(row, "role", () => changeMemberRoleAction(row.id, role));
              }}
            />
            {row.state === "invited" ? (
              <>
                <Button
                  type="button"
                  variant="soft"
                  size="sm"
                  icon={Mail}
                  loading={isPending(row, "resend")}
                  onClick={() => runAction(row, "resend", () => resendMemberInviteAction(row.id))}
                >
                  Resend
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={Ban}
                  loading={isPending(row, "revoke")}
                  onClick={() => runAction(row, "revoke", () => revokeMemberInviteAction(row.id))}
                >
                  Revoke
                </Button>
              </>
            ) : null}
            {row.state === "active" ? (
              <>
                <Button
                  type="button"
                  variant="soft"
                  size="sm"
                  icon={LogOut}
                  loading={isPending(row, "sessions")}
                  onClick={() =>
                    runAction(row, "sessions", () => revokeMemberSessionsAction(row.id))
                  }
                >
                  Revoke sessions
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={UserMinus}
                  loading={isPending(row, "deactivate")}
                  onClick={() => runAction(row, "deactivate", () => deactivateMemberAction(row.id))}
                >
                  Deactivate
                </Button>
              </>
            ) : null}
            {row.state === "inactive" && row.hasAuthUser ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={LogOut}
                  loading={isPending(row, "sessions")}
                  onClick={() =>
                    runAction(row, "sessions", () => revokeMemberSessionsAction(row.id))
                  }
                >
                  Revoke sessions
                </Button>
                <Button
                  type="button"
                  variant="soft"
                  size="sm"
                  icon={RotateCcw}
                  loading={isPending(row, "reactivate")}
                  onClick={() => runAction(row, "reactivate", () => reactivateMemberAction(row.id))}
                >
                  Reactivate
                </Button>
              </>
            ) : null}
          </div>
        )}
      />
      <MemberEditDrawer
        member={editingMember}
        open={Boolean(editingMember)}
        preferenceOptions={preferenceOptions}
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

function RoleSelect({
  row,
  pending,
  onChange,
}: {
  row: PersonTableRow;
  pending: boolean;
  onChange: (role: PersonRoleValue) => void;
}) {
  if (row.state === "locked") {
    return null;
  }

  return (
    <label className="inline-flex items-center gap-2">
      <ShieldCheck className="size-4 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">Change role for {row.name}</span>
      <select
        value={row.roleValue ?? "MEMBER"}
        disabled={pending}
        onChange={(event) => onChange(event.currentTarget.value as PersonRoleValue)}
        className="h-9 rounded-[var(--radius-md)] border border-input bg-background/50 px-2 text-sm text-foreground shadow-sm transition focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="MEMBER">Member</option>
        <option value="ADMIN">Admin</option>
      </select>
    </label>
  );
}
