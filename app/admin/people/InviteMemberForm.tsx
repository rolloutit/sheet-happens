"use client";

import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/src/components/ui/Button";
import { Field } from "@/src/components/ui/Field";
import { Input } from "@/src/components/ui/Input";
import type { MemberPreferenceOptions } from "@/src/lib/member-preferences";
import { cn } from "@/src/lib/utils";
import { inviteMemberAction } from "./actions";
import type { InviteMemberActionState } from "./actions.types";
import { nativeSelectClassName } from "./formStyles";

const initialState: InviteMemberActionState = {
  status: "idle",
};

export type InviteMemberFormProps = {
  preferenceOptions: MemberPreferenceOptions;
};

export function InviteMemberForm({ preferenceOptions }: InviteMemberFormProps) {
  const t = useTranslations("AdminPeople");
  const [state, formAction] = useActionState(inviteMemberAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status, state.message]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-3">
        <Field
          label={t("form.firstName")}
          required
          reserveMessageSpace
          error={state.fieldErrors?.firstName}
        >
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
        <Field
          label={t("form.lastName")}
          required
          reserveMessageSpace
          error={state.fieldErrors?.lastName}
        >
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

        <Field
          label={t("form.email")}
          required
          reserveMessageSpace
          error={state.fieldErrors?.email}
        >
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(7rem,0.75fr)_minmax(12rem,1.25fr)_minmax(6rem,0.6fr)]">
        <Field
          label={t("form.profile")}
          required
          reserveMessageSpace
          error={state.fieldErrors?.profile}
        >
          {({ id, describedBy, invalid, required }) => (
            <select
              id={id}
              name="profile"
              defaultValue="CONTRACTOR"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              required={required}
              className={nativeSelectClassName}
            >
              <option value="CONTRACTOR">{t("profiles.contractor")}</option>
              <option value="EMPLOYEE">{t("profiles.employee")}</option>
            </select>
          )}
        </Field>
        <Field label={t("form.role")} required reserveMessageSpace error={state.fieldErrors?.role}>
          {({ id, describedBy, invalid, required }) => (
            <select
              id={id}
              name="role"
              defaultValue="MEMBER"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              required={required}
              className={nativeSelectClassName}
            >
              <option value="MEMBER">{t("roles.member")}</option>
              <option value="ADMIN">{t("roles.admin")}</option>
            </select>
          )}
        </Field>
        <Field
          label={t("form.currency")}
          required
          reserveMessageSpace
          hint={t("form.currencyHint")}
          error={state.fieldErrors?.defaultCurrencyCode}
        >
          {({ id, describedBy, invalid, required }) => (
            <select
              id={id}
              name="defaultCurrencyCode"
              defaultValue="EUR"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              required={required}
              className={nativeSelectClassName}
            >
              {preferenceOptions.currencies.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field
          label={t("form.timezone")}
          required
          reserveMessageSpace
          error={state.fieldErrors?.timezone}
        >
          {({ id, describedBy, invalid, required }) => (
            <select
              id={id}
              name="timezone"
              defaultValue="Europe/Budapest"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              required={required}
              className={nativeSelectClassName}
            >
              {preferenceOptions.timezones.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field
          label={t("form.locale")}
          required
          reserveMessageSpace
          error={state.fieldErrors?.locale}
        >
          {({ id, describedBy, invalid, required }) => (
            <select
              id={id}
              name="locale"
              defaultValue="en"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              required={required}
              className={nativeSelectClassName}
            >
              {preferenceOptions.locales.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
  const t = useTranslations("AdminPeople");
  const { pending } = useFormStatus();

  return (
    <Button type="submit" icon={Send} loading={pending}>
      {t("actions.sendInvitation")}
    </Button>
  );
}
