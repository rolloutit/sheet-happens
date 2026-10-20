"use client";

import { CalendarCheck2, Sunrise, Sunset, Sun } from "lucide-react";
import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";

import { leaveKindIcons } from "@/src/components/sheet/LeaveKindBadge";
import {
  FormDrawerBody,
  FormDrawerFooter,
  useFormDrawerClose,
} from "@/src/components/sheet/FormDrawer";
import { Button } from "@/src/components/ui/Button";
import { Combobox } from "@/src/components/ui/Combobox";
import { DateRangePicker, type DateRangeValue } from "@/src/components/ui/DateRangePicker";
import { Field } from "@/src/components/ui/Field";
import { FormMessage } from "@/src/components/ui/FormMessage";
import { Textarea } from "@/src/components/ui/Textarea";
import { usePickerLabels } from "@/src/i18n/picker-labels";
import {
  countLeaveWorkdays,
  LEAVE_NOTE_MAX_LENGTH,
  type LeaveDayPartValue,
} from "@/src/lib/leave-days";
import { cn } from "@/src/lib/utils";
import type { LeaveActionState } from "./action-state";
import { initialLeaveActionState } from "./action-state";
import { SickNoteFileInput } from "./SickNoteFileInput";
import { useLeaveText } from "./use-leave-labels";

type LeaveFormAction = (state: LeaveActionState, formData: FormData) => Promise<LeaveActionState>;

export type LeaveFormValues = {
  leaveId?: string;
  type: "VACATION" | "SICK";
  startDate: string;
  endDate: string;
  dayPart: LeaveDayPartValue;
  note: string;
};

export type LeaveFormProps = {
  action: LeaveFormAction;
  mode: "create" | "edit";
  initial?: LeaveFormValues;
  /** The first selectable day; `undefined` lets an admin correct the past. */
  minDate?: string;
  /** Holiday dates for the live workday count. Two years' worth comes with the page. */
  holidayDates: readonly string[];
  /** Whose leave an admin is editing, shown read-only above the form. */
  memberName?: string;
  /** The employees an admin can record leave for; shows the picker when set. */
  memberOptions?: readonly { id: string; name: string; email: string }[];
  onDirtyChange: (dirty: boolean) => void;
  onDone: (message: string) => void;
};

export function LeaveForm({
  action,
  mode,
  initial,
  minDate,
  holidayDates,
  memberName,
  memberOptions,
  onDirtyChange,
  onDone,
}: LeaveFormProps) {
  const { t, locale, workdays } = useLeaveText();
  const pickerLabels = usePickerLabels();
  const requestClose = useFormDrawerClose();
  const [state, formAction, pending] = useActionState(action, initialLeaveActionState);
  const [type, setType] = useState<"VACATION" | "SICK">(initial?.type ?? "VACATION");
  const [range, setRange] = useState<DateRangeValue>({
    from: initial?.startDate,
    to: initial?.endDate,
  });
  const [dayPart, setDayPart] = useState<LeaveDayPartValue>(initial?.dayPart ?? "FULL");
  const [note, setNote] = useState(initial?.note ?? "");
  const [memberId, setMemberId] = useState("");
  const handledStateRef = useRef<LeaveActionState | null>(null);

  const startDate = range.from;
  const endDate = range.to ?? range.from;
  const singleDay = Boolean(startDate && startDate === endDate);
  const effectiveDayPart = singleDay ? dayPart : "FULL";

  const count = useMemo(
    () =>
      startDate && endDate && endDate >= startDate
        ? countLeaveWorkdays({ startDate, endDate, dayPart: effectiveDayPart, holidayDates })
        : null,
    [startDate, endDate, effectiveDayPart, holidayDates],
  );

  useEffect(() => {
    if (handledStateRef.current === state) return;
    handledStateRef.current = state;
    if (state.status === "success") onDone(state.message);
  }, [state, onDone]);

  const markDirty = () => onDirtyChange(true);

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onChange={markDirty}
      onSubmit={(event) => {
        // Dispatched by hand rather than through `action=`, which resets the form after every
        // submit and would wipe a rejected leave's dates and note.
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      {initial?.leaveId ? <input type="hidden" name="leaveId" value={initial.leaveId} /> : null}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="dayPart" value={effectiveDayPart} />

      <FormDrawerBody className="grid content-start gap-6">
        {memberName ? (
          <p className="rounded-[var(--radius-md)] border border-border bg-secondary/60 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{t("form.member")}: </span>
            <span className="font-ui font-semibold text-foreground">{memberName}</span>
          </p>
        ) : null}

        {memberOptions ? (
          <Field
            id="leave-member"
            label={t("form.member")}
            required
            error={state.fieldErrors?.memberId}
          >
            {({ id, describedBy, invalid }) => (
              <Combobox
                id={id}
                name="memberId"
                label={t("form.member")}
                placeholder={t("form.memberPlaceholder")}
                value={memberId}
                onValueChange={(value) => {
                  setMemberId(value);
                  markDirty();
                }}
                options={memberOptions.map((option) => ({
                  value: option.id,
                  label: option.name,
                  meta: option.email,
                }))}
                labels={pickerLabels.combobox}
                aria-describedby={describedBy}
                invalid={invalid}
                required
              />
            )}
          </Field>
        ) : null}

        <fieldset className="grid gap-2">
          <legend className="mb-2 font-ui text-sm font-semibold text-foreground">
            {t("form.type")}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {(["VACATION", "SICK"] as const).map((option) => {
              const kind = option === "SICK" ? "sick" : "vacation";
              const Icon = leaveKindIcons[kind];
              const selected = type === option;
              return (
                <label
                  key={option}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-[var(--radius-lg)] border px-3 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                    selected
                      ? kind === "sick"
                        ? "border-settled/45 bg-settled-soft text-settled"
                        : "border-accent-line bg-accent-soft text-accent"
                      : "border-border bg-card text-foreground hover:bg-secondary",
                  )}
                >
                  <input
                    type="radio"
                    name="typeChoice"
                    value={option}
                    checked={selected}
                    onChange={() => {
                      setType(option);
                      markDirty();
                    }}
                    className="sr-only"
                  />
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  <span className="grid gap-0.5">
                    <span className="font-ui text-sm font-semibold">{t(`kinds.${kind}`)}</span>
                    <span className="text-xs text-muted-foreground">
                      {t(`form.typeHint.${kind}`)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {state.fieldErrors?.type ? (
            <FormMessage tone="error">{state.fieldErrors.type}</FormMessage>
          ) : null}
        </fieldset>

        <Field
          id="leave-dates"
          label={t("form.dates")}
          required
          hint={minDate ? t("form.datesHint") : undefined}
          error={state.fieldErrors?.startDate ?? state.fieldErrors?.endDate}
        >
          {({ id, describedBy, invalid }) => (
            <DateRangePicker
              id={id}
              names={{ from: "startDate", to: "endDate" }}
              value={range}
              onValueChange={(value) => {
                setRange(value);
                markDirty();
              }}
              label={t("form.dates")}
              placeholder={t("form.datesPlaceholder")}
              locale={locale}
              min={minDate}
              labels={pickerLabels.range}
              aria-describedby={describedBy}
              invalid={invalid}
              required
            />
          )}
        </Field>

        {singleDay ? (
          <fieldset className="grid gap-2">
            <legend className="mb-2 font-ui text-sm font-semibold text-foreground">
              {t("form.dayPart")}
            </legend>
            <div className="grid grid-cols-3 gap-1 rounded-[var(--radius-pill)] border border-border bg-secondary/60 p-1">
              {(
                [
                  ["FULL", Sun],
                  ["MORNING", Sunrise],
                  ["AFTERNOON", Sunset],
                ] as const
              ).map(([option, Icon]) => (
                <label
                  key={option}
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-1.5 rounded-[var(--radius-pill)] px-2 py-1.5 font-ui text-xs font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                    dayPart === option
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <input
                    type="radio"
                    name="dayPartChoice"
                    value={option}
                    checked={dayPart === option}
                    onChange={() => {
                      setDayPart(option);
                      markDirty();
                    }}
                    className="sr-only"
                  />
                  <Icon className="size-3.5" aria-hidden="true" />
                  {t(`dayParts.${option}`)}
                </label>
              ))}
            </div>
            {state.fieldErrors?.dayPart ? (
              <FormMessage tone="error">{state.fieldErrors.dayPart}</FormMessage>
            ) : null}
          </fieldset>
        ) : null}

        <div
          aria-live="polite"
          className={cn(
            "flex items-center gap-3 rounded-[var(--radius-lg)] border px-4 py-3",
            count && count.workdays > 0
              ? "border-accent-line bg-accent-soft/60"
              : "border-dashed border-border bg-secondary/40",
          )}
        >
          <CalendarCheck2
            className={cn(
              "size-5 shrink-0",
              count?.workdays ? "text-accent" : "text-muted-foreground",
            )}
            aria-hidden="true"
          />
          <p className="text-sm">
            {!count ? (
              <span className="text-muted-foreground">{t("form.summaryEmpty")}</span>
            ) : count.workdays === 0 ? (
              <span className="text-muted-foreground">{t("form.summaryNoWorkdays")}</span>
            ) : (
              <>
                <span className="font-ui font-semibold text-foreground">
                  {workdays(count.workdays)}
                </span>
                {count.skippedHolidays > 0 ? (
                  <span className="text-muted-foreground">
                    {" "}
                    {t("form.summarySkipped", { count: count.skippedHolidays })}
                  </span>
                ) : null}
              </>
            )}
          </p>
        </div>

        <Field
          id="leave-note"
          label={t("form.note")}
          hint={t("form.noteHint")}
          error={state.fieldErrors?.note}
        >
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              name="note"
              rows={3}
              maxLength={LEAVE_NOTE_MAX_LENGTH}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>

        {type === "SICK" && mode === "create" ? (
          <Field
            id="leave-file"
            label={t("form.file")}
            hint={t("form.fileHint")}
            error={state.fieldErrors?.file}
          >
            {({ id, describedBy, invalid }) => (
              <SickNoteFileInput id={id} describedBy={describedBy} invalid={invalid} />
            )}
          </Field>
        ) : null}

        {state.status === "error" && !state.fieldErrors ? (
          <FormMessage tone="error">{state.message}</FormMessage>
        ) : null}
      </FormDrawerBody>

      <FormDrawerFooter>
        <Button type="button" variant="ghost" onClick={requestClose}>
          {t("actions.cancel")}
        </Button>
        <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
          {mode === "create" ? t("form.submit") : t("form.save")}
        </Button>
      </FormDrawerFooter>
    </form>
  );
}
