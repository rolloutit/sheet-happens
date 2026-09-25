"use client";

import { AlertTriangle, Play } from "lucide-react";
import { useState } from "react";

import { Button } from "@/src/components/ui/Button";
import { Combobox } from "@/src/components/ui/Combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/Dialog";
import { Field } from "@/src/components/ui/Field";
import { SuggestInput } from "@/src/components/ui/SuggestInput";
import { cn } from "@/src/lib/utils";
import type { TimerStartDialogProps } from "./TimerStartDialog.types";

const RECENT_PROJECT_LIMIT = 4;

/**
 * Starts a running timer: a project and a sentence about what you are doing.
 *
 * A centred dialog rather than a `FormDrawer` because this is two fields that fire immediately —
 * there is no long column to scroll, nothing to lose by pressing Escape, and it should feel like
 * the "New entry" modal it sits beside rather than like the admin create sheets. For the same
 * reason it carries no discard guard.
 */
export function TimerStartDialog({ open, onOpenChange, labels, ...form }: TimerStartDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={labels.close}>
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>
        {/*
          The fields live in a child of the portal so the dialog closing is what clears them:
          Radix unmounts its content, the child's state goes with it, and the next open starts
          blank without an effect reaching in to reset it. A rejected start keeps everything,
          because that path never closes the dialog.
        */}
        <TimerStartForm labels={labels} onCancel={() => onOpenChange(false)} {...form} />
      </DialogContent>
    </Dialog>
  );
}

function TimerStartForm({
  projects,
  recentProjects = [],
  suggestions = [],
  labels,
  pending = false,
  error = null,
  onCancel,
  onStart,
  onProjectChange,
}: Omit<TimerStartDialogProps, "open" | "onOpenChange"> & { onCancel: () => void }) {
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");

  const selectedProjectId = projectId || (projects[0]?.projectId ?? "");

  /**
   * One place to change the project, because two controls do it and the description suggestions
   * follow whichever was used. A picker that reported only half its changes would offer the wrong
   * project's wording — the one hazard this feature has to avoid.
   */
  function pickProject(next: string) {
    setProjectId(next);
    onProjectChange?.(next);
  }
  const ready = Boolean(selectedProjectId && description.trim()) && !pending;
  const visibleRecent = recentProjects.slice(0, RECENT_PROJECT_LIMIT);

  return (
    <>
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready) return;
          onStart(selectedProjectId, description.trim());
        }}
      >
        <Field label={labels.descriptionLabel} required>
          {({ id, describedBy, invalid }) => (
            <SuggestInput
              id={id}
              autoFocus
              value={description}
              options={suggestions}
              labels={labels.suggestions}
              emptyStateLimit={4}
              placeholder={labels.descriptionPlaceholder}
              aria-describedby={describedBy}
              invalid={invalid}
              onValueChange={setDescription}
            />
          )}
        </Field>

        <Field label={labels.projectLabel} required>
          {({ id, describedBy, invalid, required }) => (
            <Combobox
              id={id}
              label={labels.projectLabel}
              value={selectedProjectId}
              aria-describedby={describedBy}
              invalid={invalid}
              required={required}
              labels={labels.combobox}
              options={projects.map((project) => ({
                value: project.projectId,
                label: project.name,
              }))}
              onValueChange={pickProject}
            />
          )}
        </Field>

        {visibleRecent.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {labels.recent}
            </span>
            {visibleRecent.map((project) => (
              <button
                key={project.projectId}
                type="button"
                aria-pressed={selectedProjectId === project.projectId}
                className={cn(
                  "inline-flex items-center gap-2 rounded-[var(--radius-pill)] border px-3 py-1.5 text-sm font-medium transition",
                  selectedProjectId === project.projectId
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border bg-background text-foreground hover:border-accent-line hover:bg-accent-soft",
                )}
                onClick={() => pickProject(project.projectId)}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: project.color }}
                  aria-hidden="true"
                />
                {project.name}
              </button>
            ))}
          </div>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-[var(--radius-md)] border border-destructive/35 bg-destructive-soft px-3 py-2 text-sm font-medium text-destructive"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {labels.cancel}
          </Button>
          <Button type="submit" variant="cta" icon={Play} loading={pending} disabled={!ready}>
            {labels.start}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
