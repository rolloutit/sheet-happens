"use client";

import { Ban, Mail, RotateCcw, ShieldCheck, UserMinus } from "lucide-react";
import { useState, useTransition } from "react";

import { PeopleTable } from "@/src/components/sheet/PeopleTable";
import type { PersonRoleValue, PersonTableRow } from "@/src/components/sheet/PeopleTable";
import { Button } from "@/src/components/ui/Button";
import { cn } from "@/src/lib/utils";
import {
  changeMemberRoleAction,
  deactivateMemberAction,
  reactivateMemberAction,
  resendMemberInviteAction,
  revokeMemberInviteAction,
} from "./actions";
import type { AdminPeopleActionState } from "./actions.types";

export type AdminPeopleTableProps = {
  rows: PersonTableRow[];
};

type PendingAction = "resend" | "revoke" | "deactivate" | "reactivate" | "role";

export function AdminPeopleTable({ rows }: AdminPeopleTableProps) {
  const [message, setMessage] = useState<AdminPeopleActionState | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
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
            ) : null}
            {row.state === "inactive" && row.hasAuthUser ? (
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
            ) : null}
          </div>
        )}
      />
    </div>
  );
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
