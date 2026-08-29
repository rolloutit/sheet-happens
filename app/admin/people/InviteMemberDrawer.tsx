"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { FormDrawer } from "@/src/components/sheet/FormDrawer";
import type { MemberPreferenceOptions } from "@/src/lib/member-preferences";
import { useOverlayParam } from "@/src/lib/use-overlay-param";
import { InviteMemberForm } from "./InviteMemberForm";
import { INVITE_OVERLAY_PARAM, INVITE_OVERLAY_VALUE } from "./invite-overlay";

export type InviteMemberDrawerProps = {
  preferenceOptions: MemberPreferenceOptions;
  /** Hands the confirmation back to the directory, which owns the page's result banner. */
  onInvited: (message: string) => void;
};

export function InviteMemberDrawer({ preferenceOptions, onInvited }: InviteMemberDrawerProps) {
  const t = useTranslations("AdminPeople");
  const [open, setOpen] = useOverlayParam(INVITE_OVERLAY_PARAM, INVITE_OVERLAY_VALUE);
  const [dirty, setDirty] = useState(false);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) setDirty(false);

      setOpen(next);
    },
    [setOpen],
  );

  const handleInvited = useCallback(
    (message: string) => {
      handleOpenChange(false);
      onInvited(message);
    },
    [handleOpenChange, onInvited],
  );

  return (
    <FormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title={t("invite.title")}
      description={t("invite.description")}
      dirty={dirty}
      closeLabel={t("actions.close")}
      discardLabels={{
        title: t("discardDialog.title"),
        description: t("discardDialog.description"),
        confirm: t("discardDialog.confirm"),
        cancel: t("discardDialog.cancel"),
      }}
    >
      <InviteMemberForm
        preferenceOptions={preferenceOptions}
        onDirtyChange={setDirty}
        onInvited={handleInvited}
      />
    </FormDrawer>
  );
}
