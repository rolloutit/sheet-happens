"use client";

import { BellRing, Check } from "lucide-react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/src/components/ui/Button";
import { sendFlaggedMemberReminderAction, type ReminderActionState } from "./actions";

const initialState: ReminderActionState = { status: "idle", message: "" };

export function FlaggedReminderButton({
  memberId,
  weekStart,
}: {
  memberId: string;
  weekStart: string;
}) {
  const t = useTranslations("Dashboard.admin.flagged");
  const [state, action, pending] = useActionState(sendFlaggedMemberReminderAction, initialState);

  return (
    <form action={action} title={state.status === "error" ? state.message : undefined}>
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="weekStart" value={weekStart} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        icon={state.status === "success" ? Check : BellRing}
        loading={pending}
      >
        {state.status === "success" ? t("reminderSent") : t("remind")}
      </Button>
    </form>
  );
}
