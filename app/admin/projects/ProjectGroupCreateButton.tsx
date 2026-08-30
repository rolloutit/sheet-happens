"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/src/components/ui/Button";
import type { ButtonProps } from "@/src/components/ui/Button";
import { useOverlayParam } from "@/src/lib/use-overlay-param";
import { PROJECT_GROUP_OVERLAY_VALUE, PROJECT_OVERLAY_PARAM } from "./project-overlays";

export type ProjectGroupCreateButtonProps = Pick<ButtonProps, "variant" | "size" | "className">;

/** Opens the create-group dialog from the groups section header or its empty state. */
export function ProjectGroupCreateButton({
  variant = "soft",
  size,
  className,
}: ProjectGroupCreateButtonProps) {
  const t = useTranslations("AdminProjects");
  const [, setOpen] = useOverlayParam(PROJECT_OVERLAY_PARAM, PROJECT_GROUP_OVERLAY_VALUE);

  return (
    <Button
      type="button"
      icon={Plus}
      variant={variant}
      size={size}
      className={className}
      onClick={() => setOpen(true)}
    >
      {t("actions.newGroup")}
    </Button>
  );
}
