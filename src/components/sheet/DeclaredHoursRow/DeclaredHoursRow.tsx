"use client";

import { AlertTriangle, Check, FileText, Lock, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { Textarea } from "@/src/components/ui/Textarea";
import { parseDurationToMinutes } from "@/src/lib/duration";
import { formatHoursWithUnit } from "@/src/lib/formatting";
import { cn } from "@/src/lib/utils";
import type { DeclaredHoursRowProps } from "./DeclaredHoursRow.types";
import { declaredHoursRowVariants, declaredProofSlotVariants } from "./DeclaredHoursRow.variants";

/**
 * One declared project's month: the figure, the note that describes it, and the proof.
 *
 * **The row is a form, and it commits on an explicit save.** The grid's cells commit on blur, and
 * that is right for a cell: one value, no other field can be half-written. A declaration is three
 * things that only mean something together — a figure with no note is not submittable, because
 * `submit-timesheet.ts` rejects an entry with an empty description and the note *is* that
 * description. Committing per field would produce exactly that state without anyone choosing it,
 * and the member would find out a month later when submission refused.
 *
 * **The proof is a separate action from the save**, and it is offered only once a figure exists.
 * `MonthlyHourDeclaration.proofDocumentId` hangs off the declaration, so there is nothing to attach
 * a file to before the hours are declared — and "proof of what?" is the honest reading anyway.
 *
 * Hours are typed, not stepped: the input accepts everything the rest of the app does (`52`,
 * `52h`, `52:30`) through `parseDurationToMinutes`, and stores minutes. The implausible-figure
 * warning arrives already worded from the caller and never blocks — §4 makes it a data-quality
 * signal, consistent with how over-24h days and overlaps are treated.
 *
 * Locked is a real variant rather than a `disabled` sweep: a locked month still has to be
 * *readable* — the figure, the note and the proof are what an admin and the member compare against
 * an invoice — so it renders as text with the proof still openable, not as greyed-out inputs.
 */
export function DeclaredHoursRow({
  project,
  minutes,
  note,
  proof,
  locale,
  durationDisplayFormat,
  labels,
  locked = false,
  disabled = false,
  saving = false,
  uploading = false,
  savedAt = null,
  warning = null,
  error = null,
  className,
  onSave,
  onUploadProof,
}: DeclaredHoursRowProps) {
  const fieldId = useId();
  const hoursId = `${fieldId}-hours`;
  const noteId = `${fieldId}-note`;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hoursText, setHoursText] = useState(() => toHoursText(minutes));
  const [noteText, setNoteText] = useState(note);
  const [showNoteError, setShowNoteError] = useState(false);
  const [savedValues, setSavedValues] = useState({ minutes, note });

  /**
   * The saved figure is the source of truth, so a correction made elsewhere — an admin's, or the
   * same month reloaded after a save — replaces what is in the fields rather than being masked by
   * a stale draft.
   *
   * Adjusted during render rather than in an effect, which is React's own recipe for "reset state
   * when a prop changes": the re-render happens before anything is painted, so the fields never
   * show the old value for a frame. A `key` on the row would do it too, but by remounting — and
   * that would drop focus off the Save button the moment a save succeeded.
   */
  if (savedValues.minutes !== minutes || savedValues.note !== note) {
    setSavedValues({ minutes, note });
    setHoursText(toHoursText(minutes));
    setNoteText(note);
    setShowNoteError(false);
  }

  // `parseDurationToMinutes` returns `null` for text it cannot read at all, and `0` for empty —
  // neither is a figure, and both are simply "not saveable yet".
  const parsedMinutes = parseDurationToMinutes(hoursText) ?? 0;
  const trimmedNote = noteText.trim();
  const hoursValid = parsedMinutes > 0;
  const dirty = parsedMinutes !== (minutes ?? 0) || trimmedNote !== note.trim();
  const busy = disabled || saving || uploading;
  const canSave = hoursValid && Boolean(trimmedNote) && dirty && !busy;

  if (locked) {
    return (
      <div
        className={cn(declaredHoursRowVariants({ state: "locked" }), className)}
        data-testid="declared-hours-row"
      >
        <ProjectHeading project={project} caption={labels.externalSystem} />

        <dl className="grid gap-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
          <dt className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {labels.hoursLabel(project)}
          </dt>
          <dd className="font-semibold tabular-nums">
            {minutes === null
              ? labels.nothingDeclared
              : formatHoursWithUnit(minutes, locale, durationDisplayFormat)}
          </dd>
          <dt className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {labels.noteLabel(project)}
          </dt>
          <dd className="text-foreground">{note || "—"}</dd>
        </dl>

        <ProofSlot
          labels={labels}
          proof={proof}
          /* The proof stays openable while the month is locked — it is exactly what a reviewer and
             the member compare against the invoice. Only replacing it goes away. */
          state={proof ? "uploaded" : "unavailable"}
        />

        <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {labels.locked}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        declaredHoursRowVariants({ state: minutes === null ? "empty" : "declared" }),
        className,
      )}
      data-testid="declared-hours-row"
    >
      <ProjectHeading project={project} caption={labels.externalSystem} />

      <div className="grid gap-4 lg:grid-cols-[minmax(9rem,12rem)_minmax(0,1fr)] lg:items-start">
        <div className="grid gap-2">
          <label
            htmlFor={hoursId}
            className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
          >
            {labels.hoursLabel(project)}
          </label>
          <Input
            id={hoursId}
            name={hoursId}
            inputMode="decimal"
            autoComplete="off"
            value={hoursText}
            disabled={busy}
            placeholder={labels.hoursPlaceholder}
            aria-describedby={`${hoursId}-hint`}
            onChange={(event) => setHoursText(event.target.value)}
          />
          <p id={`${hoursId}-hint`} className="text-xs text-muted-foreground">
            {labels.hoursHint}
          </p>
        </div>

        <div className="grid gap-2">
          <label
            htmlFor={noteId}
            className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
          >
            {labels.noteLabel(project)}
          </label>
          <Textarea
            id={noteId}
            name={noteId}
            rows={2}
            value={noteText}
            disabled={busy}
            required
            placeholder={labels.notePlaceholder}
            invalid={showNoteError && !trimmedNote}
            aria-describedby={showNoteError && !trimmedNote ? `${noteId}-error` : undefined}
            onChange={(event) => setNoteText(event.target.value)}
            onBlur={() => setShowNoteError(true)}
          />
          {showNoteError && !trimmedNote ? (
            <p id={`${noteId}-error`} className="text-xs font-medium text-destructive">
              {labels.noteRequired}
            </p>
          ) : null}
        </div>
      </div>

      <ProofSlot
        labels={labels}
        proof={proof}
        state={proof ? "uploaded" : minutes === null ? "unavailable" : "missing"}
      >
        {minutes === null ? null : (
          <>
            {/* Keyboard-reachable by construction (§15): the trigger is a real button that opens
                the file dialog, and the input itself stays in the tree as the labelled control. */}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              aria-label={labels.proofLabel}
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUploadProof({ projectId: project.projectId, file });
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="soft"
              size="sm"
              icon={Upload}
              disabled={busy}
              loading={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? labels.proofUploading : proof ? labels.proofReplace : labels.proofUpload}
            </Button>
          </>
        )}
      </ProofSlot>

      {warning ? (
        <p className="flex items-start gap-2 text-xs leading-5 text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {warning}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="flex items-start gap-2 text-xs leading-5 text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        {savedAt && !dirty ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
            <Check className="size-3.5" aria-hidden="true" />
            {labels.saved}
          </span>
        ) : null}
        <Button
          type="button"
          variant="cta"
          size="sm"
          disabled={!canSave}
          loading={saving}
          onClick={() => {
            if (!trimmedNote) {
              setShowNoteError(true);
              return;
            }

            onSave({ projectId: project.projectId, minutes: parsedMinutes, note: trimmedNote });
          }}
        >
          {saving ? labels.saving : labels.save}
        </Button>
      </div>
    </div>
  );
}

function ProjectHeading({
  project,
  caption,
}: {
  project: DeclaredHoursRowProps["project"];
  caption: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: project.color }}
        aria-hidden="true"
      />
      <span className="min-w-0 truncate text-sm font-semibold">{project.name}</span>
      <span className="text-xs text-muted-foreground">{caption}</span>
    </div>
  );
}

function ProofSlot({
  labels,
  proof,
  state,
  children,
}: {
  labels: DeclaredHoursRowProps["labels"];
  proof: DeclaredHoursRowProps["proof"];
  state: "uploaded" | "missing" | "unavailable";
  children?: React.ReactNode;
}) {
  return (
    <div className={declaredProofSlotVariants({ state })}>
      <FileText className="size-4 shrink-0" aria-hidden="true" />
      {proof ? (
        <>
          <span className="min-w-0 flex-1 truncate font-medium text-foreground">
            {proof.filename}
          </span>
          <span className="text-xs text-muted-foreground">
            {proof.sizeLabel} · {proof.uploadedAtLabel}
          </span>
          <a
            href={proof.href}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-accent underline underline-offset-2"
          >
            {labels.proofView}
          </a>
        </>
      ) : (
        <span className="min-w-0 flex-1">
          {state === "unavailable" ? labels.proofNeedsHours : labels.proofMissing}
        </span>
      )}
      {children}
    </div>
  );
}

/**
 * Minutes back into something typeable.
 *
 * Decimal hours rather than the member's display preference: this is an input, and the value has to
 * round-trip through `parseDurationToMinutes` unchanged. `520` minutes reads as `8.67`, which
 * re-parses to the same figure; a localized `8 h 40 m` would not.
 */
function toHoursText(minutes: number | null) {
  if (minutes === null) return "";

  const hours = minutes / 60;

  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2);
}
