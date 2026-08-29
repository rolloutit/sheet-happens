"use client";

import { UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/src/components/ui/Button";
import type { ButtonProps } from "@/src/components/ui/Button";
import { useOverlayParam } from "@/src/lib/use-overlay-param";
import { INVITE_OVERLAY_PARAM, INVITE_OVERLAY_VALUE } from "./invite-overlay";

export type InviteMemberButtonProps = Pick<ButtonProps, "variant" | "size" | "className">;

/** Opens the invite sheet. Rendered in the page header and again in the directory's empty state. */
export function InviteMemberButton({ variant, size, className }: InviteMemberButtonProps) {
  const t = useTranslations("AdminPeople");
  const [, setOpen] = useOverlayParam(INVITE_OVERLAY_PARAM, INVITE_OVERLAY_VALUE);

  return (
    <Button
      type="button"
      icon={UserPlus}
      variant={variant}
      size={size}
      className={className}
      onClick={() => setOpen(true)}
    >
      {t("actions.inviteMember")}
    </Button>
  );
}
