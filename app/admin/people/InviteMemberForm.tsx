"use client";

import { Send } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/src/components/ui/Button";
import { Field } from "@/src/components/ui/Field";
import { Input } from "@/src/components/ui/Input";
import { cn } from "@/src/lib/utils";
import { inviteMemberAction } from "./actions";
import type { InviteMemberActionState } from "./actions.types";

const initialState: InviteMemberActionState = {
  status: "idle",
};

const selectClassName =
  "flex h-10 w-full rounded-[var(--radius-md)] border border-input bg-background/50 px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/30";

export function InviteMemberForm() {
  const [state, formAction] = useActionState(inviteMemberAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status, state.message]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" required error={state.fieldErrors?.firstName}>
          {({ id, describedBy, invalid, required }) => (
            <Input
              id={id}
              name="firstName"
              autoComplete="given-name"
              aria-describedby={describedBy}
              invalid={invalid}
              required={required}
            />
          )}
        </Field>
        <Field label="Last name" required error={state.fieldErrors?.lastName}>
          {({ id, describedBy, invalid, required }) => (
            <Input
              id={id}
              name="lastName"
              autoComplete="family-name"
              aria-describedby={describedBy}
              invalid={invalid}
              required={required}
            />
          )}
        </Field>
      </div>

      <Field label="Email" required error={state.fieldErrors?.email}>
        {({ id, describedBy, invalid, required }) => (
          <Input
            id={id}
            name="email"
            type="email"
            autoComplete="email"
            aria-describedby={describedBy}
            invalid={invalid}
            required={required}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Profile" required error={state.fieldErrors?.profile}>
          {({ id, describedBy, invalid, required }) => (
            <select
              id={id}
              name="profile"
              defaultValue="CONTRACTOR"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              required={required}
              className={selectClassName}
            >
              <option value="CONTRACTOR">Contractor</option>
              <option value="EMPLOYEE">Employee</option>
            </select>
          )}
        </Field>
        <Field label="Role" required error={state.fieldErrors?.role}>
          {({ id, describedBy, invalid, required }) => (
            <select
              id={id}
              name="role"
              defaultValue="MEMBER"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              required={required}
              className={selectClassName}
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Currency"
          required
          hint="Default billing/reporting currency."
          error={state.fieldErrors?.defaultCurrencyCode}
        >
          {({ id, describedBy, invalid, required }) => (
            <Input
              id={id}
              name="defaultCurrencyCode"
              defaultValue="EUR"
              maxLength={3}
              aria-describedby={describedBy}
              invalid={invalid}
              required={required}
            />
          )}
        </Field>
        <Field label="Timezone" required error={state.fieldErrors?.timezone}>
          {({ id, describedBy, invalid, required }) => (
            <Input
              id={id}
              name="timezone"
              defaultValue="Europe/Budapest"
              aria-describedby={describedBy}
              invalid={invalid}
              required={required}
            />
          )}
        </Field>
        <Field label="Locale" required error={state.fieldErrors?.locale}>
          {({ id, describedBy, invalid, required }) => (
            <Input
              id={id}
              name="locale"
              defaultValue="en"
              aria-describedby={describedBy}
              invalid={invalid}
              required={required}
            />
          )}
        </Field>
      </div>

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
    <Button type="submit" icon={Send} loading={pending}>
      Send invitation
    </Button>
  );
}
