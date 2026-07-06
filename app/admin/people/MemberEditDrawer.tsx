"use client";

import { Save } from "lucide-react";
import { type FormEvent, useState, useTransition } from "react";

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
import { currencyOptions, localeOptions, timezoneOptions } from "@/src/lib/member-preferences";
import type { AdminPersonRow } from "@/src/server/users";
import { updateMemberDetailsAction } from "./actions";
import type {
  AdminPeopleActionState,
  UpdateMemberDetailsActionInput,
  UpdateMemberDetailsActionState,
} from "./actions.types";
import { nativeSelectClassName } from "./formStyles";

export type MemberEditDrawerProps = {
  member: AdminPersonRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResult: (result: AdminPeopleActionState) => void;
  onSaved: () => void;
};

type EditableValues = Omit<UpdateMemberDetailsActionInput, "memberId">;

export function MemberEditDrawer({
  member,
  open,
  onOpenChange,
  onResult,
  onSaved,
}: MemberEditDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="w-[min(42rem,100vw)] overflow-y-auto">
        <DrawerHeader>
          <DrawerTitle className="text-2xl font-semibold text-foreground">Edit member</DrawerTitle>
          <DrawerDescription className="text-sm leading-6 text-muted-foreground">
            Update domain member details. Auth account data, role, and profile transitions are
            managed separately.
          </DrawerDescription>
        </DrawerHeader>

        {member ? (
          <MemberEditForm
            key={member.id}
            member={member}
            onCancel={() => onOpenChange(false)}
            onResult={onResult}
            onSaved={() => {
              onOpenChange(false);
              onSaved();
            }}
          />
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

function MemberEditForm({
  member,
  onCancel,
  onResult,
  onSaved,
}: {
  member: AdminPersonRow;
  onCancel: () => void;
  onResult: (result: AdminPeopleActionState) => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<EditableValues>(() => getEditableValues(member));
  const [fieldErrors, setFieldErrors] =
    useState<UpdateMemberDetailsActionState["fieldErrors"]>(undefined);
  const [status, setStatus] = useState<UpdateMemberDetailsActionState | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateField(field: keyof EditableValues, value: string) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setFieldErrors(undefined);

    startTransition(async () => {
      const result = await updateMemberDetailsAction({
        memberId: member.id,
        ...values,
      });

      setStatus(result);
      setFieldErrors(result.fieldErrors);
      onResult(result);

      if (result.status === "success") {
        onSaved();
      }
    });
  }

  return (
    <form className="grid gap-5" onSubmit={submit}>
      <div className="rounded-[var(--radius-lg)] border border-border bg-secondary/50 p-4">
        <p className="font-ui text-sm font-semibold text-foreground">{member.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">{member.email}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" required reserveMessageSpace error={fieldErrors?.firstName}>
          {({ id, describedBy, invalid, required }) => (
            <Input
              id={id}
              value={values.firstName}
              autoComplete="given-name"
              aria-describedby={describedBy}
              invalid={invalid}
              required={required}
              onChange={(event) => updateField("firstName", event.target.value)}
            />
          )}
        </Field>
        <Field label="Last name" required reserveMessageSpace error={fieldErrors?.lastName}>
          {({ id, describedBy, invalid, required }) => (
            <Input
              id={id}
              value={values.lastName}
              autoComplete="family-name"
              aria-describedby={describedBy}
              invalid={invalid}
              required={required}
              onChange={(event) => updateField("lastName", event.target.value)}
            />
          )}
        </Field>
      </div>

      <Field
        label="Display name"
        reserveMessageSpace
        hint="Leave empty to use first and last name."
        error={fieldErrors?.displayName}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            value={values.displayName}
            autoComplete="name"
            maxLength={120}
            aria-describedby={describedBy}
            invalid={invalid}
            onChange={(event) => updateField("displayName", event.target.value)}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-[minmax(7rem,0.75fr)_minmax(12rem,1.25fr)_minmax(7rem,0.75fr)]">
        <Field
          label="Currency"
          required
          reserveMessageSpace
          error={fieldErrors?.defaultCurrencyCode}
        >
          {({ id, describedBy, invalid, required }) => (
            <select
              id={id}
              value={values.defaultCurrencyCode}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              required={required}
              className={nativeSelectClassName}
              onChange={(event) => updateField("defaultCurrencyCode", event.target.value)}
            >
              {currencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Timezone" required reserveMessageSpace error={fieldErrors?.timezone}>
          {({ id, describedBy, invalid, required }) => (
            <select
              id={id}
              value={values.timezone}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              required={required}
              className={nativeSelectClassName}
              onChange={(event) => updateField("timezone", event.target.value)}
            >
              {timezoneOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Locale" required reserveMessageSpace error={fieldErrors?.locale}>
          {({ id, describedBy, invalid, required }) => (
            <select
              id={id}
              value={values.locale}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              required={required}
              className={nativeSelectClassName}
              onChange={(event) => updateField("locale", event.target.value)}
            >
              {localeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      {status && status.status === "error" ? (
        <p
          role="alert"
          className="rounded-[var(--radius-md)] border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {status.message}
        </p>
      ) : null}

      <DrawerFooter>
        <Button type="button" variant="ghost" disabled={isPending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" icon={Save} loading={isPending}>
          Save changes
        </Button>
      </DrawerFooter>
    </form>
  );
}

function getEditableValues(member: AdminPersonRow | null): EditableValues {
  return {
    firstName: member?.firstName ?? "",
    lastName: member?.lastName ?? "",
    displayName: member?.displayName ?? "",
    defaultCurrencyCode: member?.defaultCurrencyCode ?? "EUR",
    timezone: member?.timezone ?? "Europe/Budapest",
    locale: member?.locale ?? "en",
  };
}
