"use client";

import { Archive } from "lucide-react";
import { useTranslations } from "next-intl";

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
import type { AdminProjectGroupRow } from "@/src/server/projects";

export type ProjectGroupArchiveDialogProps = {
  group: AdminProjectGroupRow | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (group: AdminProjectGroupRow) => void;
};

/** A destructive confirmation belongs in a modal `Dialog`, unlike everything else on this page. */
export function ProjectGroupArchiveDialog({
  group,
  pending,
  onOpenChange,
  onConfirm,
}: ProjectGroupArchiveDialogProps) {
  const t = useTranslations("AdminProjects");

  return (
    <Dialog open={Boolean(group)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {group
              ? t("groupsPanel.archiveTitleNamed", { name: group.name })
              : t("groupsPanel.archiveTitle")}
          </DialogTitle>
          <DialogDescription>{t("groupsPanel.archiveDescription")}</DialogDescription>
        </DialogHeader>
        <div className="rounded-[var(--radius-md)] border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive">
          {t("groupsPanel.archiveWarning")}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost" disabled={pending}>
              {t("actions.cancel")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="danger"
            icon={Archive}
            loading={pending}
            onClick={() => {
              if (group) onConfirm(group);
            }}
          >
            {t("actions.archiveGroup")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
