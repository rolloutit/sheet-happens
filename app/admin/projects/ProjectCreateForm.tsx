"use client";

import { FolderPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  FormDrawerBody,
  FormDrawerFooter,
  useFormDrawerClose,
} from "@/src/components/sheet/FormDrawer";
import { Button } from "@/src/components/ui/Button";
import { Checkbox } from "@/src/components/ui/Checkbox";
import { DatePicker } from "@/src/components/ui/DatePicker";
import { Field } from "@/src/components/ui/Field";
import { FormSection } from "@/src/components/ui/FormSection";
import { Input } from "@/src/components/ui/Input";
import { Textarea } from "@/src/components/ui/Textarea";
import { usePickerLabels } from "@/src/i18n/picker-labels";
import type { ProjectColorToken } from "@/src/lib/project-colors";
import { createProjectAction } from "./actions";
import type { ProjectActionState, ProjectFormField } from "./actions.types";
import { nativeCheckboxClassName } from "./formStyles";
import { ProjectColorField } from "./ProjectColorField";

const initialState: ProjectActionState = {
  status: "idle",
  message: "",
};

/**
 * Reading order of the fields that own a focusable control, which is where focus goes after a
 * failed submit. `colorToken` is a radio group with a default and no id of its own, so it only
 * ever reports its error in place.
 */
const focusableFieldOrder: ProjectFormField[] = ["name", "slug", "startsOn", "endsOn", "notes"];

function fieldId(field: ProjectFormField) {
  return `project-${field}`;
}

export type ProjectCreateFormProps = {
  onDirtyChange: (dirty: boolean) => void;
  /** Called once the project exists and the drawer should hand the result back to the page. */
  onCreated: (message: string) => void;
};

export function ProjectCreateForm({ onDirtyChange, onCreated }: ProjectCreateFormProps) {
  const t = useTranslations("AdminProjects");
  const locale = useLocale();
  const pickerLabels = usePickerLabels();
  const requestClose = useFormDrawerClose();
  const [state, formAction] = useActionState(createProjectAction, initialState);
  const [createAnother, setCreateAnother] = useState(false);
  const [submitted, setSubmitted] = useState<Record<string, string>>({});
  // `createAnother` has to be in the effect's deps, but flipping the checkbox after a save
  // must not replay the result. Each action state is a fresh object, so acting once per
  // object is the whole guard.
  const handledStateRef = useRef<ProjectActionState | null>(null);

  /**
   * React resets an uncontrolled action form after every submit, so a rejected project would
   * otherwise wipe the whole sheet. Handing the submitted values back as defaults is what
   * makes that reset land on what was typed; a success clears them so the next project
   * starts blank.
   */
  const defaults = state.status === "success" ? {} : submitted;

  useEffect(() => {
    if (handledStateRef.current === state) return;

    handledStateRef.current = state;

    if (state.status === "error") {
      const firstInvalid = focusableFieldOrder.find((field) => state.fieldErrors?.[field]);

      if (firstInvalid) document.getElementById(fieldId(firstInvalid))?.focus();

      return;
    }

    if (state.status !== "success") return;

    if (!createAnother) {
      onCreated(state.message);
      return;
    }

    onDirtyChange(false);
    document.getElementById(fieldId("name"))?.focus();
  }, [state, createAnother, onDirtyChange, onCreated]);

  return (
    <form
      action={formAction}
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        const entries = [...new FormData(event.currentTarget).entries()];

        setSubmitted(Object.fromEntries(entries.map(([key, value]) => [key, String(value)])));
      }}
    >
      <FormDrawerBody className="grid gap-6" onChange={() => onDirtyChange(true)}>
        <FormSection title={t("create.detailsTitle")}>
          <Field
            id={fieldId("name")}
            label={t("form.projectName")}
            required
            error={state.fieldErrors?.name}
          >
            {({ id, describedBy, invalid, required }) => (
              <Input
                id={id}
                name="name"
                defaultValue={defaults.name ?? ""}
                autoComplete="off"
                aria-describedby={describedBy}
                invalid={invalid}
                required={required}
              />
            )}
          </Field>
          <Field
            id={fieldId("slug")}
            label={t("form.slug")}
            hint={t("form.slugHint")}
            error={state.fieldErrors?.slug}
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="slug"
                defaultValue={defaults.slug ?? ""}
                autoComplete="off"
                aria-describedby={describedBy}
                invalid={invalid}
                placeholder="internal-platform"
              />
            )}
          </Field>
          <ProjectColorField
            label={t("form.projectColor")}
            defaultValue={defaults.colorToken as ProjectColorToken | undefined}
            error={state.fieldErrors?.colorToken}
          />
        </FormSection>

        <FormSection title={t("create.timelineTitle")} description={t("create.timelineHint")}>
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Field
              id={fieldId("startsOn")}
              label={t("form.startsOn")}
              error={state.fieldErrors?.startsOn}
            >
              {({ id, describedBy, invalid }) => (
                <DatePicker
                  id={id}
                  name="startsOn"
                  defaultValue={defaults.startsOn ?? ""}
                  label={t("form.startsOn")}
                  locale={locale}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  labels={pickerLabels.date}
                />
              )}
            </Field>
            <Field
              id={fieldId("endsOn")}
              label={t("form.endsOn")}
              error={state.fieldErrors?.endsOn}
            >
              {({ id, describedBy, invalid }) => (
                <DatePicker
                  id={id}
                  name="endsOn"
                  defaultValue={defaults.endsOn ?? ""}
                  label={t("form.endsOn")}
                  locale={locale}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  labels={pickerLabels.date}
                />
              )}
            </Field>
          </div>
          <label className="grid grid-cols-[auto_1fr] gap-x-3 rounded-[var(--radius-md)] border border-border bg-background/45 px-3 py-3">
            <input
              type="checkbox"
              name="isInternal"
              value="true"
              defaultChecked={defaults.isInternal === "true"}
              className={nativeCheckboxClassName}
            />
            <span className="grid gap-1">
              <span className="font-ui text-sm font-semibold text-foreground">
                {t("form.internalProject")}
              </span>
              <span className="text-xs leading-5 text-muted-foreground">
                {t("form.internalProjectDescription")}
              </span>
            </span>
          </label>
          <Field id={fieldId("notes")} label={t("form.notes")} error={state.fieldErrors?.notes}>
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                name="notes"
                defaultValue={defaults.notes ?? ""}
                aria-describedby={describedBy}
                invalid={invalid}
                placeholder={t("form.notesPlaceholder")}
              />
            )}
          </Field>
        </FormSection>

        {state.status === "error" && state.message ? (
          <p
            role="alert"
            className="rounded-[var(--radius-md)] border border-destructive/40 bg-destructive-soft px-3 py-2 text-sm text-destructive"
          >
            {state.message}
          </p>
        ) : null}

        {/* Only ever seen with "create another" on: without it the sheet is already closing. */}
        {state.status === "success" && state.message ? (
          <p
            role="status"
            className="rounded-[var(--radius-md)] border border-success/40 bg-success-soft px-3 py-2 text-sm text-success"
          >
            {state.message}
          </p>
        ) : null}
      </FormDrawerBody>

      <FormDrawerFooter>
        <div className="flex items-center gap-2">
          <Checkbox
            id="project-create-another"
            checked={createAnother}
            onCheckedChange={(checked) => setCreateAnother(checked === true)}
          />
          <label htmlFor="project-create-another" className="text-sm text-muted-foreground">
            {t("create.createAnother")}
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={requestClose}>
            {t("actions.cancel")}
          </Button>
          <SubmitButton />
        </div>
      </FormDrawerFooter>
    </form>
  );
}

function SubmitButton() {
  const t = useTranslations("AdminProjects");
  const { pending } = useFormStatus();

  return (
    <Button type="submit" icon={FolderPlus} loading={pending}>
      {t("actions.createProject")}
    </Button>
  );
}
