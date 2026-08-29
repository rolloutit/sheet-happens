"use client";

import { SquareStack } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/src/components/ui/Button";
import type { ButtonProps } from "@/src/components/ui/Button";
import { useOverlayParam } from "@/src/lib/use-overlay-param";
import { PROJECT_BULK_ASSIGN_OVERLAY_VALUE, PROJECT_OVERLAY_PARAM } from "./project-overlays";

export type ProjectBulkAssignButtonProps = Pick<ButtonProps, "variant" | "size" | "className">;

/** Opens the bulk assignment dialog from the directory's section header. */
export function ProjectBulkAssignButton({
  variant = "soft",
  size,
  className,
}: ProjectBulkAssignButtonProps) {
  const t = useTranslations("AdminProjects");
  const [, setOpen] = useOverlayParam(PROJECT_OVERLAY_PARAM, PROJECT_BULK_ASSIGN_OVERLAY_VALUE);

  return (
    <Button
      type="button"
      icon={SquareStack}
      variant={variant}
      size={size}
      className={className}
      onClick={() => setOpen(true)}
    >
      {t("actions.bulkAssign")}
    </Button>
  );
}
