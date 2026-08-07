"use client";

import { Save } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { Combobox } from "@/src/components/ui/Combobox";
import { DatePicker } from "@/src/components/ui/DatePicker";
import { Field } from "@/src/components/ui/Field";
import { Input } from "@/src/components/ui/Input";
import { Switch } from "@/src/components/ui/Switch";
import { Textarea } from "@/src/components/ui/Textarea";
import type { TimeEntryFormProps, TimeEntryFormValue } from "./TimeEntryForm.types";

const defaultValue: TimeEntryFormValue = {
  projectId: "",
  date: undefined,
  hours: 0,
  description: "",
  billable: true,
};

export function TimeEntryForm({
  projects,
  value,
  locale = "en",
  labels,
  disabled,
  className,
  onValueChange,
  onSubmit,
  onCancel,
}: TimeEntryFormProps) {
  const [draft, setDraft] = useState<TimeEntryFormValue>({ ...defaultValue, ...value });
  const currentValue = value ? { ...defaultValue, ...value } : draft;

  function updateValue(nextValue: TimeEntryFormValue) {
    if (!value) setDraft(nextValue);
    onValueChange?.(nextValue);
  }

  function updateField<Key extends keyof TimeEntryFormValue>(
    key: Key,
    nextValue: TimeEntryFormValue[Key],
  ) {
    updateValue({ ...currentValue, [key]: nextValue });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    onSubmit?.(currentValue);
  }

  return (
    <Card variant="elevated" className={className}>
      <CardHeader>
        <div>
          <CardTitle>{labels?.title ?? "Time entry"}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {labels?.description ?? "Create or edit a single project/day entry."}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Combobox
              label={labels?.project ?? "Project"}
              options={projects}
              value={currentValue.projectId}
              disabled={disabled}
              onValueChange={(projectId) => updateField("projectId", projectId)}
            />
            <DatePicker
              label={labels?.date ?? "Date"}
              locale={locale}
              value={currentValue.date}
              disabled={disabled}
              onValueChange={(date) => updateField("date", date)}
            />
          </div>
          <Field label={labels?.hours ?? "Hours"} htmlFor="time-entry-hours">
            <Input
              id="time-entry-hours"
              type="number"
              min={0}
              step={0.25}
              value={currentValue.hours}
              disabled={disabled}
              onChange={(event) => updateField("hours", Number(event.target.value || 0))}
            />
          </Field>
          <Field label={labels?.note ?? "Work note"} htmlFor="time-entry-note">
            <Textarea
              id="time-entry-note"
              value={currentValue.description}
              disabled={disabled}
              onChange={(event) => updateField("description", event.target.value)}
            />
          </Field>
          <label className="flex items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-border bg-secondary/60 p-3">
            <span className="font-ui text-sm font-semibold">{labels?.billable ?? "Billable"}</span>
            <Switch
              checked={currentValue.billable}
              disabled={disabled}
              onCheckedChange={(checked) => updateField("billable", checked)}
            />
          </label>
          <div className="flex justify-end gap-2">
            {onCancel ? (
              <Button type="button" variant="ghost" onClick={onCancel}>
                {labels?.cancel ?? "Cancel"}
              </Button>
            ) : null}
            <Button type="submit" variant="cta" icon={Save} disabled={disabled}>
              {labels?.submit ?? "Save entry"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
