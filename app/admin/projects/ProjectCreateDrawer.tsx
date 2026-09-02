"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { FormDrawer } from "@/src/components/sheet/FormDrawer";
import { useOverlayParam } from "@/src/lib/use-overlay-param";
import { ProjectCreateForm } from "./ProjectCreateForm";
import { PROJECT_OVERLAY_PARAM, PROJECT_OVERLAY_VALUE } from "./project-overlays";

export type ProjectCreateDrawerProps = {
  /** Hands the confirmation back to the directory, which owns the page's result banner. */
  onCreated: (message: string) => void;
};

export function ProjectCreateDrawer({ onCreated }: ProjectCreateDrawerProps) {
  const t = useTranslations("AdminProjects");
  const [open, setOpen] = useOverlayParam(PROJECT_OVERLAY_PARAM, PROJECT_OVERLAY_VALUE);
  const [dirty, setDirty] = useState(false);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) setDirty(false);

      setOpen(next);
    },
    [setOpen],
  );

  const handleCreated = useCallback(
    (message: string) => {
      handleOpenChange(false);
      onCreated(message);
    },
    [handleOpenChange, onCreated],
  );

  return (
    <FormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title={t("create.title")}
      description={t("create.description")}
      dirty={dirty}
      closeLabel={t("actions.close")}
      discardLabels={{
        title: t("discardDialog.title"),
        description: t("discardDialog.description"),
        confirm: t("discardDialog.confirm"),
        cancel: t("discardDialog.cancel"),
      }}
    >
      <ProjectCreateForm onDirtyChange={setDirty} onCreated={handleCreated} />
    </FormDrawer>
  );
}
