"use client";

import { FolderPlus } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/src/components/ui/Button";
import { Field } from "@/src/components/ui/Field";
import { Input } from "@/src/components/ui/Input";
import { Textarea } from "@/src/components/ui/Textarea";
import { cn } from "@/src/lib/utils";
import { createProjectAction } from "./actions";
import type { ProjectActionState } from "./actions.types";
import { nativeCheckboxClassName } from "./formStyles";
import { ProjectColorField } from "./ProjectColorField";

const initialState: ProjectActionState = {
  status: "idle",
  message: "",
};

export function ProjectCreateForm() {
  const [state, formAction] = useActionState(createProjectAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status, state.message]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.5fr_1fr]">
        <Field label="Project name" required reserveMessageSpace error={state.fieldErrors?.name}>
          {({ id, describedBy, invalid, required }) => (
            <Input
              id={id}
              name="name"
              autoComplete="off"
              aria-describedby={describedBy}
              invalid={invalid}
              required={required}
            />
          )}
        </Field>
        <Field
          label="Slug"
          hint="Leave empty to generate it from the name."
          reserveMessageSpace
          error={state.fieldErrors?.slug}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="slug"
              autoComplete="off"
              aria-describedby={describedBy}
              invalid={invalid}
              placeholder="internal-platform"
            />
          )}
        </Field>
      </div>

      <ProjectColorField error={state.fieldErrors?.colorToken} reserveMessageSpace />

      <div className="grid gap-4 md:grid-cols-[minmax(9rem,1fr)_minmax(9rem,1fr)_minmax(14rem,1.25fr)]">
        <Field label="Starts on" reserveMessageSpace error={state.fieldErrors?.startsOn}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="startsOn"
              type="date"
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
        <Field label="Ends on" reserveMessageSpace error={state.fieldErrors?.endsOn}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              name="endsOn"
              type="date"
              aria-describedby={describedBy}
              invalid={invalid}
            />
          )}
        </Field>
        <label className="grid min-h-[4.5rem] grid-cols-[auto_1fr] gap-x-3 rounded-[var(--radius-md)] border border-border bg-background/45 px-3 py-3">
          <input
            type="checkbox"
            name="isInternal"
            value="true"
            className={nativeCheckboxClassName}
          />
          <span className="grid gap-1">
            <span className="font-ui text-sm font-semibold text-foreground">Internal project</span>
            <span className="text-xs leading-5 text-muted-foreground">
              Use for internal or collector work such as team building, communication, or
              operational tasks.
            </span>
          </span>
        </label>
      </div>

      <Field label="Notes" reserveMessageSpace error={state.fieldErrors?.notes}>
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            name="notes"
            aria-describedby={describedBy}
            invalid={invalid}
            placeholder="Optional admin notes"
          />
        )}
      </Field>

      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={cn(
            "rounded-[var(--radius-md)] border px-3 py-2 text-sm",
            state.status === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-success/40 bg-success/10 text-success",
          )}
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" icon={FolderPlus} loading={pending}>
      Create project
    </Button>
  );
}
