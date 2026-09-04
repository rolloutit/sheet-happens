"use client";

import { AlertTriangle, ChevronLeft, ChevronRight, FileText, Lock, PencilLine } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import type { Route } from "next";
import { useState, useTransition } from "react";

import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/src/components/ui/Drawer";
import { Field } from "@/src/components/ui/Field";
import { Input } from "@/src/components/ui/Input";
import { Textarea } from "@/src/components/ui/Textarea";
import { parseDurationToMinutes } from "@/src/lib/duration";
import {
  formatDateTime,
  formatHoursWithUnit,
  formatMonthLabel,
  type DurationDisplayFormat,
} from "@/src/lib/formatting";
import { cn } from "@/src/lib/utils";
import type { AdminDeclaredHoursMonth, AdminDeclaredHoursRow } from "@/src/server/time-tracking";
import { correctDeclaredHoursAction } from "./actions";
import type { CorrectDeclaredHoursActionState } from "./actions.types";

export type AdminDeclaredHoursTableProps = {
  month: AdminDeclaredHoursMonth;
  previousMonth: string;
  nextMonth: string;
  currentMonth: string;
  /** The signed-in admin, whose own row is not correctable here — see {@link isOwnRow}. */
  adminMemberId: string;
  locale: string;
  durationDisplayFormat: DurationDisplayFormat;
};

const initialActionState: CorrectDeclaredHoursActionState = {
  status: "idle",
  message: "",
};

/**
 * The month's declared-hours roster, and the drawer that corrects one row of it.
 *
 * **Months are `Link`s, not client state.** Each month is its own server render, so the browser's
 * Back button means "the previous month" — which is what an admin working through a quarter
 * expects. This is the opposite call from `/time`, and for the opposite reason: there the month
 * payload already sits in the client, so a navigation would re-fetch data it holds.
 *
 * **A correction requires a reason and the drawer will not submit without one.** The reason is not
 * bookkeeping: it is written to `adminModificationReason` on both records and is what the member
 * reads in the `TIME_ENTRY_ADMIN_MODIFIED` notification that follows. Someone else's declared
 * figure changing silently is exactly the outcome the audit trail exists to prevent.
 */
export function AdminDeclaredHoursTable({
  month,
  previousMonth,
  nextMonth,
  currentMonth,
  adminMemberId,
  locale,
  durationDisplayFormat,
}: AdminDeclaredHoursTableProps) {
  const t = useTranslations("AdminDeclaredHours");
  const [selected, setSelected] = useState<AdminDeclaredHoursRow | null>(null);
  const [actionState, setActionState] = useState(initialActionState);
  const [pending, startTransition] = useTransition();

  const monthLabel = formatMonthLabel(month.monthStart, locale);

  function openRow(row: AdminDeclaredHoursRow) {
    setActionState(initialActionState);
    setSelected(row);
  }

  function submitCorrection(input: { minutes: number; note: string; reason: string }) {
    if (!selected) return;

    startTransition(async () => {
      const result = await correctDeclaredHoursAction({
        memberId: selected.memberId,
        projectId: selected.projectId,
        periodStart: month.monthStart,
        minutes: input.minutes,
        note: input.note,
        reason: input.reason,
      });

      setActionState(result);
      // Kept open on failure so the typed figure, note and reason survive to be fixed.
      if (result.status === "success") setSelected(null);
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" aria-label={t("months.previous")}>
            <Link href={monthHref(previousMonth)}>
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <p className="min-w-40 text-center font-ui text-base font-semibold text-foreground">
            {monthLabel}
          </p>
          <Button asChild variant="ghost" size="sm" aria-label={t("months.next")}>
            <Link href={monthHref(nextMonth)}>
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          {month.monthStart === currentMonth ? null : (
            <Button asChild variant="ghost" size="sm">
              <Link href={monthHref(currentMonth)}>{t("months.thisMonth")}</Link>
            </Button>
          )}
        </div>

        <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-baseline gap-2">
            <dt className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {t("summary.declared")}
            </dt>
            <dd className="font-semibold tabular-nums text-foreground">
              {formatHoursWithUnit(month.declaredMinutes, locale, durationDisplayFormat)}
            </dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {t("summary.missing")}
            </dt>
            <dd
              className={cn(
                "font-semibold tabular-nums",
                month.missingCount ? "text-warning" : "text-foreground",
              )}
            >
              {month.missingCount}
            </dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {t("summary.missingProof")}
            </dt>
            <dd
              className={cn(
                "font-semibold tabular-nums",
                month.missingProofCount ? "text-warning" : "text-foreground",
              )}
            >
              {month.missingProofCount}
            </dd>
          </div>
        </dl>
      </div>

      {actionState.status === "success" ? (
        <p
          role="status"
          className="rounded-[var(--radius-md)] border border-success/35 bg-success-soft px-4 py-3 text-sm font-medium text-success"
        >
          {actionState.message}
        </p>
      ) : null}

      {actionState.status === "error" && !selected ? (
        <p
          role="alert"
          className="rounded-[var(--radius-md)] border border-destructive/35 bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive"
        >
          {actionState.message}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card shadow-soft">
        <table className="w-full border-collapse">
          <caption className="sr-only">{t("table.caption", { month: monthLabel })}</caption>
          <thead>
            <tr className="border-b border-border bg-background/45">
              <DeclaredHead>{t("table.columns.member")}</DeclaredHead>
              <DeclaredHead>{t("table.columns.project")}</DeclaredHead>
              <DeclaredHead>{t("table.columns.hours")}</DeclaredHead>
              <DeclaredHead className="hidden md:table-cell">
                {t("table.columns.proof")}
              </DeclaredHead>
              <DeclaredHead>
                <span className="sr-only">{t("table.columns.actions")}</span>
              </DeclaredHead>
            </tr>
          </thead>
          <tbody>
            {month.rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-muted-foreground">
                  {t("table.empty")}
                </td>
              </tr>
            ) : (
              month.rows.map((row) => (
                <tr
                  key={`${row.memberId}:${row.projectId}`}
                  className="border-b border-border last:border-b-0"
                >
                  <td className="px-4 py-3">
                    <p className="truncate font-ui text-sm font-semibold text-foreground">
                      {row.memberName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t(`profile.${row.memberProfile}`)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: row.projectColor }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 truncate text-sm text-foreground">
                        {row.projectName}
                      </span>
                    </div>
                    {row.modeSource === "MEMBER_DEFAULT" ? (
                      <p className="mt-0.5 pl-5 text-xs text-muted-foreground">
                        {t("modeSource.memberDefault")}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {row.minutes === null ? (
                      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">
                        <AlertTriangle className="size-3" aria-hidden="true" />
                        {t("labels.nothingDeclared")}
                      </span>
                    ) : (
                      <p className="font-ui text-sm font-semibold tabular-nums text-foreground">
                        {formatHoursWithUnit(row.minutes, locale, durationDisplayFormat)}
                      </p>
                    )}
                    {row.correction ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t("labels.corrected", {
                          name: row.correction.by ?? t("labels.correctedByRemoved"),
                          when: formatDateTime(row.correction.at, locale),
                        })}
                      </p>
                    ) : null}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {row.proof ? (
                      <a
                        href={`/admin/declared-hours/hours-proof/${row.proof.declarationId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-accent underline underline-offset-2"
                      >
                        <FileText className="size-4 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 truncate">{row.proof.filename}</span>
                      </a>
                    ) : row.minutes === null ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">
                        <AlertTriangle className="size-3" aria-hidden="true" />
                        {t("labels.proofMissing")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RowAction
                      row={row}
                      own={isOwnRow(row, adminMemberId)}
                      onCorrect={() => openRow(row)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">{t("table.proofNote")}</p>

      <Drawer
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open && !pending) setSelected(null);
        }}
      >
        <DrawerContent className="sm:max-w-xl">
          {selected ? (
            <>
              <DrawerHeader>
                <DrawerTitle>{t("drawer.title", { project: selected.projectName })}</DrawerTitle>
                <DrawerDescription>
                  {t("drawer.description", { name: selected.memberName, month: monthLabel })}
                </DrawerDescription>
              </DrawerHeader>

              <CorrectionForm
                key={`${selected.memberId}:${selected.projectId}`}
                row={selected}
                sanityLimit={sanityLimitMinutes(month.monthEnd)}
                actionState={actionState}
                pending={pending}
                onCancel={() => setSelected(null)}
                onSubmit={submitCorrection}
              />
            </>
          ) : null}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

/**
 * What the row offers, and why it sometimes offers nothing.
 *
 * Three refusals, each with its own sentence rather than one greyed-out button: a locked month, an
 * assignment that no longer covers the month, and the admin's own row. An admin who cannot act
 * needs to know which of the three it is — "disabled" would send them to look for a bug.
 */
function RowAction({
  row,
  own,
  onCorrect,
}: {
  row: AdminDeclaredHoursRow;
  own: boolean;
  onCorrect: () => void;
}) {
  const t = useTranslations("AdminDeclaredHours");

  if (row.locked) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Lock className="size-3.5" aria-hidden="true" />
        {t("labels.locked")}
      </span>
    );
  }

  if (own) {
    return <Badge tone="neutral">{t("labels.ownDeclaration")}</Badge>;
  }

  if (!row.correctable) {
    return (
      <span className="text-xs font-medium text-muted-foreground">
        {t("labels.assignmentEnded")}
      </span>
    );
  }

  return (
    <Button variant="soft" size="sm" icon={PencilLine} onClick={onCorrect}>
      {t("actions.correct")}
    </Button>
  );
}

/**
 * The correction itself.
 *
 * Hours are **typed, not stepped**, and parsed through `parseDurationToMinutes` — the same grammar
 * the member's own row accepts (`52`, `52h`, `52:30`), so an admin reading a figure off a proof
 * enters it the way it is written there rather than converting it first.
 *
 * The note is prefilled with the member's own words and is required, because it becomes the
 * materialized entry's `description` and submission refuses an entry without one. Clearing it to
 * correct only the figure would make the month unsubmittable.
 */
function CorrectionForm({
  row,
  sanityLimit,
  actionState,
  pending,
  onCancel,
  onSubmit,
}: {
  row: AdminDeclaredHoursRow;
  /** 24 h × days in the month, in minutes. Above it the figure warns; it never blocks. */
  sanityLimit: number;
  actionState: CorrectDeclaredHoursActionState;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (input: { minutes: number; note: string; reason: string }) => void;
}) {
  const t = useTranslations("AdminDeclaredHours");
  const locale = useLocale();
  const [hoursText, setHoursText] = useState(() => toHoursText(row.minutes));
  const [noteText, setNoteText] = useState(row.note);
  const [reasonText, setReasonText] = useState("");

  const parsedMinutes = parseDurationToMinutes(hoursText) ?? 0;
  const canSubmit =
    parsedMinutes > 0 && Boolean(noteText.trim()) && Boolean(reasonText.trim()) && !pending;

  return (
    <form
      className="grid gap-4 px-4 pb-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) return;

        onSubmit({
          minutes: parsedMinutes,
          note: noteText.trim(),
          reason: reasonText.trim(),
        });
      }}
    >
      {row.proof ? (
        <a
          href={`/admin/declared-hours/hours-proof/${row.proof.declarationId}`}
          target="_blank"
          rel="noreferrer"
          className="flex min-w-0 items-center gap-2 rounded-[var(--radius-md)] border border-success/35 bg-success-soft px-3 py-2.5 text-sm font-medium text-success"
        >
          <FileText className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{row.proof.filename}</span>
          <span className="shrink-0 text-xs">{t("drawer.openProof")}</span>
        </a>
      ) : (
        <p className="rounded-[var(--radius-md)] border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
          {t("drawer.noProof")}
        </p>
      )}

      <Field
        label={t("fields.hours")}
        required
        reserveMessageSpace
        hint={t("fields.hoursHint")}
        error={actionState.fieldErrors?.minutes}
      >
        {({ id, describedBy, invalid, required }) => (
          <Input
            id={id}
            name="hours"
            inputMode="decimal"
            autoComplete="off"
            value={hoursText}
            placeholder={t("fields.hoursPlaceholder")}
            aria-describedby={describedBy}
            invalid={invalid}
            required={required}
            disabled={pending}
            onChange={(event) => setHoursText(event.target.value)}
          />
        )}
      </Field>

      <Field
        label={t("fields.note")}
        required
        reserveMessageSpace
        hint={t("fields.noteHint")}
        error={actionState.fieldErrors?.note}
      >
        {({ id, describedBy, invalid, required }) => (
          <Textarea
            id={id}
            name="note"
            rows={2}
            value={noteText}
            placeholder={t("fields.notePlaceholder")}
            aria-describedby={describedBy}
            invalid={invalid}
            required={required}
            disabled={pending}
            onChange={(event) => setNoteText(event.target.value)}
          />
        )}
      </Field>

      <Field
        label={t("fields.reason")}
        required
        reserveMessageSpace
        hint={t("fields.reasonHint")}
        error={actionState.fieldErrors?.reason}
      >
        {({ id, describedBy, invalid, required }) => (
          <Textarea
            id={id}
            name="reason"
            rows={2}
            value={reasonText}
            placeholder={t("fields.reasonPlaceholder")}
            aria-describedby={describedBy}
            invalid={invalid}
            required={required}
            disabled={pending}
            onChange={(event) => setReasonText(event.target.value)}
          />
        )}
      </Field>

      {/* Above 24 h × days in the month. A warning, never a block — the same rule the member's own
          row follows, because a figure copied from another company's system is not ours to refuse. */}
      {parsedMinutes > sanityLimit ? (
        <p className="flex items-start gap-2 text-xs leading-5 text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {t("fields.sanityWarning", { hours: formatHoursWithUnit(sanityLimit, locale) })}
        </p>
      ) : null}

      {actionState.status === "error" ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {actionState.message}
        </p>
      ) : null}

      <DrawerFooter className="mt-0 px-0">
        <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
          {t("actions.cancel")}
        </Button>
        <Button type="submit" icon={PencilLine} loading={pending} disabled={!canSubmit}>
          {t("actions.save")}
        </Button>
      </DrawerFooter>
    </form>
  );
}

function DeclaredHead({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-3 text-left font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

/**
 * An admin's own declared hours are corrected at their own `/time`, not here.
 *
 * The server refuses it too, and that is the guard that matters — this only keeps the drawer from
 * offering a write it knows will come back as an error. The reason: the domain reads "this is an
 * admin correction" from the two member ids differing, so a self-save would discard the reason and
 * write no `adminModified*` fields.
 */
function isOwnRow(row: AdminDeclaredHoursRow, adminMemberId: string) {
  return row.memberId === adminMemberId;
}

/**
 * The implausible-figure bound: 24 h × days in the month.
 *
 * Read off `monthEnd`'s day number rather than recomputed, so February, leap years and December all
 * fall out of the date the server already resolved — and so this warning cannot disagree with
 * `resolveDeclarationSanityLimit`, which the save path applies to the same figure.
 */
function sanityLimitMinutes(monthEnd: string) {
  return Number(monthEnd.slice(8, 10)) * 24 * 60;
}

/**
 * Minutes back into something typeable.
 *
 * Decimal hours rather than the admin's display preference, for the same reason the member's row
 * does it: the value has to round-trip through `parseDurationToMinutes` unchanged, and a localized
 * `8 h 40 m` would not.
 */
function toHoursText(minutes: number | null) {
  if (minutes === null) return "";

  const hours = minutes / 60;

  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2);
}

function monthHref(monthStart: string) {
  return `/admin/declared-hours?month=${monthStart}` as Route;
}
