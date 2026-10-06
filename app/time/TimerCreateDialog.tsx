"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { TimerStartDialog } from "@/src/components/sheet/TimerStartDialog";
import { usePickerLabels } from "@/src/i18n/picker-labels";
import { useOverlayParam } from "@/src/lib/use-overlay-param";
import type { TimeGridAssignedProject } from "@/src/server/time-tracking";

import { startRunningTimerAction } from "./actions";
import type { TimeTrackingActionState } from "./actions.types";
import { TIME_OVERLAY_PARAM, TIMER_OVERLAY_VALUE } from "./time-overlays";
import type { DescriptionSuggestionsController } from "./use-description-suggestions";

type TimerCreateDialogProps = {
  projects: TimeGridAssignedProject[];
  recentProjects: TimeGridAssignedProject[];
  /** The member's own recent descriptions, scoped to whichever project the dialog has selected. */
  suggestions: DescriptionSuggestionsController;
  onStarted: (result: TimeTrackingActionState) => void;
};

/**
 * Wires the presentational start dialog to the server action and to the URL.
 *
 * Open state lives in `?new=timer` rather than in local state so the trigger in the toolbar and the
 * dialog do not have to be in the same subtree, and so the overlay survives a reload. The action
 * takes a plain object rather than `FormData`, so this is a `useTransition` call rather than the
 * `useActionState` template the admin create sheets use.
 */
export function TimerCreateDialog({
  projects,
  recentProjects,
  suggestions,
  onStarted,
}: TimerCreateDialogProps) {
  const t = useTranslations("TimeTracking");
  const pickerLabels = usePickerLabels();
  const [open, setOpen] = useOverlayParam(TIME_OVERLAY_PARAM, TIMER_OVERLAY_VALUE);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /* The dialog picks a project of its own, so the suggestions follow that pick rather than the
     page's. Recent first, matching the chips it shows above the picker. */
  const [descriptionProjectId, setDescriptionProjectId] = useState("");
  const selectedProjectId =
    descriptionProjectId || recentProjects[0]?.projectId || projects[0]?.projectId || "";

  function handleOpenChange(next: boolean) {
    if (!next) setError(null);
    setOpen(next);
  }

  function handleStart(projectId: string, description: string) {
    startTransition(async () => {
      const result = await startRunningTimerAction({ projectId, description });

      if (result.status === "error") {
        // Kept open with the input intact — the common rejection is "stop the running timer
        // first", and re-typing the description to hear that again would be a poor trade.
        setError(result.message);
        return;
      }

      setError(null);
      setOpen(false);
      // A timer's description becomes an entry's description when it stops, so it belongs in the
      // session list straight away.
      suggestions.remember(projectId, description);
      onStarted(result);
    });
  }

  return (
    <TimerStartDialog
      open={open}
      onOpenChange={handleOpenChange}
      projects={projects}
      recentProjects={recentProjects}
      suggestions={suggestions.optionsFor(selectedProjectId)}
      onProjectChange={setDescriptionProjectId}
      pending={isPending}
      error={error}
      labels={{
        title: t("timerModal.title"),
        description: t("timerModal.description"),
        close: t("actions.close"),
        cancel: t("actions.cancel"),
        start: t("timer.start"),
        descriptionLabel: t("fields.description"),
        descriptionPlaceholder: t("timer.placeholder"),
        projectLabel: t("fields.project"),
        recent: t("labels.recent"),
        combobox: pickerLabels.combobox,
        suggestions: suggestions.labels,
      }}
      onStart={handleStart}
    />
  );
}
