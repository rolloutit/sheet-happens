"use client";

import { FolderPlus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/src/components/ui/Button";
import type { ButtonProps } from "@/src/components/ui/Button";
import { useOverlayParam } from "@/src/lib/use-overlay-param";
import { PROJECT_OVERLAY_PARAM, PROJECT_OVERLAY_VALUE } from "./project-overlays";

export type ProjectCreateButtonProps = Pick<ButtonProps, "variant" | "size" | "className">;

/** Opens the create-project sheet. Rendered in the page header and in the directory's empty state. */
export function ProjectCreateButton({ variant, size, className }: ProjectCreateButtonProps) {
  const t = useTranslations("AdminProjects");
  const [, setOpen] = useOverlayParam(PROJECT_OVERLAY_PARAM, PROJECT_OVERLAY_VALUE);

  return (
    <Button
      type="button"
      icon={FolderPlus}
      variant={variant}
      size={size}
      className={className}
      onClick={() => setOpen(true)}
    >
      {t("actions.newProject")}
    </Button>
  );
}
