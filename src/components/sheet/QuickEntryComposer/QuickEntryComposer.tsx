"use client";

import { AlertTriangle, ArrowRight, Clock3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { parseDurationToMinutes } from "@/src/lib/duration";
import { cn } from "@/src/lib/utils";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import type { QuickEntryComposerProps } from "./QuickEntryComposer.types";

/**
 * Two clicks from "I need to log this" to "logged", without leaving the week (§5.6 of
 * `docs/time-view-redesign.md`).
 *
 * ```
 *  Mon, Aug 31
 *  [● Atlas]  [● Internal Ops]  [● one time test]        ← recent first, then the rest
 *  [ 2h30            ]  [ What did you do?                        ]
 *  Interval instead   ·   More options →                                      [ Add ]  ↵
 * ```
 *
 * Toggl's favourites bar and Linear's quick-create in one. The project chips are a `radiogroup`;
 * the duration accepts everything the grid already parses; Enter in either field adds. `More
 * options` opens the full entry dialog with the fields carried over, which is where the interval
 * mode, the date and the warnings live — the composer is for the common case and does not try to
 * be the dialog.
 *
 * Controlled, so the caller can carry the half-typed value into the dialog and into the draft that
 * survives a stray click. Validation happens here, on submit, and `onSubmit` is only ever called
 * with a value that passed.
 */
export function QuickEntryComposer({
  projects,
  value,
  labels,
  pending = false,
  error = null,
  autoFocus = "duration",
  focusToken,
  footnote = null,
  className,
  onValueChange,
  onSubmit,
  onMoreOptions,
  onInterval,
}: QuickEntryComposerProps) {
  const [fieldErrors, setFieldErrors] = useState<{
    duration?: string;
    description?: string;
    project?: string;
  }>({});
  const durationRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusToken) durationRef.current?.focus();
  }, [focusToken]);

  function submit() {
    const durationMinutes = parseDurationToMinutes(value.durationText);
    const errors: typeof fieldErrors = {};

    if (!value.projectId) errors.project = labels.noProject;
    if (durationMinutes === null || durationMinutes <= 0) errors.duration = labels.invalidDuration;
    if (!value.description.trim()) errors.description = labels.descriptionRequired;

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0 || durationMinutes === null) return;

    onSubmit({ ...value, description: value.description.trim(), durationMinutes });
  }

  return (
    <form
      className={cn("grid gap-3", className)}
      aria-label={labels.title}
      onSubmit={(event) => {
        event.preventDefault();
        if (!pending) submit();
      }}
    >
      <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {labels.title}
      </p>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-destructive/35 bg-destructive-soft px-2.5 py-2 text-xs font-medium text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}

      <div
        role="radiogroup"
        aria-label={labels.project}
        aria-invalid={fieldErrors.project ? true : undefined}
        className="flex flex-wrap gap-1.5"
      >
        {projects.map((project) => {
          const selected = project.projectId === value.projectId;

          return (
            <button
              key={project.projectId}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={pending}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-pill)] border px-2.5 font-ui text-xs font-semibold transition-colors duration-[var(--duration-micro)] disabled:opacity-50",
                selected
                  ? "border-accent bg-accent-soft text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-accent/45 hover:text-foreground",
              )}
              onClick={() => {
                setFieldErrors((current) => ({ ...current, project: undefined }));
                onValueChange({ ...value, projectId: project.projectId });
              }}
            >
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: project.color }}
              />
              <span className="max-w-[9rem] truncate">{project.name}</span>
            </button>
          );
        })}
      </div>
      {fieldErrors.project ? (
        <p className="-mt-1.5 text-xs font-medium text-destructive">{fieldErrors.project}</p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
        <div className="grid gap-1">
          <Input
            ref={durationRef}
            aria-label={labels.duration}
            inputMode="decimal"
            autoComplete="off"
            autoFocus={autoFocus === "duration"}
            placeholder={labels.durationPlaceholder}
            value={value.durationText}
            invalid={Boolean(fieldErrors.duration)}
            disabled={pending}
            className="h-9 font-ui tabular-nums"
            onChange={(event) => {
              setFieldErrors((current) => ({ ...current, duration: undefined }));
              onValueChange({ ...value, durationText: event.target.value });
            }}
          />
          {fieldErrors.duration ? (
            <p className="text-xs font-medium text-destructive">{fieldErrors.duration}</p>
          ) : null}
        </div>
        <div className="grid gap-1">
          <Input
            aria-label={labels.description}
            autoComplete="off"
            autoFocus={autoFocus === "description"}
            placeholder={labels.descriptionPlaceholder}
            value={value.description}
            invalid={Boolean(fieldErrors.description)}
            disabled={pending}
            className="h-9"
            onChange={(event) => {
              setFieldErrors((current) => ({ ...current, description: undefined }));
              onValueChange({ ...value, description: event.target.value });
            }}
          />
          {fieldErrors.description ? (
            <p className="text-xs font-medium text-destructive">{fieldErrors.description}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {onInterval ? (
          <button
            type="button"
            disabled={pending}
            className="inline-flex items-center gap-1 font-ui text-xs font-semibold text-muted-foreground transition-colors duration-[var(--duration-micro)] hover:text-foreground disabled:opacity-50"
            onClick={onInterval}
          >
            <Clock3 className="size-3.5" aria-hidden="true" />
            {labels.interval}
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          className="inline-flex items-center gap-1 font-ui text-xs font-semibold text-muted-foreground transition-colors duration-[var(--duration-micro)] hover:text-foreground disabled:opacity-50"
          onClick={onMoreOptions}
        >
          {labels.more}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </button>
        <span className="ml-auto inline-flex items-center gap-2">
          <span className="hidden items-center gap-1 font-ui text-[11px] text-subtle-foreground sm:inline-flex">
            {labels.submitHint}
            <kbd className="rounded-[var(--radius-xs)] border border-border px-1 font-ui text-[10px] font-semibold">
              ↵
            </kbd>
          </span>
          <Button type="submit" variant="cta" size="sm" loading={pending}>
            {labels.add}
          </Button>
        </span>
      </div>

      {footnote ? (
        <p aria-live="polite" className="font-ui text-[11px] text-muted-foreground">
          {footnote}
        </p>
      ) : null}
    </form>
  );
}
