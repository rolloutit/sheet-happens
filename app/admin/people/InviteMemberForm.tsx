"use client";

import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  FormDrawerBody,
  FormDrawerFooter,
  useFormDrawerClose,
} from "@/src/components/sheet/FormDrawer";
import { Button } from "@/src/components/ui/Button";
import { Checkbox } from "@/src/components/ui/Checkbox";
import { Field } from "@/src/components/ui/Field";
import { FormSection } from "@/src/components/ui/FormSection";
import { Input } from "@/src/components/ui/Input";
import { Select } from "@/src/components/ui/Select";
import { usePickerLabels } from "@/src/i18n/picker-labels";
import type { MemberPreferenceOptions } from "@/src/lib/member-preferences";
import { inviteMemberAction } from "./actions";
import type { InviteMemberActionState, InviteMemberField } from "./actions.types";

const initialState: InviteMemberActionState = {
  status: "idle",
};

/** Reading order of the fields, which is also where focus goes after a failed submit. */
const fieldOrder: InviteMemberField[] = [
  "firstName",
  "lastName",
  "email",
  "profile",
  "role",
  "defaultCurrencyCode",
  "timezone",
  "locale",
];

/** Stable ids so a server-side field error can move focus without a ref per control. */
function fieldId(field: InviteMemberField) {
  return `invite-${field}`;
}

export type InviteMemberFormProps = {
  preferenceOptions: MemberPreferenceOptions;
  onDirtyChange: (dirty: boolean) => void;
  /** Called once the invitation is sent and the drawer should hand the result back to the page. */
  onInvited: (message: string) => void;
};

export function InviteMemberForm({
  preferenceOptions,
  onDirtyChange,
  onInvited,
}: InviteMemberFormProps) {
  const t = useTranslations("AdminPeople");
  const pickerLabels = usePickerLabels();
  const requestClose = useFormDrawerClose();
  const [state, formAction] = useActionState(inviteMemberAction, initialState);
  const [inviteAnother, setInviteAnother] = useState(false);
  const [submitted, setSubmitted] = useState<Record<string, string>>({});
  // `inviteAnother` has to be in the effect's deps, but flipping the checkbox after a send
  // must not replay the result. Each action state is a fresh object, so acting once per
  // object is the whole guard.
  const handledStateRef = useRef<InviteMemberActionState | null>(null);

  /**
   * React resets an uncontrolled action form after every submit, so a rejected invitation
   * would otherwise wipe all eight fields — a good deal more annoying in a sheet than it was
   * on the page. Handing the submitted values back as defaults is what makes that reset land
   * on what was typed; a success clears them so the next invitation starts blank.
   */
  const defaults = state.status === "success" ? {} : submitted;

  useEffect(() => {
    if (handledStateRef.current === state) return;

    handledStateRef.current = state;

    if (state.status === "error") {
      const firstInvalid = fieldOrder.find((field) => state.fieldErrors?.[field]);

      if (firstInvalid) document.getElementById(fieldId(firstInvalid))?.focus();

      return;
    }

    if (state.status !== "success") return;

    // Onboarding several people in a row was the one thing the always-open page form was
    // good at. Keeping the sheet open on request is what buys that back.
    if (!inviteAnother) {
      onInvited(state.message ?? "");
      return;
    }

    onDirtyChange(false);
    document.getElementById(fieldId("firstName"))?.focus();
  }, [state, inviteAnother, onDirtyChange, onInvited]);

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
        <FormSection title={t("invite.detailsTitle")}>
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Field
              id={fieldId("firstName")}
              label={t("form.firstName")}
              required
              error={state.fieldErrors?.firstName}
            >
              {({ id, describedBy, invalid, required }) => (
                <Input
                  id={id}
                  name="firstName"
                  defaultValue={defaults.firstName ?? ""}
                  autoComplete="given-name"
                  aria-describedby={describedBy}
                  invalid={invalid}
                  required={required}
                />
              )}
            </Field>
            <Field
              id={fieldId("lastName")}
              label={t("form.lastName")}
              required
              error={state.fieldErrors?.lastName}
            >
              {({ id, describedBy, invalid, required }) => (
                <Input
                  id={id}
                  name="lastName"
                  defaultValue={defaults.lastName ?? ""}
                  autoComplete="family-name"
                  aria-describedby={describedBy}
                  invalid={invalid}
                  required={required}
                />
              )}
            </Field>
          </div>
          <Field
            id={fieldId("email")}
            label={t("form.email")}
            required
            hint={t("invite.emailHint")}
            error={state.fieldErrors?.email}
          >
            {({ id, describedBy, invalid, required }) => (
              <Input
                id={id}
                name="email"
                type="email"
                defaultValue={defaults.email ?? ""}
                autoComplete="email"
                aria-describedby={describedBy}
                invalid={invalid}
                required={required}
              />
            )}
          </Field>
        </FormSection>

        <FormSection title={t("invite.defaultsTitle")} description={t("invite.defaultsHint")}>
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Field
              id={fieldId("profile")}
              label={t("form.profile")}
              required
              error={state.fieldErrors?.profile}
            >
              {({ id, describedBy, invalid, required }) => (
                <Select
                  id={id}
                  name="profile"
                  label={t("form.profile")}
                  defaultValue={defaults.profile ?? "CONTRACTOR"}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  required={required}
                  labels={pickerLabels.combobox}
                  options={[
                    { value: "CONTRACTOR", label: t("profiles.contractor") },
                    { value: "EMPLOYEE", label: t("profiles.employee") },
                  ]}
                />
              )}
            </Field>
            <Field
              id={fieldId("role")}
              label={t("form.role")}
              required
              error={state.fieldErrors?.role}
            >
              {({ id, describedBy, invalid, required }) => (
                <Select
                  id={id}
                  name="role"
                  label={t("form.role")}
                  defaultValue={defaults.role ?? "MEMBER"}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  required={required}
                  labels={pickerLabels.combobox}
                  options={[
                    { value: "MEMBER", label: t("roles.member") },
                    { value: "ADMIN", label: t("roles.admin") },
                  ]}
                />
              )}
            </Field>
          </div>
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Field
              id={fieldId("defaultCurrencyCode")}
              label={t("form.currency")}
              required
              hint={t("form.currencyHint")}
              error={state.fieldErrors?.defaultCurrencyCode}
            >
              {({ id, describedBy, invalid, required }) => (
                <Select
                  id={id}
                  name="defaultCurrencyCode"
                  label={t("form.currency")}
                  defaultValue={defaults.defaultCurrencyCode ?? "HUF"}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  required={required}
                  labels={pickerLabels.combobox}
                  options={preferenceOptions.currencies}
                />
              )}
            </Field>
            <Field
              id={fieldId("locale")}
              label={t("form.locale")}
              required
              error={state.fieldErrors?.locale}
            >
              {({ id, describedBy, invalid, required }) => (
                <Select
                  id={id}
                  name="locale"
                  label={t("form.locale")}
                  defaultValue={defaults.locale ?? "hu"}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  required={required}
                  labels={pickerLabels.combobox}
                  options={preferenceOptions.locales}
                />
              )}
            </Field>
          </div>
          <Field
            id={fieldId("timezone")}
            label={t("form.timezone")}
            required
            error={state.fieldErrors?.timezone}
          >
            {({ id, describedBy, invalid, required }) => (
              <Select
                id={id}
                name="timezone"
                label={t("form.timezone")}
                defaultValue={defaults.timezone ?? "Europe/Budapest"}
                aria-describedby={describedBy}
                invalid={invalid}
                required={required}
                labels={pickerLabels.combobox}
                options={preferenceOptions.timezones}
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

        {/* Only ever seen with "invite another" on: without it the sheet is already closing. */}
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
            id="invite-another"
            checked={inviteAnother}
            onCheckedChange={(checked) => setInviteAnother(checked === true)}
          />
          <label htmlFor="invite-another" className="text-sm text-muted-foreground">
            {t("invite.inviteAnother")}
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
  const t = useTranslations("AdminPeople");
  const { pending } = useFormStatus();

  return (
    <Button type="submit" icon={Send} loading={pending}>
      {t("actions.sendInvitation")}
    </Button>
  );
}
